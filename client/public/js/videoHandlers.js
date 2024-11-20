import { userTracks } from "./state.js";
import {
  setupEventListeners,
} from "./setupEventListeners.js";
import { toggleScreenShare } from "./uiHandlers.js"; 

export const manageCameraState = (action, videoTrack, elementId) => {
  try {
    const videoPlayer = document.querySelector(elementId);

    if (!videoPlayer) {
      console.warn(`Video player element not found with ID: ${elementId}.`);
      return;
    }

    if (action === "play" && videoTrack) {
      // Play the video track and show the video player
      videoPlayer.classList.remove("hidden");
      videoTrack
        .play(videoPlayer)
        .catch((error) =>
          console.error(`Error playing video in element ${elementId}:`, error)
        );
      console.log(`Video is now playing in element: ${elementId}.`);
    } else if (action === "stop") {
      // Hide the video player
      videoPlayer.classList.add("hidden");
      console.log(`Video player is now hidden for element: ${elementId}.`);
    } else {
      console.warn(
        `Invalid action or missing video track. Action: ${action}, VideoTrack: ${!!videoTrack}`
      );
    }
  } catch (error) {
    console.error(`Error in manageCameraState:`, error.message, error.stack);
  }
};

export const startScreenShare = async (screenShareUid, config) => {
  try {
    console.log(
      `Starting screen share process for screenShareUid: ${screenShareUid}`
    );

    // Create the screen share track
    const screenShareTrack = await AgoraRTC.createScreenVideoTrack();

    // Publish the screen share track using the screen share client
    await config.screenShareClient.publish(screenShareTrack);
    console.log("Screen share track published.");

    // Store the screen share track
    if (!userTracks[screenShareUid]) {
      userTracks[screenShareUid] = {};
    }
    userTracks[screenShareUid].screenShareTrack = screenShareTrack;

    // Update local state to indicate screen sharing has started
    config.isScreenSharing = true;

    // Update UI accordingly
    manageCameraState(config.uid, config);
    toggleStages(true, config.uid);

    // Handle track-ended event
    screenShareTrack.on("track-ended", async () => {
      console.log("Screen share track ended.");
      await toggleScreenShare(false, config.uid, config);
    });
  } catch (error) {
    console.error("Error starting screen share:", error);
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
    videoStage.classList.add("hidden"); // Hide video stage
    screenShareStage.classList.remove("hidden"); // Show screen share stage
  } else {
    console.log(`Toggling back to video stage for user with UID: ${uid}`);
    videoStage.classList.remove("hidden"); // Show video stage
    screenShareStage.classList.add("hidden"); // Hide screen share stage
  }

  updateLayout(); // Ensure layout is updated after toggling
};





