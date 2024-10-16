import { userTracks } from "./state.js";

export const manageCameraState = (uid) => {
  console.log(`Managing camera state for user with UID:`, uid);

  // Ensure that the user track exists in the global userTracks
  const userTrack = userTracks[uid];
  if (!userTrack) {
    console.error(`User track not found for UID: ${uid}`);
    return;
  }
  console.log(`User track for UID ${uid}:`, userTrack);

  // Handle camera video and avatar display
  playCameraVideo(uid);
  showAvatar(uid);

  console.log("Camera state management completed for UID:", uid);
};



export const playCameraVideo = (uid, userType) => {
  const userTrack = userTracks[uid]; // Access user's track info from centralized object
  const videoTrack = userTrack ? userTrack.videoTrack : null;

  console.log("playCameraVideo called for", userType, "user with UID:", uid);

  if (!videoTrack) {
    console.error("Error: Video track is undefined. Ensure the camera is on.");
    return;
  }

  // Define video elements based on userType
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipVideoPlayer = document.getElementById(`${userType}-pip-video-track`);
  const pipAvatarDiv = document.getElementById(`${userType}-pip-avatar`);

  const isCameraOn = videoTrack && !userTrack.cameraMuted;

  if (isCameraOn) {
    if (userTrack.screenShareEnabled) {
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
  } else {
    console.log("Camera is off or muted for", userType, "user, skipping play.");
  }

  console.log("playCameraVideo function execution completed.");
};

export const showAvatar = (uid, userType) => {
  console.log(`Entering showAvatar for ${userType} user with UID:`, uid);

  const userTrack = userTracks[uid]; // Access user's track info from centralized object
  const isCameraOn =
    userTrack && userTrack.videoTrack && !userTrack.cameraMuted;

  const avatarDiv = document.querySelector(`#avatar-${uid}`);
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipAvatarDiv = document.getElementById(`${userType}-pip-avatar`);
  const pipVideoPlayer = document.getElementById(`${userType}-pip-video-track`);

  console.log("User screenShareEnabled:", userTrack.screenShareEnabled);
  console.log("Avatar div:", avatarDiv);
  console.log("Video player:", videoPlayer);
  console.log("PiP Avatar div:", pipAvatarDiv);
  console.log("PiP Video player:", pipVideoPlayer);

  if (!isCameraOn) {
    console.log(
      "Camera is off or muted, showing avatar for",
      userType,
      "user."
    );

    if (userTrack.screenShareEnabled) {
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

    if (userTrack.screenShareEnabled) {
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

export const startScreenShare = async (uid, userType) => {
  try {
    console.log(
      `Starting screen share process for ${userType} user with UID:`,
      uid
    );

    // Get the userTrack information
    const userTrack = userTracks[uid];

    // Try to create the screen share track
    userTrack.screenShareTrack = await AgoraRTC.createScreenVideoTrack();
    console.log(
      `${userType} screen share track created:`,
      userTrack.screenShareTrack
    );

    // Play the screen share track
    const screenShareElement = document.getElementById(
      `${userType}-screen-share-content`
    );
    userTrack.screenShareTrack.play(screenShareElement);

    // Ensure the camera is still on before managing PiP
    if (!userTrack.videoTrack) {
      console.error(
        `Video track is undefined during screen share for ${userType}.`
      );
      return; // Stop the execution if the video track is missing
    }

    console.log(
      `Video track found for ${userType}, proceeding to manage PiP...`
    );

    // Mark screen sharing as enabled **before** managing PiP or camera
    userTrack.screenShareEnabled = true;

    // Set RTM attributes for screen sharing
    console.log(`Setting RTM attributes for ${userType} screen sharing...`);
    await setRTMAttributes(uid);

    // Switch to screen share stage
    console.log(
      `Toggling stages: switching to screen-share stage for ${userType}...`
    );
    toggleStages(true, uid, userType); // Show screen-share stage and hide video stage

    // Manage PiP for the camera feed (if the camera is on)
    manageCameraState(uid, userType);

    // Call the function to indicate screen sharing is on
    if (typeof bubble_fn_isScreenOn === "function") {
      console.log(
        `Calling bubble_fn_isScreenOn(true) to indicate screen sharing is on for ${userType}...`
      );
      bubble_fn_isScreenOn(true); // Indicate screen is on
    }

    // Handle track-ended event triggered by browser
    userTrack.screenShareTrack.on("track-ended", async () => {
      console.log(
        `${userType} screen share track ended by browser. Stopping screen share.`
      );

      // Trigger stopScreenShare directly
      await stopScreenShare(uid, userType);
    });
  } catch (error) {
    // Handle case when user cancels the screen sharing permission prompt
    if (
      error.name === "NotAllowedError" ||
      error.message.includes("Permission denied")
    ) {
      console.log(`User canceled the screen sharing prompt for ${userType}.`);
      if (typeof bubble_fn_isScreenOn === "function") {
        bubble_fn_isScreenOn(false); // Reset screen sharing state
      }
    } else {
      // Handle other errors
      console.error(
        `Error creating screen share track for ${userType}:`,
        error
      );
    }
  }
};

export const stopScreenShare = async (uid, userType) => {
  try {
    console.log(`Stopping screen share for ${userType} user with UID:`, uid);

    // Get the userTrack information
    const userTrack = userTracks[uid];

    // Stop and close the screen share track
    if (userTrack.screenShareTrack) {
      userTrack.screenShareTrack.stop();
      userTrack.screenShareTrack.close();
      userTrack.screenShareTrack = null;
      console.log(`${userType} screen share track stopped and closed.`);
    } else {
      console.warn(
        `No active screen share track found for ${userType} to stop.`
      );
    }

    // Clear the RTM attributes for screen sharing
    console.log(`Clearing RTM attributes for ${userType} screen sharing...`);
    await clearRTMAttributes(uid);

    // Mark screen sharing as disabled before switching stages
    userTrack.screenShareEnabled = false;
    console.log(`${userType} screen sharing marked as disabled.`);

    // Switch back to the video stage
    console.log(`Toggling stages: switching to video stage for ${userType}...`);
    toggleStages(false, uid, userType); // Ensure correct UID and userType are passed

    // Manage camera state in the main video stage
    console.log(
      `Managing camera state after ${userType} screen share stopped...`
    );
    manageCameraState(uid, userType); // Pass correct UID and userType

    // Call the function to indicate screen sharing is off
    if (typeof bubble_fn_isScreenOn === "function") {
      console.log(
        `Calling bubble_fn_isScreenOn(false) to indicate ${userType} screen sharing is off...`
      );
      bubble_fn_isScreenOn(false); // Indicate screen is off
    }
  } catch (error) {
    console.error(`Error stopping ${userType} screen share:`, error);
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
