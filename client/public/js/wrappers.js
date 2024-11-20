

let addUserWrapperRunning = false;

export const addUserWrapper = async (user, config) => {
  // If already running, skip this execution
  if (addUserWrapperRunning) {
    console.log(`addUserWrapper is already running for user: ${user.uid}`);
    return;
  }

  // Set running state to true
  addUserWrapperRunning = true;

  try {
    const rtmUid = user.uid.toString();

    // Check if the wrapper already exists
    if (document.querySelector(`#video-wrapper-${user.uid}`)) {
      console.log(`Wrapper already exists for user: ${user.uid}`);
      return;
    }

    // Fetch user attributes from RTM (name, avatar)
    let userAttr = {};
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        userAttr = await config.clientRTM.getUserAttributes(rtmUid);
      } catch (error) {
        console.error(`Failed to fetch user attributes for ${user.uid}:`, error);
        userAttr = {
          name: "Unknown",
          avatar: "default-avatar-url",
        };
      }
    }

    // Create player HTML with user attributes (name, avatar)
    let playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.uid)
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    // Insert the player into the DOM
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    console.log(`Added wrapper for user: ${user.uid}`);
    updateLayout();

  } catch (error) {
    console.error("Error in addUserWrapper:", error);
  } finally {
    // Set running state to false after completion
    addUserWrapperRunning = false;
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
};

export const removeScreenShareWrapper = (screenShareUid, uid, config) => {
};
