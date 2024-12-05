import {sendRTMMessage} from "./helperFunctions.js"

export const playStreamInDiv = (
  config,
  userId,
  divId,
  screenShareTrackExternal
) => {
  const client = config.client;
  console.log(client);

  console.log(`playStreamInDiv called with userId: ${userId}, divId: ${divId}`);

  try {
    // Check for the DOM element
    const element = document.querySelector(divId);
    if (!element) {
      console.warn(`Element with ID ${divId} not found.`);
      return; // Stop if the element is not found
    }
    console.log(`Element with ID ${divId} found:`, element);

    // Determine the video track
    let videoTrack = screenShareTrackExternal; // Use screen share track if provided
    if (!videoTrack) {
      if (userId === config.uid) {
        // Use local track for the current user
        console.log("UserId matches config.uid. Fetching local video track...");
        videoTrack = client.localTracks?.find(
          (track) => track.trackMediaType === "video"
        );
        console.log("Local video track:", videoTrack);
        console.warn("VideoTrack played in the div", videoTrack);
      } else {
        // Use remote track for other users
        console.log(
          "UserId does not match config.uid. Fetching remote video track..."
        );
        const remoteUser = client.remoteUsers.find(
          (user) => user.uid.toString() === userId.toString()
        );
        console.log("Remote user found:", remoteUser);
        videoTrack = remoteUser?.videoTrack;
        console.log("Remote video track:", videoTrack);
      }
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
    console.log(`Video track for user ${userId} is now playing in ${divId}.`);
  } catch (error) {
    console.error(`Error playing video in ${divId} for user ${userId}:`, error);
  }
};



export const toggleStages = (isScreenSharing, config) => {
  const videoStage = document.getElementById("video-stage");
  const screenShareStage = document.getElementById("screen-share-stage");

  // Check for missing elements
  if (!videoStage || !screenShareStage) {
    let missingElements = [];
    if (!videoStage) missingElements.push("video-stage");
    if (!screenShareStage) missingElements.push("screen-share-stage");

    const errorMessage = `toggleStages: The following element(s) are not found: ${missingElements.join(
      ", "
    )}.`;
    console.error(errorMessage);

    // Send detailed error message via RTM
    sendRTMMessage(
      JSON.stringify({
        type: "ERROR_NOTIFICATION",
        message: errorMessage,
        details: {
          missingElements,
        },
        timestamp: Date.now(),
        user: config?.uid || "unknown",
      }),
      config
    );

    return; // Exit early if elements are not found
  }

  // Toggle stages visibility
  if (isScreenSharing) {
    videoStage.classList.add("hidden"); // Hide video stage
    screenShareStage.classList.remove("hidden"); // Show screen share stage
  } else {
    videoStage.classList.remove("hidden"); // Show video stage
    screenShareStage.classList.add("hidden"); // Hide screen share stage
  }

  // Update layout after toggling
  try {
    if (typeof updateLayout === "function") {
      updateLayout();
    } else {
      console.warn("updateLayout function is not defined.");
    }
  } catch (error) {
    console.error("Error in updateLayout:", error);
    sendRTMMessage(
      JSON.stringify({
        type: "ERROR_NOTIFICATION",
        message: "Error occurred in updateLayout function.",
        details: {
          errorMessage: error.message,
          stack: error.stack,
        },
        timestamp: Date.now(),
        user: config?.uid || "unknown",
      }),
      config
    );
  }
};

