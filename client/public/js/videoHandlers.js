import { userTracks } from "./state.js"; 

export const playStreamInDiv = (
  userId,
  divId,
  maxRetries = 5,
  retryDelay = 1000
) => {
  const retry = async (attempt = 1) => {
    try {
      const element = document.querySelector(divId);
      if (!element) {
        console.warn(`Attempt ${attempt}: Element with ID ${divId} not found.`);
        if (attempt < maxRetries) {
          setTimeout(() => retry(attempt + 1), retryDelay);
        }
        return;
      }

      // Check if the user has a valid video track
      const userTrack = userTracks[userId];
      console.log("UserTracks in playStreamInDiv", userTracks);
      if (!userTrack || !userTrack.videoTrack) {
        console.log(
          `Attempt ${attempt}: No valid video track found for user ${userId}.`
        );
        element.classList.add("hidden"); // Hide the element if no track is available
        if (attempt < maxRetries) {
          setTimeout(() => retry(attempt + 1), retryDelay);
        }
        return;
      }

      console.log(
        `Attempt ${attempt}: Playing video track for user ${userId} in ${divId}.`
      );
      userTrack.videoTrack.play(element); // Play the video track in the specified div
      element.classList.remove("hidden"); // Ensure the div is visible
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Error playing video in ${divId} for user ${userId}:`,
        error
      );
      if (attempt < maxRetries) {
        setTimeout(() => retry(attempt + 1), retryDelay);
      }
    }
  };

  retry(); // Start the retry process
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
