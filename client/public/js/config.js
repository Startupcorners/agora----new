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
  onNeedMuteCameraAndMic: (user) => {
    console.log(`Default onNeedMuteCameraAndMic for user: ${user.id}`);
    return false; // Default behavior, not muting mic or camera
  },
  onVolumeIndicatorChanged: (volume) => {
    console.log("Default onVolumeIndicatorChanged:", volume);
    // Default behavior, e.g., display volume levels
  },
};
