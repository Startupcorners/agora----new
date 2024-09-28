// rtcEventHandlers.js
import { toggleMic, toggleCamera } from "./uiHandlers.js";
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrapper.js";


// Handles user published event
export const handleUserPublished = async (user, mediaType, config) => {
  log("handleUserPublished Here");

  // Ensure remoteTracks is initialized
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Store the user's remote tracks
  config.remoteTracks[user.uid] = user;

  // Add the user's wrapper using the addUserWrapper function
  await addUserWrapper(user, config);

  const videoPlayer = document.querySelector(`#stream-${user.uid}`);
  const avatarDiv = document.querySelector(`#avatar-${user.uid}`);

  // Handle screen share track
  if (mediaType === "video" && user.videoTrack && user.videoTrack.isScreen) {
    log(`User ${user.uid} started sharing their screen`);
    videoPlayer.style.display = "block";
    avatarDiv.style.display = "none";
    user.videoTrack.play(videoPlayer);
  }
  // Handle regular video track
  else if (mediaType === "video" && user.videoTrack) {
    log(`User ${user.uid} published video`);
    videoPlayer.style.display = "block";
    avatarDiv.style.display = "none";
    user.videoTrack.play(videoPlayer);
  }

  // Handle audio track
  if (mediaType === "audio" && user.audioTrack) {
    log(`User ${user.uid} published audio`);
    user.audioTrack.play();
    updateMicIcon(user.uid, false); // Mic is unmuted
  }
};

export const handleUserUnpublished = async (user, mediaType, config) => {
  log("handleUserUnpublished Here");

  // Remove user's media wrapper if they unpublished video or screen share
  if (mediaType === "video") {
    log(`User ${user.uid} unpublished video or screen share`);
    await removeUserWrapper(user.uid);
  }

  // Handle audio unpublish (just update the mic icon)
  if (mediaType === "audio") {
    log(`User ${user.uid} unpublished audio`);
    updateMicIcon(user.uid, true); // Mic is muted
  }

  // Remove the user's tracks from the config
  delete config.remoteTracks[user.uid];
};

// Handles user joined event
export const handleUserJoined = async (user, config) => {
  console.log("Entering handleUserJoined function for user:", user.uid);

  // Initialize remoteTracks if it's undefined
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Store user in remoteTracks (no media yet)
  config.remoteTracks[user.uid] = user;

  log(`User ${user.uid} joined, waiting for media to be published.`);
};

// Handles user left event
export const handleUserLeft = async (user, config) => {
  log(`User ${user.uid} left`);

  // Remove the user's wrapper when they leave
  await removeUserWrapper(user.uid);

  // Remove the user's tracks from config
  delete config.remoteTracks[user.uid];
};

// Handles volume indicator change
export const handleVolumeIndicator = (result, config) => {
  result.forEach((volume) => {
    config.onVolumeIndicatorChanged(volume);
  });
};

// Handles token renewal
export const handleRenewToken = async (config, client) => {
  config.token = await fetchTokens();
  await client.renewToken(config.token);
};