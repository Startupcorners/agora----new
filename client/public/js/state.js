export const userTracks = {
  local: {
    videoTrack: null, // The video track for the local user
    screenShareTrack: null, // The screen sharing track for the local user
    isVideoMuted: true, // Tracks if the video is muted
    isScreenSharing: false, // Tracks if the user is sharing their screen
    cameraMuted: true, // Tracks if the camera is muted
    cameraToggleInProgress: false, // Tracks if the camera toggle is in progress
  },
  remote: {
    // Remote users will be dynamically added here by their UID
    // Example:
    // "remoteUID": {
    //   videoTrack: null,
    //   screenShareTrack: null,
    //   isVideoMuted: true,
    //   isScreenSharing: false,
    //   cameraMuted: true,
    // }
  },
};
