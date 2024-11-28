import {join} from "./join.js";
import {
  setupEventListeners,
  setupRTMMessageListener,
  checkMicrophonePermissions,
} from "./setupEventListeners.js"; // Import RTM and RTC event listeners

import { handleRenewToken, manageParticipants } from "./rtcEventHandlers.js"; // Token renewal handler
import {
  fetchTokens,
  switchCam,
  switchMic,
  switchSpeaker,
  fetchAndSendDeviceList,
  updateSelectedDevices,
} from "./helperFunctions.js";

import { addUserWrapper, removeUserWrapper } from "./wrappers.js";

import {
  startCloudRecording,
  stopCloudRecording,
  startAudioRecording,
  stopAudioRecording,
} from "./recordingHandlers.js";
import { toggleVirtualBackground } from "./virtualBackgroundHandlers.js";

import {
  toggleMic,
  toggleCamera,
  toggleScreenShare,
  changeUserRole,
  updateMicStatusElement,
  stopUserScreenshare,
  stopUserMic,
  stopUserCamera,
  updatePublishingList,
  leave,
  denyAccess,
  raiseHand,
} from "./uiHandlers.js"; // Import toggle functions from uiHandlers

import { getConfig, updateAndGet, updateConfig } from "./config.js";

export const newMainApp = async function (initConfig) {
  console.log("newMainApp called with initConfig:", initConfig);

  // Update the configuration
  let config = await updateAndGet(initConfig, "newMainApp");
  console.log(config);

  // Initialize AgoraRTC client
  config.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  // Initialize the Virtual Background extension
  try {
    console.log("Initializing Virtual Background Extension...");

    let extension = new VirtualBackgroundExtension();

    // Check for compatibility before proceeding
    console.log("Checking for compatibility...");
    if (!extension.checkCompatibility()) {
      console.error("Browser does not support Virtual Background.");
      return;
    }
    console.log("Browser is compatible with Virtual Background.");

    // Register the extension
    console.log("Registering Virtual Background extension...");
    AgoraRTC.registerExtensions([extension]);
    console.log("Virtual Background extension registered successfully.");

    // Attach the extension to the config
    console.log("Attaching extension and processor to config...");
    config.extensionVirtualBackground = extension;
    console.log("Extension and processor attached to config.");
  } catch (error) {
    console.error(
      "Failed to initialize the Virtual Background extension:",
      error
    );
  }

  // Ensure required config parameters are present
  console.log(config);
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
  setupEventListeners(config);
  checkMicrophonePermissions(config);

  // Update the config again with the new properties
  updateConfig(config, "newMainApp");

  // Call the join function at the end
  try {
    console.log("Attempting to join...");
    await join(config); // Ensure `join` is properly imported and is asynchronous
    console.log("Join successful.");
  } catch (error) {
    console.error("Failed to join:", error);
    throw error; // Re-throw the error if join fails
  }

  // Return the API
  return {
    toggleMic,
    leave,
    toggleVirtualBackground,
    toggleCamera,
    denyAccess,
    switchCam,
    switchMic,
    switchSpeaker,
    changeUserRole,
    toggleScreenShare,
    fetchAndSendDeviceList,
    startCloudRecording,
    stopCloudRecording,
    startAudioRecording,
    raiseHand,
    stopAudioRecording,
    sendRTMMessage,
    stopUserCamera, // Add stop camera function
    stopUserMic, // Add stop mic function
    stopUserScreenshare,
  };
};


window["newMainApp"] = newMainApp;
