import * as eventHandlers from "./eventHandlers.js";

export function initAgoraApp(
  channelName,
  uid,
  role,
  name,
  avatar,
  options = {}
) {
  const {
    onParticipantsChanged = eventHandlers.handleOnUpdateParticipants(options),
    onParticipantLeft = eventHandlers.handleUserLeft(options),
    onMessageReceived = eventHandlers.handleMessageReceived(options),
    onMicMuted = eventHandlers.handleMicMuted(options),
    onCamMuted = eventHandlers.handleCamMuted(options),
    onScreenShareEnabled = eventHandlers.handleScreenShareEnabled(options),
    onUserLeave = eventHandlers.handleUserLeave(options),
    onCameraChanged = eventHandlers.handleCameraChanged(options),
    onMicrophoneChanged = eventHandlers.handleMicrophoneChanged(options),
    onSpeakerChanged = eventHandlers.handleSpeakerChanged(options),
    onRoleChanged = eventHandlers.handleRoleChanged(options),
    onNeedJoinToVideoStage = eventHandlers.handleNeedJoinToVideoStage(options),
    onNeedMuteCameraAndMic = eventHandlers.handleNeedMuteCameraAndMic(options),
    onVolumeIndicatorChanged = eventHandlers.handleVolumeIndicator(options),
    onError = eventHandlers.handleError(options),
  } = options;

  // Set up the video stage element
  window["videoStage"] = document.querySelector("#video-stage");

  // Template for each video participant
  const templateVideoParticipant = `
    <div id="video-wrapper-{{uid}}" style="
      flex: 1 1 320px;
      max-width: 800px;
      min-height: 220px;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 5px;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
      background-color: #3c4043;
      box-sizing: border-box;
    " data-uid="{{uid}}">
      <!-- Video Player -->
      <div id="stream-{{uid}}" class="video-player" style="
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        object-fit: cover;
      "></div>
    
      <!-- User Avatar (shown when video is off) -->
      <img id="avatar-{{uid}}" class="user-avatar" src="{{avatar}}" alt="{{name}}'s avatar" style="
        display: none;
        width: 100px;
        height: 100px;
        border-radius: 50%;
        object-fit: cover;
      " />
    
      <!-- User Name -->
      <div id="name-{{uid}}" class="user-name" style="
        position: absolute;
        bottom: 10px;
        left: 10px;
        font-size: 16px;
        color: #fff;
        background-color: rgba(0, 0, 0, 0.5);
        padding: 5px 10px;
        border-radius: 5px;
      ">
        {{name}}
      </div>
    
      <!-- Participant Status Indicators -->
      <div class="status-indicators" style="
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 5px;
      ">
        <!-- Microphone Status Icon -->
        <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted" style="
          width: 24px;
          height: 24px;
          background-image: url('https://startupcorners-df3e7.web.app/icons/mic-muted.svg');
          background-size: contain;
          background-repeat: no-repeat;
          display: none;
        "></span>
      
        <!-- Camera Status Icon -->
        <span id="cam-status-{{uid}}" class="cam-status" title="Camera is off" style="
          width: 24px;
          height: 24px;
          background-image: url('icons/camera-off.svg');
          background-size: contain;
          background-repeat: no-repeat;
          display: none;
        "></span>
      </div>
    </div>
  `;

  // Initialize the MainApp with the necessary configurations
  const mainApp = MainApp({
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
    participantPlayerContainer: templateVideoParticipant,
    onParticipantsChanged: onParticipantsChanged,
    onParticipantLeft: onParticipantLeft,
    onMessageReceived: onMessageReceived,
    onMicMuted: onMicMuted,
    onCamMuted: onCamMuted,
    onScreenShareEnabled: onScreenShareEnabled,
    onUserLeave: onUserLeave,
    onCameraChanged: onCameraChanged,
    onMicrophoneChanged: onMicrophoneChanged,
    onSpeakerChanged: onSpeakerChanged,
    onRoleChanged: onRoleChanged,
    onNeedJoinToVideoStage: onNeedJoinToVideoStage,
    onNeedMuteCameraAndMic: onNeedMuteCameraAndMic,
    onVolumeIndicatorChanged: onVolumeIndicatorChanged,
    onError: onError,
    handleUserPublished: eventHandlers.handleUserPublished(options, mainApp),
    handleUserUnpublished: eventHandlers.handleUserUnpublished(options),
    handleMessageReceived: eventHandlers.handleMessageReceived(config),
    handleUserJoined: eventHandlers.handleUserJoined(options),
    handleUserLeft: eventHandlers.handleUserLeft(options),
    handleVolumeIndicator: eventHandlers.handleVolumeIndicator(options),
    handleScreenShareEnded: eventHandlers.handleScreenShareEnded(
      options,
      mainApp
    ),
    handleOnUpdateParticipants:
      eventHandlers.handleOnUpdateParticipants(options),
    handleRenewToken: eventHandlers.handleRenewToken(options, mainApp),
  });

  console.log("MainApp initialized:", mainApp);
  window.mainApp = mainApp;

  // Call the join method to join the channel
  mainApp.join();

  return mainApp;
}

window.initAgoraApp = initAgoraApp;
