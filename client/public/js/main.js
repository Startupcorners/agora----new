import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import {
  startRecording,
  stopRecording,
  acquireResource,
} from "./recordingHandlers.js";

import { setupEventListeners } from "./setupEventListeners.js"; // Import RTM and RTC event listeners

import {
  handleUserPublished,
  handleUserUnpublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
  handleRenewToken,
} from "./rtcEventHandlers.js"; // New RTC Event Handler imports

import { toggleMic, toggleCamera, toggleScreenShare } from "./uiHandlers.js"; 

import {
  log,
  debounce,
  sendMessageToPeer,
  fetchTokens,
  sendBroadcast,
  getCameras,
  getMicrophones,
  switchCamera,
  switchMicrophone,
  sendChat,
} from "./helperFunctions.js";


import {
  getProcessorInstance,
  imageUrlToBase64,
  enableVirtualBackgroundBlur,
  enableVirtualBackgroundImage,
  disableVirtualBackground,
} from "./virtualBackgroundHandlers.js"; // Moved to a dedicated virtual background handler file

const newMainApp = function (initConfig) {
  let screenClient;
  let localScreenShareTrack;
  let wasCameraOnBeforeSharing = false;
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
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });

  // Initialize RTM Channel
  config.channelRTM = config.clientRTM.createChannel(config.channelName);

  // Initialize event callbacks with clientRTM passed
  const callbacks = eventCallbacks(config, config.clientRTM);

  // Merge the callbacks into config
  config = { ...config, ...callbacks };

  const extensionVirtualBackground = new VirtualBackgroundExtension();
  if (!extensionVirtualBackground.checkCompatibility()) {
    log("Does not support Virtual Background!");
  }
  AgoraRTC.registerExtensions([extensionVirtualBackground]);
  let processor = null;

  const join = async () => {
    try {
      const tokens = await fetchTokens(config); // Fetch RTC and RTM tokens
      if (!tokens) throw new Error("Failed to fetch token");

      if (config.user.role === "host") {
        await config.client.setClientRole("host"); // Set the role to host for the client
      } else {
        await config.client.setClientRole("audience"); // Set as audience for non-hosts
      }

      // Join RTM and RTC
      await joinRTM(tokens.rtmToken);
      await config.client.join(
        config.appId,
        config.channelName,
        tokens.rtcToken,
        config.uid
      );


      setupEventListeners(config); // RTC listeners

      // Handle token renewal
      config.client.on("token-privilege-will-expire", handleRenewToken);

  

      // Subscribe to existing remote users (in case there are already participants in the room)
      const remoteUsers = config.client.remoteUsers || [];
      remoteUsers.forEach(async (user) => {
        // Subscribe to the existing users
        await handleUserJoined(user, config, config.clientRTM); // Add wrapper
        await subscribe(user, "video", config, config.client); // Subscribe to video
        await subscribe(user, "audio", config, config.client); // Subscribe to audio
      });

      // Check if the current user should join the video stage
      if (config.onNeedJoinToVideoStage(config.user)) {
        await joinToVideoStage(config);
      }

      // Notify Bubble or external callbacks
      if (typeof bubble_fn_joining === "function") {
        bubble_fn_joining("Joined");
      }
    } catch (error) {
      // Handle error and notify Bubble or external callbacks
      if (typeof bubble_fn_joining === "function") {
        console.log("Error before joining", error);
        bubble_fn_joining("Error");
      }
    }
  };

  const joinRTM = async (rtmToken, retryCount = 0) => {
    try {
      const rtmUid = config.uid.toString();

      // Log out if already logged in
      if (config.clientRTM._logined) {
        await config.clientRTM.logout();
      }

      // Login to RTM
      await config.clientRTM.login({ uid: rtmUid, token: rtmToken });

      // Set user attributes
      const attributes = {
        name: config.user.name || "Unknown",
        avatar: config.user.avatar || "default-avatar-url",
        comp: config.user.company || "",
        desg: config.user.designation || "",
      };
      await config.clientRTM.setLocalUserAttributes(attributes);  

      // Join the RTM channel
      await config.channelRTM.join();
    } catch (error) {
      if (error.code === 5 && retryCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Retry after 2 seconds
        return joinRTM(rtmToken, retryCount + 1);
      } else {
        throw new Error("Failed to join RTM after multiple attempts");
      }
    }
  };

  const joinToVideoStage = async (config) => {
    try {
      const { user, client } = config; // Access user and client directly from config

      // Initialize the audio track if it's not already created
      if (!config.localAudioTrack) {
        config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }

      // Publish only the audio track initially (video will be handled separately)
      if (user.id === config.uid) {
        await client.publish([config.localAudioTrack]);
      }
    } catch (error) {
      if (config.onError) {
        config.onError(error);
      }
    }
  };


  return {
    config,
    clientRTM: config.clientRTM,
    client: config.client,
    join,
    joinToVideoStage,
    leave,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    turnOffMic: (...uids) => turnOffMic(clientRTM, ...uids),
    turnOffCamera: (...uids) => turnOffCamera(clientRTM, ...uids),
    removeParticipant: (...uids) => removeParticipant(clientRTM, ...uids),
    getCameras,
    getMicrophones,
    switchCamera: (deviceId) => switchCamera(deviceId, config, client),
    switchMicrophone: (deviceId) => switchMicrophone(deviceId, config, client),
    sendChat: (data) => sendChat(config, data),
    sendBroadcast: (data) => sendBroadcast(config, data),
    enableVirtualBackgroundBlur: () => enableVirtualBackgroundBlur(config),
    enableVirtualBackgroundImage: (imageSrc) =>
      enableVirtualBackgroundImage(config, imageSrc),
    disableVirtualBackground: () => disableVirtualBackground(config),
    acquireResource,
    startRecording,
    stopRecording,
  };
};

window["newMainApp"] = newMainApp;
