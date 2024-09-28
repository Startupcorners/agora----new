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

  try {
    // Convert UID to string for RTM operations
    const rtmUid = user.uid.toString();

    // Fetch user attributes (including role) from RTM
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

    // Ensure user has a role assigned in RTM
    if (!userAttr.role) {
      console.error(`Error: User ${user.uid} does not have a role assigned.`);
      throw new Error(`User ${user.uid} does not have a role assigned.`);
    }

    // Add the role from RTM to the user object
    user.role = userAttr.role;

    // Only proceed if the user is a host
    if (user.role !== "host") {
      console.warn(
        `User ${user.uid} does not have the 'host' role. Skipping wrapper.`
      );
      return; // Exit if the user is not a host
    }

    // Initialize remoteTracks if it's undefined
    if (!config.remoteTracks) {
      config.remoteTracks = {};
    }

    // Store user in remoteTracks (no media yet)
    config.remoteTracks[user.uid] = user;

    // Add the wrapper for the user if the role is host
    await addUserWrapper(user, config);

    log(`Host user ${user.uid} joined, waiting for media to be published.`);
  } catch (error) {
    console.error(`Error in handleUserJoined for user ${user.uid}:`, error);
  }
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