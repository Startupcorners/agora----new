// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";



// Handles user published event
export const handleUserPublished = async (user, mediaType, config) => {
  log("handleUserPublished Here");

  const videoPlayer = document.querySelector(`#stream-${user.uid}`);
  const avatarDiv = document.querySelector(`#avatar-${user.uid}`);

  // For video track
  if (mediaType === "video" && user.videoTrack) {
    toggleVideoOrAvatar(user.uid, user.videoTrack, avatarDiv, videoPlayer);
  }

  // For audio track
  if (mediaType === "audio" && user.audioTrack) {
    user.audioTrack.play();
    toggleMicIcon(user.uid, false); // Mic is unmuted
  }
};



export const handleUserUnpublished = async (user, mediaType, config) => {
  if (mediaType === "video") {
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    toggleVideoOrAvatar(user.uid, null, avatarDiv, videoPlayer); // Show avatar if video unpublished
  }

  if (mediaType === "audio") {
    toggleMicIcon(user.uid, true); // Show muted mic icon
  }

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

  // Call addUserWrapper for hosts to set up the UI for the local user
  if (user.role === "host") {
    await addUserWrapper(user, config);
  }

  log(`User ${user.uid} joined, waiting for media to be published.`);
};


// Handles user left event
export const handleUserLeft = async (user, config) => {
  try {
    log(`User ${user.uid} left`);

    // Call removeUserWrapper to handle removing the user's video and UI elements
    await removeUserWrapper(user.uid);

    // Remove the user's tracks from the config
    if (config.remoteTracks && config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid];
      log(`Removed tracks for user ${user.uid}`);
    } else {
      log(`No tracks found for user ${user.uid}`);
    }

    log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
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