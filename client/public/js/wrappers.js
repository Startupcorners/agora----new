// Wrapper for adding users (current or remote) to the video stage
export const addUserWrapper = async (user, config) => {
  try {
    // Convert UID to string for RTM operations
    const rtmUid = user.uid.toString();

    // Fetch user attributes from RTM (name, avatar)
    let userAttr = {};
    try {
      userAttr = await config.clientRTM.getUserAttributes(rtmUid);
    } catch (error) {
      console.log(`Failed to fetch user attributes for user ${rtmUid}:`, error);
      userAttr = {
        name: "Unknown",
        avatar: "default-avatar-url",
      };
    }

    // Check if the player already exists for this user
    let player = document.querySelector(`#participant-${user.uid}`);
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
  } catch (error) {
    console.log("Failed to add user wrapper:", error);
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
      `#stream-wrapper-${screenShareUid}`
    );
    if (!screenShareWrapper) {
      const videoStage = document.querySelector(config.callContainerSelector);
      const wrapperHTML = `
        <div id="stream-wrapper-${screenShareUid}" class="fullscreen-wrapper" style="width: 100%; height: 100%; position: relative;">
          <div id="stream-${screenShareUid}" class="stream fullscreen-wrapper"></div>
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
    screenShareWrapper.style.display = "block";

    // Create or move the current user's stream inside a smaller wrapper in the bottom-right
    let userWrapper = document.querySelector(`#stream-wrapper-${uid}`);
    if (!userWrapper) {
      const videoStage = document.querySelector(config.callContainerSelector);
      const userWrapperHTML = `
        <div id="stream-wrapper-${uid}" class="user-video-wrapper" style="width: 150px; height: 100px; position: absolute; bottom: 10px; right: 10px; z-index: 9999;">
          <div id="stream-${uid}" class="stream"></div>
        </div>
      `;
      videoStage.insertAdjacentHTML("beforeend", userWrapperHTML);
      userWrapper = document.querySelector(`#stream-wrapper-${uid}`);
      console.log(`Created user video wrapper for user: ${uid}`);
    }

    const userStream = document.querySelector(
      `#video-wrapper-${uid} .video-player`
    );
    if (userStream) {
      userWrapper.querySelector(`#stream-${uid}`).appendChild(userStream);
    } else {
      console.error(`User stream for UID ${uid} not found.`);
    }

    // Ensure the user video wrapper is visible and positioned correctly
    userWrapper.style.display = "block";
  } catch (error) {
    console.error("Error in addScreenShareWrapper:", error);
  }
};

export const removeScreenShareWrapper = (screenShareUid, uid, config) => {
  try {
    // Show all user video wrappers again after screen sharing ends
    const allWrappers = document.querySelectorAll(
      `#video-stage .stream-wrapper`
    );
    allWrappers.forEach((wrapper) => {
      wrapper.style.display = "block"; // Show other video wrappers
    });

    // Remove full-screen screen share wrapper
    const screenShareElement = document.querySelector(
      `#stream-wrapper-${screenShareUid}`
    );
    if (screenShareElement) {
      screenShareElement.remove(); // Remove the screen share wrapper
      console.log(`Screen share stream ${screenShareUid} removed.`);
    }

    // Reset the user video (restore size, remove from bottom-right)
    const userVideoWrapper = document.querySelector(`#stream-wrapper-${uid}`);
    if (userVideoWrapper) {
      userVideoWrapper.style.position = ""; // Reset positioning
      userVideoWrapper.style.width = ""; // Reset width
      userVideoWrapper.style.height = ""; // Reset height
      userVideoWrapper.style.bottom = "";
      userVideoWrapper.style.right = "";
      console.log(`User video ${uid} reset.`);
    }

    // Optional: remove the screen share track from Agora client
    if (config.screenShareClient) {
      config.screenShareClient.leave();
      config.screenShareClient = null;
      console.log("Screen share client left and removed.");
    }
  } catch (error) {
    console.error("Error in removeScreenShareWrapper:", error);
  }
};
