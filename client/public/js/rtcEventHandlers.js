// rtcEventHandlers.js
import { toggleMic, toggleCamera } from "./uiHandlers.js";
import { log, fetchTokens } from "./helperFunctions.js";

// Handles user published event
export const handleUserPublished = async (user, mediaType, config) => {
  log("handleUserPublished Here");

  // Ensure remoteTracks is initialized
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Store the user's remote tracks
  config.remoteTracks[user.uid] = user;

  let videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
  if (!videoWrapper) {
    // Create the player's HTML for this user if not already present
    try {
      const rtmUid = user.uid.toString();
      const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

      let playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, user.uid)
        .replace(/{{name}}/g, userAttr.name || "Unknown")
        .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", playerHTML);

      log(`Added player for user: ${user.uid}`);
    } catch (error) {
      log("Failed to fetch user attributes:", error);
    }

    videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
  }

  const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
  const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);

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

  let videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
  if (!videoWrapper) {
    log(`Video wrapper for user ${user.uid} not found`);
    return;
  }

  const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
  const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);

  // Handle when the screen share or video track is unpublished
  if (mediaType === "video") {
    if (user.videoTrack && user.videoTrack.isScreen) {
      log(`User ${user.uid} unpublished screen share`);
    } else {
      log(`User ${user.uid} unpublished video`);
    }
    // Hide the video and show the avatar when video or screen share is turned off
    videoPlayer.style.display = "none";
    avatarDiv.style.display = "block"; // Show avatar when video is turned off
  }

  // Handle when the audio track is unpublished
  if (mediaType === "audio") {
    log(`User ${user.uid} unpublished audio`);
    updateMicIcon(user.uid, true); // Mic is muted
  }

  // Remove the user's tracks from the config
  delete config.remoteTracks[user.uid];
};

// Handles user joined event
export const handleUserJoined = async (user, config) => {
  log("handleUserJoined Here");

  // Initialize remoteTracks if it's undefined
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Store user in remoteTracks
  config.remoteTracks[user.uid] = user;

  // Convert UID to string for RTM operations
  const rtmUid = user.uid.toString();

  try {
    // Fetch user attributes from RTM (name, avatar)
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

    // Check if the player already exists for this user
    let player = document.querySelector(`#video-wrapper-${user.uid}`);
    if (!player) {
      // Create player HTML with user attributes (name, avatar)
      let playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, user.uid)
        .replace(/{{name}}/g, userAttr.name || "Unknown")
        .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

      // Insert the player into the DOM
      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", playerHTML);

      console.log(`Added player for user: ${user.uid}`);
    }

    // Hide video player and show avatar initially
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none"; // Video off initially
      avatarDiv.style.display = "block"; // Avatar on
    }

    log("useruid:", user.uid)
    log("configuid:", config.uid);
    // Check if the user is the current user
    if (user.uid === config.uid) {
      if (typeof bubble_fn_joining === "function") {
        log("Run bubble_fn_joining");
        bubble_fn_joining("Joined"); // Notify that the current user has joined
      }
    }
  } catch (error) {
    log("Failed to fetch user attributes:", error);
  }
};


// Handles user left event
export const handleUserLeft = async (user, config) => {
  delete config.remoteTracks[user.uid];
  const player = document.querySelector(`#video-wrapper-${user.uid}`);
  if (player) {
    player.remove();
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
