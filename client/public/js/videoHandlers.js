export const playStreamInDiv = (config, userId, divId) => {
  const client = config.client
  try {
    const element = document.querySelector(divId);
    if (!element) {
      console.warn(`Element with ID ${divId} not found.`);
      return; // Stop if the element is not found
    }

    // Determine if the track is local or remote
    let videoTrack;
    if (userId === config.uid) {
      // Use local track for the current user
      videoTrack = client.localTrack?.videoTrack;
    } else {
      // Use remote track for other users
      const remoteUser = client.remoteUsers.find((user) => user.uid === userId);
      videoTrack = remoteUser?.videoTrack;
    }

    // Check if the user has a valid video track
    if (!videoTrack) {
      console.log(
        `No valid video track found for user ${userId}. Stopping playback attempt.`
      );
      element.classList.add("hidden"); // Hide the element if no track is available
      return; // Stop if no valid video track is found
    }

    console.log(`Playing video track for user ${userId} in ${divId}.`);
    videoTrack.play(element); // Play the video track in the specified div
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
