import { userTracks } from "./state.js";

export const manageCameraState = (uid, userType) => {
  console.log(`Managing camera state for user with UID:`, uid);

  // Ensure that the user track exists in the global userTracks
  const userTrack = userTracks[uid];
  if (!userTrack) {
    console.error(`User track not found for UID: ${uid}`);
    return;
  }

  console.log(`User track for UID ${uid}:`, userTrack);

  // Handle camera video and avatar display
  playCameraVideo(uid, userType);
  showAvatar(uid, userType);

  console.log("Camera state management completed for UID:", uid);
};




export const playCameraVideo = (uid, userType) => {
  const userTrack = userTracks[uid];
  const videoTrack = userTrack ? userTrack.videoTrack : null;

  console.log("playCameraVideo called for", userType, "user with UID:", uid);

  if (!videoTrack) {
    console.log("Camera is off or there is no video track for this user.");
    return;
  }

  // Define video elements based on userType
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipVideoPlayer = document.getElementById(`${userType}-pip-video-track`);
  const pipAvatarDiv = document.getElementById(`${userType}-pip-avatar`);

  // Check if the user is screen sharing
  const isScreenSharing = !!userTrack.screenShareTrack;

  if (isScreenSharing) {
    console.log("Screen sharing is enabled, managing PiP for", userType);

    // If screen is being shared, play camera in PiP
    if (pipVideoPlayer) {
      console.log("Playing video track in PiP.");
      videoTrack.play(pipVideoPlayer);
      pipVideoPlayer.style.display = "block"; // Ensure PiP video player is visible
    } else {
      console.warn("pipVideoPlayer not found.");
    }

    if (pipAvatarDiv) {
      console.log("Hiding PiP avatar.");
      pipAvatarDiv.style.display = "none"; // Hide PiP avatar if the camera is on
    }
  } else {
    console.log(
      "Screen sharing is not enabled, managing main video stage for",
      userType
    );

    // Play the camera feed in the main video stage
    if (videoPlayer) {
      console.log("Playing video track in main video stage.");
      videoTrack.play(videoPlayer);
      videoPlayer.style.display = "block"; // Ensure main video player is visible
    } else {
      console.warn("videoPlayer not found.");
    }
  }

  console.log("playCameraVideo function execution completed.");
};



export const showAvatar = (uid, userType) => {
  console.log(`Entering showAvatar for ${userType} user with UID:`, uid);

  const userTrack = userTracks[uid];
  const isCameraOn = userTrack && userTrack.videoTrack;

  const avatarDiv = document.querySelector(`#avatar-${uid}`);
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipAvatarDiv = document.getElementById(`${userType}-pip-avatar`);
  const pipVideoPlayer = document.getElementById(`${userType}-pip-video-track`);

  // Check if the user is screen sharing
  const isScreenSharing = !!userTrack.screenShareTrack;

  console.log("User isScreenSharing:", isScreenSharing);
  console.log("Avatar div:", avatarDiv);
  console.log("Video player:", videoPlayer);
  console.log("PiP Avatar div:", pipAvatarDiv);
  console.log("PiP Video player:", pipVideoPlayer);

  if (!isCameraOn) {
    console.log("Camera is off, showing avatar for", userType, "user.");

    if (isScreenSharing) {
      // Show avatar in PiP
      if (pipAvatarDiv) {
        console.log("Showing PiP avatar.");
        pipAvatarDiv.style.display = "block"; // Show PiP avatar
      } else {
        console.warn("PiP avatar div not found.");
      }

      if (pipVideoPlayer) {
        console.log("Hiding PiP video player.");
        pipVideoPlayer.style.display = "none"; // Hide PiP video player
      } else {
        console.warn("PiP video player not found.");
      }
    } else {
      // Show avatar in the main video stage
      if (avatarDiv) {
        console.log("Showing main avatar.");
        avatarDiv.style.display = "block"; // Show main avatar
      } else {
        console.warn("Main avatar div not found.");
      }

      if (videoPlayer) {
        console.log("Hiding main video player.");
        videoPlayer.style.display = "none"; // Hide main video player
      } else {
        console.warn("Main video player not found.");
      }
    }
  } else {
    console.log("Camera is on, hiding avatar for", userType, "user.");

    if (isScreenSharing) {
      // Hide avatar in PiP when camera is on
      if (pipAvatarDiv) {
        console.log("Hiding PiP avatar.");
        pipAvatarDiv.style.display = "none"; // Hide PiP avatar
      }

      if (pipVideoPlayer) {
        console.log("Showing PiP video player.");
        pipVideoPlayer.style.display = "block"; // Show PiP video player
      }
    } else {
      // Hide avatar in the main video stage when the camera is on
      if (avatarDiv) {
        console.log("Hiding main avatar.");
        avatarDiv.style.display = "none"; // Hide main avatar
      }

      if (videoPlayer) {
        console.log("Showing main video player.");
        videoPlayer.style.display = "block"; // Show main video player
      }
    }
  }

  console.log("Exiting showAvatar...");
};




