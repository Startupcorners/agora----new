import { userTracks } from "./state.js";
import {
  setupEventListeners,
} from "./setupEventListeners.js";

export const manageCameraState = (uid, config) => {
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
  playCameraVideo(uid, config); // Pass config to playCameraVideo
  showAvatar(uid, config); // Pass config to showAvatar

  console.log("Camera state management completed for UID:", uid);
};





export const playCameraVideo = async (uid, config) => {
  const userTrack = userTracks[uid];
  const videoTrack = userTrack ? userTrack.videoTrack : null;

  console.log("playCameraVideo called for user with UID:", uid);

  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipVideoPlayer = document.getElementById(`pip-video-track`);
  const pipAvatarDiv = document.getElementById(`pip-avatar`);

  // Fetch the user's RTM attributes to check if they are sharing their screen
  const attributes = await config.clientRTM.getUserAttributes(uid.toString());
  const isScreenSharing = attributes.sharingScreen === "1";
  const isCameraOn = !!videoTrack;

  if (isScreenSharing) {
    console.log("Screen sharing is enabled, managing PiP for camera.");

    // Show the screen share in the main video stage
    const screenShareTrack = userTracks[1]
      ? userTracks[1].screenShareTrack
      : null;
    if (screenShareTrack && videoPlayer) {
      console.log("Playing screen share track in main video stage.");
      screenShareTrack.play(videoPlayer);
      videoPlayer.style.display = "block"; // Ensure main video player is visible
    } else {
      console.warn("videoPlayer or screenShareTrack not found.");
    }

    // Only play the camera in PiP if the camera is on
    if (isCameraOn && pipVideoPlayer) {
      console.log("Playing camera video track in PiP.");
      videoTrack.play(pipVideoPlayer);
      pipVideoPlayer.style.display = "block"; // Show PiP video player
      pipAvatarDiv.style.display = "none"; // Hide PiP avatar
    } else {
      console.log("Camera is off, hiding PiP.");
      if (pipVideoPlayer) pipVideoPlayer.style.display = "none"; // Hide PiP video player
      if (pipAvatarDiv) pipAvatarDiv.style.display = "block"; // Show PiP avatar
    }
  } else {
    console.log(
      "Screen sharing is not enabled, managing main video stage for camera."
    );

    // Show the camera feed in the main video stage
    if (isCameraOn && videoPlayer) {
      console.log("Playing camera video track in main video stage.");
      videoTrack.play(videoPlayer);
      videoPlayer.style.display = "block"; // Ensure main video player is visible
    } else {
      console.log("Camera is off, hiding main video player.");
      if (videoPlayer) videoPlayer.style.display = "none"; // Hide main video player
    }

    // Hide PiP when screen sharing is not active
    if (pipVideoPlayer) pipVideoPlayer.style.display = "none";
    if (pipAvatarDiv) pipAvatarDiv.style.display = "block";
  }

  console.log("playCameraVideo function execution completed.");
};


export const showAvatar = async (uid, config) => {
  console.log(`Entering showAvatar for user with UID:`, uid);

  const userTrack = userTracks[uid];
  const isCameraOn = userTrack && userTrack.videoTrack;

  // Fetch the user's RTM attributes to check if they are sharing their screen
  const attributes = await config.clientRTM.getUserAttributes(uid.toString());
  const isScreenSharing = attributes.sharingScreen === "1";

  const avatarDiv = document.querySelector(`#avatar-${uid}`);
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipAvatarDiv = document.getElementById(`pip-avatar`);
  const pipVideoPlayer = document.getElementById(`pip-video-track`);

  if (!isCameraOn) {
    console.log("Camera is off, showing avatar for user with UID:", uid);

    // Handle PiP and screen share display
    if (isScreenSharing) {
      if (pipAvatarDiv) {
        console.log("Showing PiP avatar.");
        pipAvatarDiv.style.display = "block"; // Show PiP avatar
      }

      if (pipVideoPlayer) {
        console.log("Hiding PiP video player.");
        pipVideoPlayer.style.display = "none"; // Hide PiP video player
      }

      const screenShareTrack = userTracks[1]
        ? userTracks[1].screenShareTrack
        : null;
      if (screenShareTrack && videoPlayer) {
        console.log("Playing screen share in the main video player.");
        screenShareTrack.play(videoPlayer);
        videoPlayer.style.display = "block"; // Ensure main video player is visible
      }
    } else {
      // Show avatar in the main video stage when no screen share
      if (avatarDiv) {
        console.log("Showing main avatar.");
        avatarDiv.style.display = "block"; // Show main avatar
      }

      if (videoPlayer) {
        console.log("Hiding main video player.");
        videoPlayer.style.display = "none"; // Hide main video player
      }
    }
  } else {
    console.log("Camera is on, hiding avatar for user with UID:", uid);

    if (isScreenSharing) {
      // Hide avatar in PiP when camera is on
      if (pipAvatarDiv) {
        pipAvatarDiv.style.display = "none"; // Hide PiP avatar
      }

      if (pipVideoPlayer) {
        console.log("Showing PiP video player.");
        pipVideoPlayer.style.display = "block"; // Show PiP video player
      }

      const screenShareTrack = userTracks[1]
        ? userTracks[1].screenShareTrack
        : null;
      if (screenShareTrack && videoPlayer) {
        console.log("Playing screen share in the main video player.");
        screenShareTrack.play(videoPlayer);
        videoPlayer.style.display = "block"; // Ensure main video player is visible
      }
    } else {
      // Hide avatar and show video when camera is on and no screen sharing
      if (avatarDiv) avatarDiv.style.display = "none"; // Hide main avatar
      if (videoPlayer) videoPlayer.style.display = "block"; // Show main video player
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

    // Mark the user as screen sharing
    userTrack.screenShareEnabled = true;


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
    manageCameraState(config.uid, config);

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




