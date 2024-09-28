// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";



// Handles user published event

export const handleUserPublished = async (user, mediaType, config) => {
  console.log(
    `handleUserPublished for user: ${user.uid}, mediaType: ${mediaType}`
  );

  // Ensure remoteTracks is initialized
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Store the user's remote tracks if not already stored
  config.remoteTracks[user.uid] = user;

  // Add the user's wrapper using the addUserWrapper function (for hosts only)
  if (user.role === "host") {
    await addUserWrapper(user, config);
  }

  // Select the video player and avatar div elements
  const videoPlayer = document.querySelector(`#stream-${user.uid}`);
  const avatarDiv = document.querySelector(`#avatar-${user.uid}`);

  // Log details about the videoPlayer and avatarDiv for debugging
  if (!videoPlayer) {
    console.error(`Video player element not found for user ${user.uid}`);
  } else {
    console.log(`Video player element found for user ${user.uid}`);
  }

  if (!avatarDiv) {
    console.error(`Avatar div element not found for user ${user.uid}`);
  } else {
    console.log(`Avatar div element found for user ${user.uid}`);
  }

  // If mediaType is video, subscribe to the video track
  if (mediaType === "video") {
    console.log(`Attempting to subscribe to video track for user ${user.uid}`);

    try {
      await config.client.subscribe(user, mediaType); // Subscribe to the video track

      if (user.videoTrack) {
        console.log(
          `Successfully subscribed to video track for user ${user.uid}`
        );
        toggleVideoOrAvatar(user.uid, user.videoTrack, avatarDiv, videoPlayer);
      } else {
        console.log(
          `User ${user.uid} does not have a video track after subscribing. Showing avatar.`
        );
        avatarDiv.style.display = "block";
        videoPlayer.style.display = "none";
      }
    } catch (error) {
      console.error(
        `Error subscribing to video track for user ${user.uid}:`,
        error
      );
    }
  }

  // For audio track
  if (mediaType === "audio") {
    console.log(`User ${user.uid} has an audio track.`);
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

    // Check if there are already published tracks for existing users
    config.client.remoteUsers.forEach(async (remoteUser) => {
      if (remoteUser.videoTrack || remoteUser.audioTrack) {
        // Add the wrapper and restore the media
        await addUserWrapper(remoteUser, config);
        const videoPlayer = document.querySelector(`#stream-${remoteUser.uid}`);
        const avatarDiv = document.querySelector(`#avatar-${remoteUser.uid}`);
        toggleVideoOrAvatar(
          remoteUser.uid,
          remoteUser.videoTrack,
          avatarDiv,
          videoPlayer
        );

        if (remoteUser.audioTrack) {
          remoteUser.audioTrack.play();
        }
      }
    });
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
