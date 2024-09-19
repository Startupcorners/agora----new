// main.js
import { defaultConfig } from "./config.js";
import { log, debounce, imageUrlToBase64 } from "./utils.js";
import { setupAgoraRTCClient } from "./agoraRTCClient.js";
import { setupAgoraRTMClient } from "./agoraRTMClient.js";
import { recordingFunctions } from "./recording.js";
import { handleOnUpdateParticipants } from "./eventHandlers.js";

export function MainApp(initConfig) {
  let config = { ...defaultConfig, ...initConfig };

  // Perform required config checks
  if (!config.appId) throw new Error("Please set the appId first");
  if (!config.callContainerSelector)
    throw new Error("Please set the callContainerSelector first");
  if (!config.serverUrl) throw new Error("Please set the serverUrl first");
  if (!config.participantPlayerContainer)
    throw new Error("Please set the participantPlayerContainer first");
  if (!config.channelName) throw new Error("Please set the channelName first");
  if (!config.uid) throw new Error("Please set the uid first");

  // Initialize Agora clients
  const client = setupAgoraRTCClient(config);
  const { clientRTM, channelRTM } = setupAgoraRTMClient(config);
  config.clientRTM = clientRTM; // Add clientRTM to config for access in handlers
  config.channelRTM = channelRTM;
  config.client = client;

  // Initialize recording functions
  const { acquireResource, startRecording, stopRecording } =
    recordingFunctions(config);

  // Other necessary initializations (e.g., extensions)
  const extensionVirtualBackground = new VirtualBackgroundExtension();
  if (!extensionVirtualBackground.checkCompatibility()) {
    log("Does not support Virtual Background!", config);
  }
  AgoraRTC.registerExtensions([extensionVirtualBackground]);
  let processor = null;

  // Define your functions here (include all functions from the original code)

  // Include all other functions as per your original `main.js`

  // Return the methods you want to expose
  return {
    config,
    clientRTM,
    client,
    join,
    joinToVideoStage,
    leaveFromVideoStage,
    leave,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    turnOffMic,
    turnOffCamera,
    changeRole,
    getCameras,
    getMicrophones,
    switchCamera,
    switchMicrophone,
    removeParticipant,
    sendChat,
    sendBroadcast,
    enableVirtualBackgroundBlur,
    enableVirtualBackgroundImage,
    disableVirtualBackground,
    acquireResource,
    startRecording,
    stopRecording,
  };
}

window["MainApp"] = MainApp;
