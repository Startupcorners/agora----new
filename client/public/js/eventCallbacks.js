  export const onCameraChanged= (info) => {
    console.log("camera-changed", info.state, info.device);
  }

  export const onMicrophoneChanged = (info) => {
    console.log("microphone-changed", info.state, info.device);
  }

  export const onPlaybackDeviceChanged = (info) => {
  console.log("Playback device changed!", info.state, info.device);
}