import { userTracks } from "./state.js"; 

export const playStreamInDiv = (userId, divId) => {
  try {
    const element = document.querySelector(divId);
    if (!element) {
      console.warn(`Element with ID ${divId} not found.`);
      return;
    }

    // Check if the user has a valid video track
    const userTrack = userTracks[userId];
    if (!userTrack || !userTrack.videoTrack || !userTrack.videoTrack._enabled) {
      console.warn(`No valid video track found for user ${userId}.`);
      element.classList.add("hidden"); // Hide the element if no track is available
      return;
    }

    console.log(`Playing video track for user ${userId} in ${divId}.`);
    userTrack.videoTrack.play(element); // Play the video track in the specified div
    element.classList.remove("hidden"); // Ensure the div is visible
  } catch (error) {
    console.error(`Error playing video in ${divId} for user ${userId}:`, error);
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
