import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import { setupEventListeners } from "./setupEventListeners.js"; // Import RTM and RTC event listeners
import { handleRenewToken, handleUserJoined, handleUserPublished } from "./rtcEventHandlers.js"; // Token renewal handler
import { fetchTokens } from "./helperFunctions.js";
import { addUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";
import { toggleMic, toggleCamera, toggleScreenShare } from "./uiHandlers.js"; // Import toggle functions from uiHandlers



const newMainApp = function (initConfig) {
  let config = {
    debugEnabled: true,
    callContainerSelector: "#video-stage",
    participantPlayerContainer: templateVideoParticipant,
    appId: "95e91980e5444a8e86b4e41c7f03b713",
    timestamp: "",
    recordId: null,
    uid: null,
    user: {
      id: null,
      name: "guest",
      avatar:
        "https://ui-avatars.com/api/?background=random&color=fff&name=loading",
      role: "", // host, speaker, audience, etc.
      company: "",
      designation: "",
      profileLink: "",
    },
    serverUrl: "https://agora-new.vercel.app",
    token: null,
    channelName: null,
    localAudioTrack: null,
    localVideoTrack: null,
    localScreenShareTrack: null,
    localScreenShareEnabled: false,
    localAudioTrackMuted: false,
    localVideoTrackMuted: false,
    isVirtualBackGroundEnabled: false,
    remoteTracks: {},
  };

  // Apply initial config
  config = { ...config, ...initConfig };

  // Initialize AgoraRTC client
  config.client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

  // Ensure required config parameters are present
  if (
    !config.appId ||
    !config.callContainerSelector ||
    !config.serverUrl ||
    !config.channelName ||
    !config.uid
  ) {
    throw new Error("Required config parameters are missing.");
  }

  // Initialize AgoraRTC event listeners
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); // 0 for debug, 4 for none
  AgoraRTC.onCameraChanged = (info) => config.onCameraChanged(info);
  AgoraRTC.onMicrophoneChanged = (info) => config.onMicrophoneChanged(info);
  AgoraRTC.onPlaybackDeviceChanged = (info) => config.onSpeakerChanged(info);

  // Initialize AgoraRTM (RTM client must be initialized before eventCallbacks)
  config.clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled ? AgoraRTM.LOG_FILTER_INFO : AgoraRTM.LOG_FILTER_OFF,
  });

  // Initialize RTM Channel
  config.channelRTM = config.clientRTM.createChannel(config.channelName);

  // Initialize event callbacks with clientRTM passed
  const callbacks = eventCallbacks(config, config.clientRTM);
  config = { ...config, ...callbacks };

  // Join RTC and RTM
const join = async () => {
  try {
    const tokens = await fetchTokens(config); // Fetch RTC and RTM tokens
    if (!tokens) throw new Error("Failed to fetch token");

    // Ensure the user has a role assigned
    if (!config.user.role) {
      throw new Error("User does not have a role assigned.");
    }

    // Set RTC role based on the user's role
    if (config.user.role === "host") {
      await config.client.setClientRole("host");
    } else {
      await config.client.setClientRole("audience");
    }

    // Initialize participantList with the local user's info
    config.participantList = [
      {
        uid: config.uid,
        name: config.user.name || "Unknown",
        company: config.user.company || "",
        designation: config.user.designation || "",
      },
    ];

    // Join RTM and RTC
    await joinRTM(tokens.rtmToken);

    console.log("config.uid before joining RTC", config.uid);
    await config.client.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      config.uid
    );

    console.log("config.uid before setting up listeners", config.uid);
    setupEventListeners(config); // Setup RTC listeners

    // If the user is a host, join the video stage
    if (config.user.role === "host") {
      await joinToVideoStage(config); // Host joins the video stage
    }

    // Subscribe to existing remote users' media tracks (video/audio)
    const remoteUsers = config.client.remoteUsers;

    if (remoteUsers && remoteUsers.length > 0) {
      console.log(`Subscribing to ${remoteUsers.length} remote users`);
      for (const remoteUser of remoteUsers) {
        // Skip subscription if the remote user is the current user
        if (remoteUser.uid !== config.uid) {
          // Get RTM attributes of the remote user
          let attributes = {};
          try {
            attributes = await config.clientRTM.getUserAttributes(
              remoteUser.uid.toString()
            );
          } catch (e) {
            console.error(
              `Failed to get attributes for user ${remoteUser.uid}`,
              e
            );
          }

          // Extract attributes
          const name = attributes.name || "Unknown";
          const company = attributes.comp || "";
          const designation = attributes.desg || "";

          // Check if user already exists in participantList
          const userExists = config.participantList.some(
            (participant) => participant.uid === remoteUser.uid
          );

          if (!userExists) {
            // Add remote user's info to participantList
            config.participantList.push({
              uid: remoteUser.uid,
              name: name,
              company: company,
              designation: designation,
            });
          }

          // Ensure the user is fully joined and the wrapper is ready
          await handleUserJoined(remoteUser, config);

          // Subscribe to both video and audio tracks if available
          if (remoteUser.videoTrack) {
            await config.client.subscribe(remoteUser, "video"); // Subscribe to video
            await handleUserPublished(remoteUser, "video", config); // Handle video
          }

          if (remoteUser.audioTrack) {
            await config.client.subscribe(remoteUser, "audio"); // Subscribe to audio
            await handleUserPublished(remoteUser, "audio", config); // Handle audio
          }
        }
      }
    }

    // Notify with the list of participants' UIDs and other info
    if (typeof bubble_fn_participantList === "function") {
      const participantUIDs = config.participantList.map((p) => p.uid);
      const participantNames = config.participantList.map((p) => p.name);
      const participantCompanies = config.participantList.map((p) => p.company);
      const participantDesignations = config.participantList.map(
        (p) => p.designation
      );

      bubble_fn_participantList({
        outputlist1: JSON.stringify(participantUIDs),
        outputlist2: JSON.stringify(participantNames),
        outputlist3: JSON.stringify(participantCompanies),
        outputlist4: JSON.stringify(participantDesignations),
      });
    }

    // Handle token renewal
    config.client.on("token-privilege-will-expire", handleRenewToken);

    // Notify success using bubble_fn_joining
    if (typeof bubble_fn_joining === "function") {
      bubble_fn_joining("Joined");
    }
  } catch (error) {
    console.error("Error before joining:", error);

    // Notify error using bubble_fn_joining
    if (typeof bubble_fn_joining === "function") {
      bubble_fn_joining("Error");
    }
  }
};




  // RTM Join function
