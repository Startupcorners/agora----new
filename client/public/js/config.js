// config.js
export const defaultConfig = {
  debugEnabled: true,
  callContainerSelector: null,
  participantPlayerContainer: null,
  appId: null,
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
  serverUrl: null,
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
  // Callback functions
  onParticipantsChanged: (participantIds) => {
    console.log("onParticipantsChanged");
    console.log(participantIds);
  },
  onParticipantLeft: (user) => {
    console.log("onParticipantLeft");
    console.log(user);
  },
  onVolumeIndicatorChanged: (volume) => {
    console.log("onVolumeIndicatorChanged");
    console.log(volume);
  },
  onMessageReceived: (messageObj) => {
    console.log("onMessageReceived");
    console.log(messageObj);
  },
  onMicMuted: (isMuted) => {
    console.log("onMicMuted");
    console.log(isMuted);
  },
  onCamMuted: (isMuted) => {
    console.log("onCamMuted");
    console.log(isMuted);
  },
  onScreenShareEnabled: (enabled) => {
    console.log("onScreenShareEnabled");
    console.log(enabled);
  },
  onUserLeave: () => {
    console.log("onUserLeave");
  },
  onCameraChanged: (info) => {
    console.log("camera changed!", info.state, info.device);
  },
  onMicrophoneChanged: (info) => {
    console.log("microphone changed!", info.state, info.device);
  },
  onSpeakerChanged: (info) => {
    console.log("speaker changed!", info.state, info.device);
  },
  onRoleChanged: (uid, role) => {
    console.log(`current uid: ${uid}  role: ${role}`);
  },
  onNeedJoinToVideoStage: (user) => {
    console.log(`onNeedJoinToVideoStage: ${user}`);
    return true;
  },
  onNeedMuteCameraAndMic: (user) => {
    console.log(`onNeedMuteCameraAndMic: ${user}`);
    return false;
  },
  onError: (error) => {
    console.log(`onError: ${error}`);
  },
};
