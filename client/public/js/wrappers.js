// Wrapper for adding users (current or remote) to the video stage
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

    // Hide video player and show avatar initially
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


export const addScreenShareWrapper = (screenShareUid, uid, config) => {
  try {
    // Hide all other video wrappers
    const allWrappers = document.querySelectorAll(
      `#video-stage .stream-wrapper`
    );
    allWrappers.forEach((wrapper) => {
      wrapper.style.display = "none"; // Hide all other wrappers
    });

    // Handle the screen share wrapper (full screen)
    let screenShareWrapper = document.querySelector(
      `#stream-${screenShareUid}`
    );
    if (!screenShareWrapper) {
      // If the screen share wrapper does not exist, create it
      const videoStage = document.querySelector(config.callContainerSelector);
      const wrapperHTML = `
        <div id="stream-wrapper-${screenShareUid}" class="fullscreen-wrapper">
          <div id="stream-${screenShareUid}" class="stream"></div>
        </div>
      `;
      videoStage.insertAdjacentHTML("beforeend", wrapperHTML);
      screenShareWrapper = document.querySelector(`#stream-${screenShareUid}`);
      console.log(`Created screen share wrapper for user: ${screenShareUid}`);
    } else {
      console.log(
        `Screen share wrapper for user ${screenShareUid} already exists.`
      );
    }

    // Show the screen share wrapper
    screenShareWrapper.classList.add("fullscreen-wrapper"); // Apply full screen class
    screenShareWrapper.style.display = "block"; // Show the screen share wrapper

    // Handle the user video wrapper (small in bottom-right)
    const userWrapper = document.querySelector(`#stream-wrapper-${uid}`);
    if (userWrapper) {
      userWrapper.classList.add("user-video-bottom-right"); // Apply bottom-right class
      userWrapper.style.width = "200px"; // Smaller size
      userWrapper.style.height = "120px"; // Smaller size
      userWrapper.style.position = "absolute"; // Ensure absolute positioning
      userWrapper.style.bottom = "10px"; // Bottom-right corner
      userWrapper.style.right = "10px"; // Bottom-right corner
      userWrapper.style.display = "block"; // Ensure the user wrapper is visible
    } else {
      console.error(`User wrapper with id #stream-wrapper-${uid} not found`);
    }
  } catch (error) {
    console.error("Error in addScreenShareWrapper:", error);
  }
};



export const removeScreenShareWrapper = (screenShareUid, uid, config) => {
  try {
    // Restore the layout when screen share ends
    const allWrappers = document.querySelectorAll(
      `#video-stage .stream-wrapper`
    );
    allWrappers.forEach((wrapper) => {
      wrapper.style.display = "block"; // Restore other wrappers
    });

    // Remove full screen mode for screen share
    const screenShareWrapper = document.querySelector(
      `#stream-${screenShareUid}`
    );
    if (screenShareWrapper) {
      screenShareWrapper.classList.remove("fullscreen-wrapper");
      screenShareWrapper.style.display = "none"; // Hide screen share
    }

    // Remove small video from the bottom-right
    const userWrapper = document.querySelector(`#stream-wrapper-${uid}`);
    if (userWrapper) {
      userWrapper.classList.remove("user-video-bottom-right");
      userWrapper.style.display = "block"; // Restore user's video
    }
  } catch (error) {
    console.error("Error in removeScreenShareWrapper:", error);
  }
};
