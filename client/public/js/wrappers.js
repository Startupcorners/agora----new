let addUserWrapperRunning = false;

const waitForElementVisible = async (selector, timeout = 5000) => {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const interval = 100; // Poll every 100ms

    const checkVisibility = () => {
      const element = document.querySelector(selector);
      const isVisible =
        element &&
        element.offsetParent !== null &&
        getComputedStyle(element).visibility !== "hidden";

      if (isVisible) {
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        reject(
          new Error(
            `Timeout: Element ${selector} not visible within ${timeout}ms.`
          )
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

    // Wait for the parent container to become visible
    await waitForElementVisible(config.callContainerSelector);

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

    // Validate the container selector
    const container = document.querySelector(config.callContainerSelector);
    if (!container) {
      console.error(
        `Invalid call container selector: ${config.callContainerSelector}`
      );
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
