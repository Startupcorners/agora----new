import { userTracks } from "./state.js";
import {
  setupEventListeners,
} from "./setupEventListeners.js";

export const manageCameraState = (uid) => {
  console.log(`Managing camera state for user with UID:`, uid);

  // Ensure that the user track exists in the global userTracks
  const userTrack = userTracks[uid];
  if (!userTrack) {
    console.error(`User track not found for UID: ${uid}`);
    return;
  }

  console.log(`User track for UID ${uid}:`, userTrack);

  // Check for screen share track using UID 1
  const screenShareTrack = userTracks[1]
    ? userTracks[1].screenShareTrack
    : null;

  // If screen share track exists, play it in the designated element
  if (screenShareTrack) {
    const screenShareElement = document.getElementById(`screen-share-content`);
    if (screenShareElement) {
      screenShareTrack.play(screenShareElement);
      console.log(`Playing screen share track for UID 1 (screen share)`);
    } else {
      console.warn(`Screen share element not found.`);
    }
  }

  // Handle camera video and avatar display for the actual user UID
  playCameraVideo(uid);
  showAvatar(uid);

  console.log("Camera state management completed for UID:", uid);
};





export const playCameraVideo = (uid) => {
  const userTrack = userTracks[uid];
  const screenShareTrack = userTracks[1]
    ? userTracks[1].screenShareTrack
    : null; // Use UID 1 for screen share
  const videoTrack = userTrack ? userTrack.videoTrack : null;

  console.log("playCameraVideo called for user with UID:", uid);

  if (!videoTrack) {
    console.log("Camera is off or there is no video track for this user.");
    return;
  }

  // Define video elements based on UID
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipVideoPlayer = document.getElementById(`pip-video-track`);
  const pipAvatarDiv = document.getElementById(`pip-avatar`);

  // Check if the user is screen sharing (screen share uses UID 1)
  const isScreenSharing = !!screenShareTrack;

  if (isScreenSharing) {
    console.log("Screen sharing is enabled, managing PiP for camera.");

    // If the screen is being shared, play the camera in PiP
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

    // Play the screen share in the main video stage if applicable
    if (screenShareTrack && videoPlayer) {
      console.log("Playing screen share track in main video stage.");
      screenShareTrack.play(videoPlayer);
      videoPlayer.style.display = "block"; // Ensure main video player is visible
    } else {
      console.warn("videoPlayer or screenShareTrack not found.");
    }
  } else {
    console.log(
      "Screen sharing is not enabled, managing main video stage for camera."
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


export const showAvatar = (uid) => {
  console.log(`Entering showAvatar for user with UID:`, uid);

  const userTrack = userTracks[uid];
  const screenShareTrack = userTracks[1]
    ? userTracks[1].screenShareTrack
    : null; // Use UID 1 for screen share
  const isCameraOn = userTrack && userTrack.videoTrack;
  const isScreenSharing = !!screenShareTrack;

  console.log("User isScreenSharing:", isScreenSharing);

  const avatarDiv = document.querySelector(`#avatar-${uid}`);
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipAvatarDiv = document.getElementById(`pip-avatar`);
  const pipVideoPlayer = document.getElementById(`pip-video-track`);

  console.log("Avatar div:", avatarDiv);
  console.log("Video player:", videoPlayer);
  console.log("PiP Avatar div:", pipAvatarDiv);
  console.log("PiP Video player:", pipVideoPlayer);

  if (!isCameraOn) {
    console.log("Camera is off, showing avatar for user with UID:", uid);

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

      // Play the screen share in the main video player
      if (screenShareTrack && videoPlayer) {
        console.log("Playing screen share in the main video player.");
        screenShareTrack.play(videoPlayer);
        videoPlayer.style.display = "block";
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
    console.log("Camera is on, hiding avatar for user with UID:", uid);

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

      // Play the screen share in the main video player
      if (screenShareTrack && videoPlayer) {
        console.log("Playing screen share in the main video player.");
        screenShareTrack.play(videoPlayer);
        videoPlayer.style.display = "block";
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

    // Get the userTrack information, initialize if not already done
    if (!userTracks[1]) {
      userTracks[1] = {}; // Initialize userTrack for screen share if not exists
    }
    const userTrack = userTracks[1];

    // Create the screen share track
    const screenShareTrack = await AgoraRTC.createScreenVideoTrack();
    userTrack.screenShareTrack = screenShareTrack;
    console.log(`Screen share track created:`, userTrack.screenShareTrack);

    // Publish the screen share track using the existing screen share client
    await config.screenShareClient.publish([screenShareTrack]);
    console.log("Screen share track published with screen share client");

    // Manage the camera state (now handles playing the screen share track)
    manageCameraState(uid);

    // Mark the user as screen sharing
    userTrack.screenShareEnabled = true;

    // Update the RTM attribute to indicate screen sharing
    await updateSharingScreenAttribute(true, config);

    // Switch to screen share stage
    console.log(`Toggling stages: switching to screen-share stage...`);
    toggleStages(true, uid); // Show screen-share stage and hide video stage

    // Indicate screen sharing state using Bubble or any other function
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(true); // Indicate screen is on
    }

    // Handle track-ended event triggered by browser (if user stops screen sharing)
    screenShareTrack.on("track-ended", async () => {
      console.log(
        `Screen share track ended by browser. Stopping screen share.`
      );
      await stopScreenShare(uid, config);
    });
  } catch (error) {
    if (
      error.name === "NotAllowedError" ||
      error.message.includes("Permission denied")
    ) {
      console.log("User canceled the screen sharing prompt.");
      if (typeof bubble_fn_isScreenOn === "function") {
        bubble_fn_isScreenOn(false); // Reset screen sharing state
      }
    } else {
      console.error("Error creating screen share track:", error);
    }
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

    // Update RTM attribute to indicate that screen sharing has stopped
    await updateSharingScreenAttribute(false, config);

    // Clear any other RTM attributes related to screen sharing (if needed)
    console.log(`Clearing RTM attributes for screen sharing...`);
    await clearRTMAttributes(uid, config.clientRTM);

    // Switch back to the video stage
    console.log(`Toggling back to video stage...`);
    toggleStages(false, config.uid); // Switch back from screen-share to video stage

    // Manage camera state to ensure the camera is active again (if needed)
    manageCameraState(config.uid);

    // Call the function to indicate screen sharing is off
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(false); // Indicate screen sharing has ended
    }
  } catch (error) {
    console.error(`Error stopping screen share:`, error);
    throw error;
  }
};

export const toggleStages = (isScreenSharing, uid) => {
  const videoStage = document.getElementById("video-stage");
  const screenShareStage = document.getElementById("screen-share-stage");

  if (!uid) {
    console.error("toggleStages: uid is undefined.");
    return; // Exit early to prevent further errors
  }

  if (!videoStage || !screenShareStage) {
    console.error(
      "toggleStages: video or screen share stage element not found."
    );
    return; // Exit early if elements are not found
  }

  if (isScreenSharing) {
    console.log(`Toggling to screen share stage for user with UID: ${uid}`);
    videoStage.style.display = "none";
    screenShareStage.style.display = "block";
  } else {
    console.log(`Toggling back to video stage for user with UID: ${uid}`);
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



export const updateSharingScreenAttribute = async (isSharing, config) => {
  try {
    if (config.clientRTM && config.clientRTM._logined) {
      await config.clientRTM.setLocalUserAttributes({
        sharingScreen: isSharing,
      });
      console.log(`Updated RTM attribute sharingScreen to: ${isSharing}`);
    } else {
      console.error("RTM client is not logged in.");
    }
  } catch (error) {
    console.error("Failed to update sharingScreen attribute:", error);
  }
};