const joinRTM = async (rtmToken, retryCount = 0) => {
  try {
    const rtmUid = config.uid.toString();
    console.log("rtmuid value", rtmUid);

    if (config.clientRTM._logined) {
      await config.clientRTM.logout();
    }

    // Login to RTM
    await config.clientRTM.login({ uid: rtmUid, token: rtmToken });

    // Set user attributes, including the role
    const attributes = {
      name: config.user.name || "Unknown",
      avatar: config.user.avatar || "default-avatar-url",
      comp: config.user.company || "",
      desg: config.user.designation || "",
      role: config.user.role || "audience", // Add the role to RTM attributes
    };

    await config.clientRTM.setLocalUserAttributes(attributes); // Store attributes in RTM

    await config.channelRTM.join();
  } catch (error) {
    if (error.code === 5 && retryCount < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return joinRTM(rtmToken, retryCount + 1);
    } else {
      throw new Error("Failed to join RTM after multiple attempts");
    }
  }
};

  // Join video stage function
const joinToVideoStage = async (config) => {
  try {
    const { user, client } = config;

    // Create and publish the local audio track if it doesn't exist
    if (!config.localAudioTrack) {
      console.log("Creating microphone audio track");
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    }

    // Check if the local audio track is created successfully
    if (config.localAudioTrack) {
      console.log("Microphone audio track created successfully");
    } else {
      console.error("Failed to create local audio track");
    }

    // Create and publish the local video track if it doesn't exist
    if (!config.localVideoTrack) {
      console.log("Creating camera video track");
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    }

    // Check if the local video track is created successfully
    if (config.localVideoTrack) {
      console.log("Camera video track created successfully");
    } else {
      console.error("Failed to create local video track");
    }

    // Publish the local tracks (audio and video)
    console.log("Publishing local audio and video tracks");
    await client.publish([config.localAudioTrack, config.localVideoTrack]);

    console.log("Successfully published local audio and video tracks");

    // Add the current user wrapper (for their own video/audio stream)
    await addUserWrapper({ uid: config.uid, ...config.user }, config);

    // Select the video player and avatar elements for the current user
    const videoPlayer = document.querySelector(`#stream-${config.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${config.uid}`);

    // Ensure the video player and avatar elements are found
    if (!videoPlayer || !avatarDiv) {
      console.error(
        "Video player or avatar elements not found for current user"
      );
      return;
    }

    // Use toggleVideoOrAvatar to handle the video/stream visibility
    toggleVideoOrAvatar(
      config.uid,
      config.localVideoTrack,
      avatarDiv,
      videoPlayer
    );

    // Use toggleMicIcon to handle the mic icon (assumes mic is unmuted by default)
    const isMuted = config.localAudioTrack.muted || false;
    toggleMicIcon(config.uid, isMuted);

    console.log("Joined the video stage for the current user");
  } catch (error) {
    console.error("Error in joinToVideoStage", error);
  }
};



  return {
    config,
    join,
    joinToVideoStage,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
  };
};

window["newMainApp"] = newMainApp;



