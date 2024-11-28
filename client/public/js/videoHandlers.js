import { newMainApp } from "./main.js";
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = newMainApp();
  console.log("App initialized after DOMContentLoaded:", app);
});
export const playStreamInDiv = (userId, divId) => {
  const config = app.getConfig();
  try {
    const element = document.querySelector(divId);
    if (!element) {
      console.warn(`Element with ID ${divId} not found.`);
      return; // Stop if the element is not found
    }

    // Check if the user has a valid video track
    const userTrack = config.userTracks[userId];
    console.log("UserTracks in playStreamInDiv", config.userTracks);
    if (!userTrack || !userTrack.videoTrack) {
      console.log(
        `No valid video track found for user ${userId}. Stopping playback attempt.`
      );
      element.classList.add("hidden"); // Hide the element if no track is available
      return; // Stop if no valid video track is found
    }

    console.log(`Playing video track for user ${userId} in ${divId}.`);
    userTrack.videoTrack.play(element); // Play the video track in the specified div
    element.classList.remove("hidden"); // Ensure the div is visible
  } catch (error) {
    console.error(`Error playing video in ${divId} for user ${userId}:`, error);
  }
};

export const toggleStages = (isScreenSharing) => {
  const videoStage = document.getElementById("video-stage");
  const screenShareStage = document.getElementById("screen-share-stage");

  if (!videoStage || !screenShareStage) {
    console.error(
      "toggleStages: video or screen share stage element not found."
    );
    return; // Exit early if elements are not found
  }

  if (isScreenSharing) {
    videoStage.classList.add("hidden"); // Hide video stage
    screenShareStage.classList.remove("hidden"); // Show screen share stage
  } else {
    videoStage.classList.remove("hidden"); // Show video stage
    screenShareStage.classList.add("hidden"); // Hide screen share stage
  }

  updateLayout(); // Ensure layout is updated after toggling
};
