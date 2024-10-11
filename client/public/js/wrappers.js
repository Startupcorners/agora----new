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
      `#stream-wrapper-${screenShareUid}`
    );
    if (!screenShareWrapper) {
      // If the screen share wrapper does not exist, create it
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
    screenShareWrapper.classList.add("fullscreen-wrapper"); // Apply full screen class
    screenShareWrapper.style.display = "block"; // Show the screen share wrapper

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
    } else {
      // If the wrapper exists, ensure it has the correct styles
      userWrapper.style.width = "150px";
      userWrapper.style.height = "100px";
      userWrapper.style.position = "absolute";
      userWrapper.style.bottom = "10px";
      userWrapper.style.right = "10px";
      userWrapper.style.zIndex = "9999";
    }

    // **Remove any existing stream elements in the wrapper to avoid duplication**
    const existingStream = userWrapper.querySelector(".video-player");
    if (existingStream) {
      existingStream.remove(); // Remove any existing stream
    }

    // Move the user's stream back into the user-wrapper
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

    // Remove full-screen screen share wrapper and hide it
    const screenShareElement = document.querySelector(
      `#stream-wrapper-${screenShareUid}`
    );
    if (screenShareElement) {
      screenShareElement.style.display = "none"; // Hide the screen share wrapper
      console.log(`Screen share stream ${screenShareUid} hidden.`);
    }

    // Reset the small user video (restore size, remove from bottom-right)
    const userVideoWrapper = document.querySelector(`#stream-wrapper-${uid}`);
    if (userVideoWrapper) {
      userVideoWrapper.classList.remove("user-video-bottom-right");
      userVideoWrapper.style.position = ""; // Reset positioning
      userVideoWrapper.style.width = ""; // Reset width
      userVideoWrapper.style.height = ""; // Reset height
      console.log(`User video ${uid} reset.`);
    }

    // Optionally, remove the screen share track from Agora client
    if (config.screenShareClient) {
      config.screenShareClient.leave();
      config.screenShareClient = null;
    }

    console.log("Screen share layout reset successfully.");
  } catch (error) {
    console.error("Error in removeScreenShareWrapper:", error);
  }
};

export function addScreenShareWithUser(
  config,
  screenShareTrack,
  userVideoTrack
) {
  const videoStage = document.querySelector("#video-stage");

  // Clear previous elements in video stage (optional)
  videoStage.innerHTML = "";

  // Create the fullscreen screen share wrapper
  const screenShareWrapper = document.createElement("div");
  screenShareWrapper.id = "screen-share-wrapper";
  screenShareWrapper.className = "fullscreen-wrapper";

  // Create small user video wrapper (inside the fullscreen screen share)
  const userVideoWrapper = document.createElement("div");
  userVideoWrapper.id = `stream-wrapper-${config.uid}`;
  userVideoWrapper.className = "fullscreen-stream";

  // Create video player for the user inside the small wrapper
  const userVideoPlayer = document.createElement("div");
  userVideoPlayer.id = `stream-${config.uid}`;
  userVideoPlayer.className = "video-player";

  // Append the video player to the user video wrapper
  userVideoWrapper.appendChild(userVideoPlayer);

  // Append the user video wrapper to the fullscreen screen share wrapper
  screenShareWrapper.appendChild(userVideoWrapper);

  // Append the fullscreen screen share wrapper to the video stage
  videoStage.appendChild(screenShareWrapper);

  console.log("Screen share and user wrapper added to the stage.");

  // Play the screen share track in the screen share wrapper
  if (screenShareTrack && typeof screenShareTrack.play === "function") {
    const screenShareElement = document.getElementById("screen-share-wrapper");
    screenShareTrack.play(screenShareElement); // Play screen share track
  }

  // Play the user video track in the small user video wrapper
  if (userVideoTrack && typeof userVideoTrack.play === "function") {
    const userVideoElement = document.getElementById(`stream-${config.uid}`);
    userVideoTrack.play(userVideoElement); // Play user video track
  }
}


export function revertToNormalView(config) {
  const videoStage = document.querySelector("#video-stage");

  // Remove any screen share related content
  videoStage.innerHTML = "";

  // Add the user back to normal layout (add wrappers for all participants)
  config.participants.forEach((participant) => {
    const userWrapper = document.createElement("div");
    userWrapper.id = `stream-wrapper-${participant.uid}`;
    userWrapper.className = "normal-stream";

    const videoPlayer = document.createElement("div");
    videoPlayer.id = `stream-${participant.uid}`;
    videoPlayer.className = "video-player";

    userWrapper.appendChild(videoPlayer);
    videoStage.appendChild(userWrapper);

    // Play the video for each user (this assumes tracks are stored in config)
    const track = config.remoteTracks[participant.uid];
    if (track) {
      track.play(`#stream-${participant.uid}`);
    }
  });

  console.log("Reverted to normal view for all users.");
}
