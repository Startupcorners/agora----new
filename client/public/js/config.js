import * as eventHandlers from "./eventHandlers.js";
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

export const defaultConfig = {
  debugEnabled: true,
  callContainerSelector: "#video-stage",
  participantPlayerContainer: null,
  serverUrl: "https://agora-new.vercel.app",
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
    profileLink: "",
  },
  participantPlayerContainer: templateVideoParticipant,
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

  // Callback functions (initialize as null)
  onParticipantsChanged: eventHandlers.handleOnUpdateParticipants(config),
  onParticipantLeft: eventHandlers.handleUserLeft(config),
  onVolumeIndicatorChanged: eventHandlers.handleVolumeIndicator(config),
  onMessageReceived: eventHandlers.handleMessageReceived(config),
  onMicMuted: eventHandlers.handleMicMuted(config),
  onCamMuted: eventHandlers.handleCamMuted(config),
  onScreenShareEnabled: eventHandlers.handleScreenShareEnabled(config),
  onUserLeave: eventHandlers.handleUserLeave(config),
  onCameraChanged: eventHandlers.handleCameraChanged(config),
  onMicrophoneChanged: eventHandlers.handleMicrophoneChanged(config),
  onSpeakerChanged: eventHandlers.handleSpeakerChanged(config),
  onRoleChanged: eventHandlers.handleRoleChanged(config),
  onNeedJoinToVideoStage: eventHandlers.handleNeedJoinToVideoStage(config),
  onNeedMuteCameraAndMic: eventHandlers.handleNeedMuteCameraAndMic(config),
  onError: eventHandlers.handleError(config),
};

console.log("Config appId:", defaultConfig.appId);
