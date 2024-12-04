import {toggleMic} from "./audio.js"
import { switchCam, switchMic, switchSpeaker, updateSelectedDevices } from "./handleDevices.js";
import {
  toggleCamera,
  toggleScreenShare,
  toggleVirtualBackground,
} from "./video.js";
import { join, leave } from "./joinLeaveLocalUser.js";
import { fetchAndSendDeviceList } from "./talkToBubble.js";
import {
  startAudioRecording,
  stopAudioRecording,
  startCloudRecording,
  stopCloudRecording,
} from "./recordingHandlers.js";
import {
  denyAccess,
  raiseHand,
  stopUserCamera,
  stopUserMic,
  stopUserScreenshare,
  changeUserRole,
} from "./uiHandlers.js";
import {
  templateVideoParticipant
} from "./templates.js";
import {
  setupEventListeners,
  setupRTMMessageListener,
  setupLeaveListener,
  checkMicrophonePermissions,
  initializeInactivityTracker,
  stillPresent,
  noHosts,
  hostJoined
} from "./setupEventListeners.js";

export const newMainApp = async function (initConfig) {
  console.log("newMainApp called with initConfig:", initConfig);

  let config = {
    debugEnabled: true,
    callContainerSelector: "#video-stage",
    participantPlayerContainer: templateVideoParticipant,
    appId: "95e91980e5444a8e86b4e41c7f03b713",
    uid: null,
    user: {
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
    audioRecordingRTMClient: null,
    extensionVirtualBackground: null,
    resourceId: null,
    recordId: null,
    audioResourceId: null,
    audioRecordId: null,
    audioTimestamp: null,
    timestamp: null,
    sid: null,
    audioSid: null,
  };

  config = { ...config, ...initConfig };

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

  config.clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });

  // Initialize RTM Channel
  config.channelRTM = config.clientRTM.createChannel(config.channelName);
  setupRTMMessageListener(config);
  setupEventListeners(config);
  setupLeaveListener(config);
  checkMicrophonePermissions(config);
  updateSelectedDevices(config);
  if (config.uid <= 999999999 && config.uid != 2) {
  initializeInactivityTracker(config);
  }

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
    config,
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
    stillPresent,
    raiseHand,
    noHosts,
    hostJoined,
    stopAudioRecording,
    stopUserCamera, // Add stop camera function
    stopUserMic, // Add stop mic function
    stopUserScreenshare,
  };
};


window["newMainApp"] = newMainApp;