export const startScreenShare = async (uid, config) => {
  try {
    console.log(`Starting screen share process for user with UID:`, uid);

    // Get the userTrack information
    const userTrack = userTracks[uid];

    // Try to create the screen share track
    userTrack.screenShareTrack = await AgoraRTC.createScreenVideoTrack();
    console.log(`Screen share track created:`, userTrack.screenShareTrack);

    // Publish the screen share track
    await config.client.publish([userTrack.screenShareTrack]);
    console.log(`Screen share track published to the channel.`);

    // Play the screen share track locally (optional)
    const screenShareElement = document.getElementById(`screen-share-content`);
    if (screenShareElement) {
      userTrack.screenShareTrack.play(screenShareElement);
    } else {
      console.warn(`Screen share element not found.`);
    }

    // Set RTM attributes for screen sharing
    console.log(`Setting RTM attributes for screen sharing...`);
    await setRTMAttributes(uid, config.clientRTM);

    // Switch to screen share stage
    console.log(`Toggling to screen-share stage...`);
    toggleStages(true, uid);

    // Manage PiP for the camera feed (if the camera is on)
    manageCameraState(uid);

    // Call the function to indicate screen sharing is on
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(true); // Indicate screen is on
    }

    // Handle track-ended event triggered by browser
    userTrack.screenShareTrack.on("track-ended", async () => {
      console.log(
        `Screen share track ended by browser. Stopping screen share.`
      );
      await stopScreenShare(uid, config);
    });
  } catch (error) {
    console.error(`Error creating screen share track:`, error);
  }
};


export const stopScreenShare = async (uid, config) => {
  try {
    console.log(`Stopping screen share for user with UID:`, uid);

    // Get the userTrack information
    const userTrack = userTracks[uid];

    // Unpublish and stop the screen share track
    if (userTrack.screenShareTrack) {
      await config.client.unpublish([userTrack.screenShareTrack]);
      console.log(`Screen share track unpublished from the channel.`);

      userTrack.screenShareTrack.stop();
      userTrack.screenShareTrack.close();
      userTrack.screenShareTrack = null;
      console.log(`Screen share track stopped and closed.`);
    } else {
      console.warn(`No active screen share track found to stop.`);
    }

    // Clear the RTM attributes for screen sharing
    console.log(`Clearing RTM attributes for screen sharing...`);
    await clearRTMAttributes(uid, config.clientRTM);

    // Switch back to the video stage
    console.log(`Toggling back to video stage...`);
    toggleStages(false, uid);

    // Manage camera state in the main video stage
    manageCameraState(uid);

    // Call the function to indicate screen sharing is off
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(false); // Indicate screen is off
    }
  } catch (error) {
    console.error(`Error stopping screen share:`, error);
    throw error;
  }
};


const toggleStages = (isScreenSharing, uid, userType) => {
  // Select the correct video and screen share stage based on the userType
  const videoStage = document.getElementById(`${userType}-video-stage`);
  const screenShareStage = document.getElementById(
    `${userType}-screen-share-stage`
  );

  if (!uid) {
    console.error("toggleStages: uid is undefined.");
    return; // Exit early to prevent further errors
  }

  if (isScreenSharing) {
    console.log(
      `Toggling to screen share stage for ${userType} with UID: ${uid}`
    );
    videoStage.style.display = "none";
    screenShareStage.style.display = "block";
  } else {
    console.log(
      `Toggling back to video stage for ${userType} with UID: ${uid}`
    );
    videoStage.style.display = "flex";
    screenShareStage.style.display = "none";

    // Ensure that after returning to the video stage, the avatar is shown if the camera is off
    const avatarDiv = document.querySelector(`#avatar-${uid}`);
    if (avatarDiv) {
      avatarDiv.style.display = "block"; // Force avatar visibility if camera is off
      console.log(`Avatar for UID ${uid} is displayed.`);
    } else {
      console.warn(`Avatar for UID ${uid} not found.`);
    }
  }
};

const setRTMAttributes = async (uid, userType, clientRTM) => {
  if (clientRTM) {
    const attributes = { uidSharingScreen: uid.toString() };
    await clientRTM.setLocalUserAttributes(attributes);
    console.log(
      `Screen share UID attribute set for ${userType} user with UID ${uid}`
    );
  } else {
    console.error(`RTM client not found for ${userType} user with UID ${uid}`);
  }
};

const clearRTMAttributes = async (uid, userType, clientRTM) => {
  if (clientRTM) {
    await clientRTM.clearLocalUserAttributes();
    console.log(
      `Screen share UID attribute cleared for ${userType} user with UID ${uid}`
    );
  } else {
    console.error(`RTM client not found for ${userType} user with UID ${uid}`);
  }
};
