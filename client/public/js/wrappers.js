export const addUserWrapper = async (user, config) => {
  try {
    const rtmUid = user.uid.toString();

    // Fetch user attributes from RTM (name, avatar)
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

    // Check if the wrapper already exists for this user
    let wrapper = document.querySelector(`#participant-${user.uid}`);
    if (!wrapper) {
      console.log(`Creating wrapper for user: ${user.uid}`);

      // Create player HTML with avatar and mic icon
      const playerHTML = `
        <div id="participant-${user.uid}" class="participant-wrapper">
          <div id="stream-${
            user.uid
          }" class="video-player" style="width: 100%; height: 100%;"></div>
          <div id="avatar-${user.uid}" class="avatar" style="display: block;">
            <img src="${userAttr.avatar || "default-avatar-url"}" alt="${
        userAttr.name || "User"
      } Avatar" />
          </div>
          <div class="participant-info">
            <div class="participant-name">${userAttr.name || "Unknown"}</div>
            <div class="participant-company">${userAttr.company || ""}</div>
          </div>
          <div id="mic-icon-${user.uid}" class="mic-icon">
            <img src="path-to-mic-icon" alt="Mic icon">
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
        return;
      }
    } else {
      console.log(`Wrapper for user ${user.uid} already exists`);
    }

    // Ensure the video player and avatar elements are ready
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    const micIcon = document.querySelector(`#mic-icon-${user.uid}`);

    if (!videoPlayer || !avatarDiv || !micIcon) {
      console.error(
        `Video player, avatar, or mic icon not found for user ${user.uid}`
      );
      return;
    }

    // Initially hide the video player and show avatar
    videoPlayer.style.display = "none"; // Video hidden by default
    avatarDiv.style.display = "block"; // Avatar visible by default
  } catch (error) {
    console.error("Error in addUserWrapper:", error);
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
