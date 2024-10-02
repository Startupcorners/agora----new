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

    // **Subscribe to existing remote users' media tracks (video/audio)**
    const remoteUsers = config.client.remoteUsers;
    const participantUIDs = [config.uid]; // Initialize list with the current user's UID

    if (remoteUsers && remoteUsers.length > 0) {
      console.log(`Subscribing to ${remoteUsers.length} remote users`);
      for (const remoteUser of remoteUsers) {
        participantUIDs.push(remoteUser.uid); // Add remote user UID to the list

        // Ensure the user is fully joined and the wrapper is ready
        await handleUserJoined(remoteUser, config);

        // Handle already published tracks (only subscribe if needed)
        if (remoteUser.videoTrack) {
          await handleUserPublished(remoteUser, "video", config);
        }

        if (remoteUser.audioTrack) {
          await handleUserPublished(remoteUser, "audio", config);
        }
      }
    }

    // Notify with the list of participants' UIDs
    if (typeof bubble_fn_participantList === "function") {
      bubble_fn_participantList(participantUIDs);
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

    // Ensure the local audio track is playing for the current user
    if (!isMuted) {
      console.log("Playing local audio track for current user");
      config.localAudioTrack.play();
    } else {
      console.warn("Local audio track is muted");
    }

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



