export const addUserWrapper = async (user, config) => {
  try {
    // Convert UID to string for RTM operations
    const rtmUid = user.uid.toString();

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

    // Select the video player and avatar elements
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);

    // Initially hide the video player and show the avatar
    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none"; // Hide video initially
      avatarDiv.style.display = "block"; // Show avatar initially
    }

    // If a video track is available, show the video and hide the avatar
    if (config.localScreenShareTrack && user.uid === config.screenShareUid) {
      console.log(`Showing video for screen share ${user.uid}`);
      videoPlayer.style.display = "block"; // Show the video player
      avatarDiv.style.display = "none"; // Hide the avatar
      config.localScreenShareTrack.play(videoPlayer); // Play the video track
    }
  } catch (error) {
    console.log("Failed to fetch user attributes:", error);
  }
};

// Wrapper for removing users from the video stage
export const removeUserWrapper = (uid) => {
  try {
    const player = document.querySelector(`#video-wrapper-${uid}`);
    if (player) {
      player.remove(); // Remove the user's video/audio wrapper from the DOM
      console.log(`Removed player for user: ${uid}`);
    } else {
      console.log(`Player not found for user: ${uid}`);
    }
  } catch (error) {
    console.log("Failed to remove user wrapper:", error);
  }
};
