import * as eventHandlers from "./eventHandlers.js";

export function initAgoraApp(
  channelName,
  uid,
  role,
  name,
  avatar,
  options = {}
) {
  const config = {
    appId: "88eb7ea8de544d68a718601966c086ce",
    callContainerSelector: "#video-stage",
    serverUrl: "https://agora-new.vercel.app",
    channelName: channelName,
    uid: uid,
    user: {
      id: uid,
      name: name,
      avatar: avatar,
      role: role,
    },
    participantPlayerContainer: options.participantPlayerContainer || "",

    // Binding all necessary event handlers
    onParticipantsChanged: eventHandlers.handleOnUpdateParticipants,
    onParticipantLeft:eventHandlers.handleUserLeft,
    onMessageReceived:eventHandlers.handleMessageReceived,
    onMicMuted: eventHandlers.handleMicMuted,
    onCamMuted:eventHandlers.handleCamMuted,
    onScreenShareEnabled:eventHandlers.handleScreenShareEnded,
    onUserLeave: eventHandlers.handleUserLeft,
    onError:eventHandlers.handleError,
    onCameraChanged:eventHandlers.handleCameraChanged,
    onMicrophoneChanged:eventHandlers.handleMicrophoneChanged,
    onSpeakerChanged:eventHandlers.handleSpeakerChanged,
    onRoleChanged:eventHandlers.handleRoleChanged,
    onNeedJoinToVideoStage:eventHandlers.handleJoinToVideoStage,
    onNeedMuteCameraAndMic:eventHandlers.handleMuteCameraAndMic,
    onVolumeIndicatorChanged:eventHandlers.handleVolumeIndicator,
    handleUserPublished: eventHandlers.handleUserPublished,
    handleUserUnpublished: eventHandlers.handleUserUnpublished,
    handleUserJoined: eventHandlers.handleUserJoined,
    handleScreenShareEnded: eventHandlers.handleScreenShareEnded,
    handleRenewToken: eventHandlers.handleRenewToken,
  };

  // Initialize the main Agora app
  const mainApp = MainApp(config);

  console.log("MainApp initialized:", mainApp);

  // Store mainApp globally for access later
  window.mainApp = mainApp;

  // Call the join method after initialization
  mainApp.join();

  return mainApp;
}
