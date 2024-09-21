import * as eventHandlers from "./eventHandlers.js";

export function initAgoraApp(
  channelName,
  uid,
  role,
  name,
  avatar,
  options = {}
) {
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
  const config = {
    appId: "88eb7ea8de544d68a718601966c086ce",
    callContainerSelector: "#video-stage",
    serverUrl: "https://agora-new.vercel.app",
    channelName: channelName,
    uid: uid,
    user: {
      id: uid,
      name: name, // Pass user name
      avatar: avatar, // Pass user avatar
      role: role, // Set user role as host/audience
    },
    participantPlayerContainer: templateVideoParticipant,
  };

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

    // **Event handlers - Pass the actual function references directly**
    onParticipantsChanged: (participants) => {
      console.log("Participants updated:", participants);
      // Any custom logic you want to handle with the participants
    },
    onParticipantLeft: eventHandlers.handleUserLeft(config),
    onMessageReceived: eventHandlers.handleMessageReceived(config),
    onMicMuted: eventHandlers.handleMicMuted(config),
    onCamMuted: eventHandlers.handleCamMuted(config),
    onScreenShareEnabled: eventHandlers.handleScreenShareEnabled(config),
    onUserLeave: eventHandlers.handleUserLeave(config),
    onError: eventHandlers.handleError(config),
    onCameraChanged: eventHandlers.handleCameraChanged(config),
    onMicrophoneChanged: eventHandlers.handleMicrophoneChanged(config),
    onSpeakerChanged: eventHandlers.handleSpeakerChanged(config),
    onRoleChanged: eventHandlers.handleRoleChanged(config),
    onNeedJoinToVideoStage: eventHandlers.handleNeedJoinToVideoStage(config),
    onNeedMuteCameraAndMic: eventHandlers.handleNeedMuteCameraAndMic(config),
    onVolumeIndicatorChanged: eventHandlers.handleVolumeIndicator(config),
  });

  console.log("MainApp initialized:", mainApp);
  window.mainApp = mainApp;

  // **Bind the event handlers that need mainApp after initialization**
  mainApp.handleUserPublished = eventHandlers.handleUserPublished(mainApp);
  mainApp.handleUserUnpublished = eventHandlers.handleUserUnpublished(mainApp);
  mainApp.handleUserJoined = eventHandlers.handleUserJoined(mainApp);
  mainApp.handleScreenShareEnded =
    eventHandlers.handleScreenShareEnded(mainApp);
  mainApp.handleRenewToken = eventHandlers.handleRenewToken(mainApp);

  mainApp.join().catch((error) => {
    console.error("Error during mainApp.join():", error);
  });

  return mainApp;
}

window.initAgoraApp = initAgoraApp;
