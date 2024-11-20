import { userTracks } from "./state.js";
import {
  setupEventListeners,
} from "./setupEventListeners.js";
import { toggleScreenShare } from "./uiHandlers.js"; 

export const manageCameraState = (action, videoTrack, elementId) => {
  try {
    console.log(
      `manageCameraState called with action: ${action}, elementId: ${elementId}`
    );
    console.log("VideoTrack:", videoTrack);

    // Validate the element
    const videoPlayer = document.querySelector(elementId);
    if (!videoPlayer) {
      console.warn(
        `Video player element not found for elementId: ${elementId}`
      );
      return;
    }

    if (action === "play") {
      if (videoTrack && typeof videoTrack.play === "function") {
        console.log(`Playing video on ${elementId}`);
        videoTrack.play(videoPlayer); // Play without .catch()
        videoPlayer.classList.remove("hidden"); // Show the video player
      } else {
        console.warn(
          `Invalid video track or play method not found for elementId: ${elementId}`
        );
      }
    } else if (action === "stop") {
      console.log(`Stopping video on ${elementId}`);
      videoPlayer.classList.add("hidden"); // Hide the video player
    } else {
      console.warn(`Invalid action passed to manageCameraState: ${action}`);
    }
  } catch (error) {
    console.error("Error in manageCameraState:", error);
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





