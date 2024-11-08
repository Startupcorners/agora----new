import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import {
  setupEventListeners,
  setupRTMMessageListener,
} from "./setupEventListeners.js"; // Import RTM and RTC event listeners
import { handleRenewToken, manageParticipants } from "./rtcEventHandlers.js"; // Token renewal handler
import { fetchTokens } from "./helperFunctions.js";
import { addUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";
import {
  toggleMic,
  toggleCamera,
  toggleScreenShare,
  changeUserRole,
} from "./uiHandlers.js"; // Import toggle functions from uiHandlers
import { userTracks } from "./state.js";


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
      role: "", // host, audience (for rtc and rtm)
      company: "",
      rtmUid: "",
      designation: "",
      profileLink: "",
      uidSharingScreen: "",
      bubbleid: "",
      isRaisingHand: "no",
      roleInTheCall: "", // host, speaker, audience (for ui)
    },
    serverUrl: "https://agora-new.vercel.app",
    token: null,
    channelName: null,
    localAudioTrackMuted: false, // These are needed in config
    localVideoTrackMuted: true,
    isVirtualBackGroundEnabled: false,
    cameraToggleInProgress: false,
    // Remove localVideoTrack, localAudioTrack, etc.
  };

  // Apply initial config
  config = { ...config, ...initConfig };

  // Initialize AgoraRTC client
  config.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

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
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });

  // Initialize RTM Channel
  config.channelRTM = config.clientRTM.createChannel(config.channelName);
  setupRTMMessageListener(config.channelRTM, manageParticipants, config);

  // Initialize event callbacks with clientRTM passed
  const callbacks = eventCallbacks(config, config.clientRTM);
  config = { ...config, ...callbacks };

  // Main join function
const join = async () => {
  bubble_fn_role(config.user.roleInTheCall);
  try {
    // Fetch RTC and RTM tokens
    const tokens = await fetchTokens(config);
    if (!tokens) throw new Error("Failed to fetch token");

    // Ensure the user has a role assigned
    if (!config.user.role) {
      throw new Error("User does not have a role assigned.");
    }

    // Check if RTM is already connected
    if (!config.clientRTM._logined) {
      // Join RTM
      await joinRTM(tokens.rtmToken);
    } else {
      console.log("RTM client already logged in; skipping joinRTM.");
    }

    // Check if the user is in the waiting room
    if (config.user.roleInTheCall === "waiting") {
      console.log("User is in the waiting room; skipping RTC join.");

      // Send a message via RTM to indicate the user is in the waiting room
      await sendRTMMessage(`User ${config.user.name} is in the waiting room`);
      await sendRTMMessage("trigger_manage_participants");

      return; // Exit the function without joining RTC
    }

    console.log("config.uid before joining RTC", config.uid);
    await config.client.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      config.uid
    );

    console.log("config.uid before setting up listeners", config.uid);
    setupEventListeners(config); // Setup RTC listeners

    // If the user is a host, proceed with video and screen share setup
    if (config.user.role === "host") {
      await joinToVideoStage(config); // Host-only functionality
    }

    // Call manageParticipants without the config parameter
    manageParticipants(config.uid, config.user, "join");

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



  // Function to send an RTM message to the channel
  const sendRTMMessage = async (message) => {
    try {
      if (config.channelRTM) {
        await config.channelRTM.sendMessage({ text: message });
        console.log("Message sent to RTM channel:", message);
      } else {
        console.warn("RTM channel is not initialized.");
      }
    } catch (error) {
      console.error("Failed to send RTM message:", error);
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
      company: config.user.company || "Unknown",
      designation: config.user.designation || "Unknown",
      role: config.user.role || "audience",
      rtmUid: rtmUid,
      bubbleid: config.user.bubbleid,
      isRaisingHand: config.user.isRaisingHand,
      sharingScreen: "0",
      roleInTheCall: config.user.roleInTheCall || "audience",
    };

    await config.clientRTM.setLocalUserAttributes(attributes); // Store attributes in RTM

    // **Create the RTM channel and assign it to config.channelRTM**
    if (!config.channelRTM) {
      config.channelRTM = config.clientRTM.createChannel(config.channelName);
      console.log("RTM channel created with name:", config.channelName);
    }

    // **Join the RTM channel**
    await config.channelRTM.join();
    console.log("Successfully joined RTM channel:", config.channelName);
  } catch (error) {
    if (error.code === 5 && retryCount < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return joinRTM(rtmToken, retryCount + 1);
    } else {
      console.error("Failed to join RTM after multiple attempts:", error);
      throw error;
    }
  }
};

  // Join video stage function
  const joinToVideoStage = async (config) => {
    try {
      const { client, uid } = config;

      // Create and publish the local audio track if it doesn't exist
      if (!config.localAudioTrack) {
        console.log("Creating microphone audio track");
        config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }

      if (config.localAudioTrack) {
        console.log("Microphone audio track created successfully");
      } else {
        console.error("Failed to create local audio track");
      }

      // Create the local video track if it doesn't exist, but DO NOT publish it
      if (!config.localVideoTrack) {
        console.log(
          "Creating camera video track (muted and unpublished initially)"
        );
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await config.localVideoTrack.setEnabled(false); // Keep video muted initially
        config.localVideoTrackMuted = true; // Track that the video is muted
        console.log("Video track created but kept muted and unpublished");
      }

      // Publish only the local audio track
      console.log("Publishing local audio track");
      await client.publish([config.localAudioTrack]);

      console.log("Successfully published local audio track");
      console.log("Checking uid:", uid);

      // Update the userTrack object to reflect the "camera off" state
      let updatedUserTrack = userTracks[uid] ? { ...userTracks[uid] } : {};

      updatedUserTrack = {
        ...updatedUserTrack,
        videoTrack: null, // Initially set to null (camera off state)
        screenShareTrack: config.localScreenShareTrack || null,
        isVideoMuted: true, // Camera is off initially
      };

      // Reassign the updated user track back to the global userTracks object
      userTracks[uid] = updatedUserTrack;

      // Add the current user wrapper (for their own video/audio stream)
      await addUserWrapper({ uid, ...config.user }, config);

      // Select the video player and avatar elements for the current user
      const videoPlayer = document.querySelector(`#stream-${uid}`);
      const avatarDiv = document.querySelector(`#avatar-${uid}`);

      // Ensure the video player and avatar elements are found
      if (!videoPlayer || !avatarDiv) {
        console.error(
          "Video player or avatar elements not found for current user"
        );
        return;
      }

      // Show avatar and hide video initially since the camera is off
      toggleVideoOrAvatar(uid, null, avatarDiv, videoPlayer);

      // Use toggleMicIcon to handle the mic icon (assumes mic is unmuted by default)
      const isMuted = config.localAudioTrack.muted || false;
      toggleMicIcon(uid, isMuted);

      console.log(
        "Joined the video stage with the camera off and active audio"
      );
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
    changeUserRole,
    toggleScreenShare,
    userTracks,
  };
};

window["newMainApp"] = newMainApp;



