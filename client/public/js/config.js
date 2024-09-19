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

  // Callback functions (initialize as null)
  onParticipantsChanged: null,
  onParticipantLeft: null,
  onVolumeIndicatorChanged: null,
  onMessageReceived: null,
  onMicMuted: null,
  onCamMuted: null,
  onScreenShareEnabled: null,
  onUserLeave: null,
  onCameraChanged: null,
  onMicrophoneChanged: null,
  onSpeakerChanged: null,
  onRoleChanged: null,
  onNeedJoinToVideoStage: null,
  onNeedMuteCameraAndMic: null,
  onError: (error) => {
    console.error("Error:", error);
  },
};
