let addUserWrapperRunning = false;

const pollForVisibility = async (id, timeout = 10000, interval = 100) => {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const checkVisibility = () => {
      const element = document.getElementById(id); // Directly fetch by ID
      const isVisible =
        element &&
        element.offsetParent !== null &&
        getComputedStyle(element).visibility !== "hidden";

      if (isVisible) {
        console.log(`Element #${id} is now visible.`);
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        console.error(
          `Timeout: Element #${id} not visible within ${timeout}ms.`
        );
        reject(
          new Error(`Timeout: Element #${id} not visible within ${timeout}ms.`)
        );
        return;
      }

      setTimeout(checkVisibility, interval);
    };

    checkVisibility();
  });
};



export const addUserWrapper = async (user, config) => {
  const userKey = `addUserWrapperRunning_${user.uid}`;
  if (window[userKey]) {
    console.log(`addUserWrapper is already running for user: ${user.uid}`);
    return;
  }

  window[userKey] = true;

  try {
    const rtmUid = user.uid.toString();

    // Check if the wrapper already exists
    if (document.querySelector(`#video-wrapper-${user.uid}`)) {
      console.log(`Wrapper already exists for user: ${user.uid}`);
      return;
    }

    // Poll for the visibility of the #video-stage
    console.log("Polling for visibility of #video-stage...");
    await pollForVisibility("main");

    // Fetch user attributes from RTM (name, avatar)
    let userAttr = {};
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        userAttr = await config.clientRTM.getUserAttributes(rtmUid);
      } catch (error) {
        console.error(
          `Failed to fetch user attributes for ${user.uid}:`,
          error
        );
        userAttr = {
          name: "Unknown",
          avatar: "default-avatar-url",
        };
      }
    }

    // Create player HTML with user attributes (name, avatar)
    const playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.uid)
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    // Directly fetch the #video-stage container
    const container = document.getElementById("video-stage");
    if (!container) {
      console.error("The #video-stage container is not found.");
      return;
    }

    // Insert the player into the DOM
    container.insertAdjacentHTML("beforeend", playerHTML);

    console.log(`Added wrapper for user: ${user.uid}`);
    updateLayout();

    // Validate if the wrapper was successfully added
    const newWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (!newWrapper) {
      console.error(
        `Wrapper for user ${user.uid} was not successfully added to the DOM.`
      );
      return;
    }

    console.log(`Wrapper successfully created for user: ${user.uid}`);
  } catch (error) {
    console.error("Error in addUserWrapper:", error);
  } finally {
    window[userKey] = false;
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
