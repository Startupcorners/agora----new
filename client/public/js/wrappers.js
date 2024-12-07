import { updateMicStatusElement } from "./uiHandlers.js";

// Track running state for each user
let addUserWrapperRunning = {};

export const addUserWrapper = async (uid, config) => {
  const client = config.client; // Retrieve the client from config
  const rtmUid = uid.toString();

  // Check if the function is already running for the same user
  if (addUserWrapperRunning[rtmUid]) {
    console.log(`addUserWrapper is already running for user: ${uid}`);
    return;
  }

  // Set running state for the user
  addUserWrapperRunning[rtmUid] = true;

  try {
    // Check if the wrapper already exists
    if (document.querySelector(`#video-wrapper-${uid}`)) {
      console.log(`Wrapper already exists for user: ${uid}`);
      return;
    }

    // Fetch user attributes from RTM (name, avatar)
    let userAttr = {};
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        userAttr = await config.clientRTM.getUserAttributes(rtmUid);
      } catch (error) {
        console.error(`Failed to fetch user attributes for ${uid}:`, error);
        userAttr = {
          name: "Unknown",
          avatar: "default-avatar-url",
        };
      }
    }

    // Create player HTML with user attributes (name, avatar)
    let playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, uid)
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    // Insert the player into the DOM
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    console.log(`Added wrapper for user: ${uid}`);

    // Determine if the track is local or remote
    let audioTrack;
    let isActiveMic = false;

    if (uid === config.uid) {
      // Use local tracks array for the current user
      audioTrack = client.localTracks?.find(
        (track) => track.trackMediaType === "audio"
      );
      isActiveMic = audioTrack?.enabled || false; // Check if enabled for local user
    } else {
      // Use remote tracks for other users
      console.log("client.remoteUsers", client.remoteUsers);
      const remoteUser = client.remoteUsers.find(
        (user) => user.uid.toString() === uid.toString()
      );
      audioTrack = remoteUser?.audioTrack;
      isActiveMic = audioTrack?.isPlaying || false; // Check if playing for remote user
    }

    console.log(`Audio track for user ${uid}:`, audioTrack);

    // Update mic status based on the audio track
    if (isActiveMic) {
      updateMicStatusElement(uid, false); // Mic is active
      console.log(`User ${uid}'s microphone is active.`);
    } else {
      updateMicStatusElement(uid, true); // Mic is inactive
      console.log(`User ${uid}'s microphone is inactive.`);
    }

    updateLayout();
  } catch (error) {
    console.error("Error in addUserWrapper:", error);
  } finally {
    // Reset running state for the user
    addUserWrapperRunning[rtmUid] = false;
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
    updateLayout();
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
    updateLayout();
  } catch (error) {
    console.error("Error in removeScreenShareWrapper:", error);
  }
};
