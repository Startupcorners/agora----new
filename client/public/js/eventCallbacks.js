export const eventCallbacks = (config, clientRTM) => ({
   onVolumeIndicatorChanged: (volume) => {
    console.log("onVolumeIndicatorChanged", volume);
  },

  onCameraChanged: (info) => {
    console.log("Camera changed:", info.state, info.device);
  },

  onMicrophoneChanged: (info) => {
    console.log("Microphone changed:", info.state, info.device);
  },

  onPlaybackDeviceChanged: (info) => {
  console.log("Playback device changed!", info.state, info.device);
},

  onSpeakerChanged: (info) => {
    console.log("Speaker changed:", info.state, info.device);
  },

  onRoleChanged: (uid, role) => {
    console.log(`Role changed for UID ${uid}: ${role}`);
  },

  onNeedMuteCameraAndMic: (user) => {
    console.log(`onNeedMuteCameraAndMic: ${user}`);
    return false;
  },

  onError: (error) => {
    console.error("Error occurred:", error);
  },
});

