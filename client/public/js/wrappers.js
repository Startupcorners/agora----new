export const addUserWrapper = async (user, config) => {
  try {
    // Convert UID to string for RTM operations
    const rtmUid = user.uid.toString();

    // Fetch user attributes from RTM (name, avatar)
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

    // Check if the player already exists for this user
    let player = document.querySelector(`#participant-${user.uid}`);
    if (!player) {
      // Log that we are creating the player wrapper
      console.log(`Creating wrapper for user: ${user.uid}`);

      // Create player HTML with user attributes (name, avatar)
      let playerHTML = `
        <div id="participant-${user.uid}" class="participant-wrapper">
          <div id="stream-${
            user.uid
          }" class="video-player" style="display: block; width: 100%; height: 100%;"></div>
          <div class="participant-info">
            <div class="participant-name">${userAttr.name || "Unknown"}</div>
            <div class="participant-company">${userAttr.company || ""}</div>
          </div>
        </div>
      `;

      // Insert the player into the DOM
      const callContainer = document.querySelector(
        config.callContainerSelector
      );
      if (callContainer) {
        callContainer.insertAdjacentHTML("beforeend", playerHTML);
        console.log(`Added player wrapper for user: ${user.uid}`);
      } else {
        console.error(
          `Call container ${config.callContainerSelector} not found`
        );
      }
    }

    // Ensure that the video player element is ready
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none"; // Video off initially
      avatarDiv.style.display = "block"; // Avatar on
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
