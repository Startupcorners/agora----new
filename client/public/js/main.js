import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import {
  startRecording,
  stopRecording,
  acquireResource,
} from "./recordingHandlers.js";

import {
  changeRole,
  handleUserPublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
  handleScreenShareEnded,
  handleRenewToken,
  handleMessageFromPeer,
  handleChannelMessage,
  handleRoleChange,
  joinToVideoStage,
  leave,
  leaveFromVideoStage,
  handleUserUnpublished,
  subscribe,
  checkAndAddMissingWrappers,
  handleMemberJoined,
  handleMemberLeft,
  setupRTMEventListeners,
  setupEventListeners,
  removeParticipant,
  handleOnUpdateParticipants,
} from "./eventHandlers.js";

import {
  toggleMic,
  toggleCamera,
  toggleScreenShare,
  turnOffMic,
  turnOffCamera,
} from "./uiHandlers.js";

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
      role: "", //host, speaker, audience, etc
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

  // Apply event callbacks
  config = { ...config, ...initConfig };
  config.client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

  // Ensure config is fully initialized before passing to eventCallbacks
  const callbacks = eventCallbacks(config);

  // Now spread the callbacks into the config
  config = { ...config, ...callbacks };

  if (
    !config.appId ||
    !config.callContainerSelector ||
    !config.serverUrl ||
    !config.channelName ||
    !config.uid
  ) {
    throw new Error("Required config parameters are missing.");
  }

  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); // 0 for debug, 4 for none
  AgoraRTC.onCameraChanged = (info) => config.onCameraChanged(info);
  AgoraRTC.onMicrophoneChanged = (info) => config.onMicrophoneChanged(info);
  AgoraRTC.onPlaybackDeviceChanged = (info) => config.onSpeakerChanged(info);

  const clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });

  const channelRTM = clientRTM.createChannel(config.channelName);

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

    // Handle token renewal
    config.client.on("token-privilege-will-expire", handleRenewToken);

    // Setup event listeners for client (user-published, user-unpublished, etc.)
    setupEventListeners(config);

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

    // Initialize clientRTM if it's not already initialized
    if (!config.clientRTM) {
      config.clientRTM = AgoraRTM.createInstance(config.appId, {
        enableLogUpload: false,
        logFilter: config.debugEnabled
          ? AgoraRTM.LOG_FILTER_INFO
          : AgoraRTM.LOG_FILTER_OFF,
      });
    }

    // Initialize channelRTM if it's not already initialized
    if (!config.channelRTM) {
      config.channelRTM = config.clientRTM.createChannel(config.channelName);
    }

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

    // Update participants
    await handleOnUpdateParticipants(config, config.clientRTM);

    // Set up RTM event listeners
    setupRTMEventListeners(config.clientRTM, config.channelRTM, config);

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


return {
  config,
  clientRTM,
  client: config.client,
  join,
  joinToVideoStage,
  leaveFromVideoStage,
  leave,
  toggleMic,
  toggleCamera,
  toggleScreenShare,
  turnOffMic: (...uids) => turnOffMic(clientRTM, ...uids),
  turnOffCamera: (...uids) => turnOffCamera(clientRTM, ...uids),
  removeParticipant: (...uids) => removeParticipant(clientRTM, ...uids),
  changeRole: (uid, role) => changeRole(uid, role, config),
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
