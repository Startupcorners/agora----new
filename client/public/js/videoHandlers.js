import { updateLayout } from "./wrappers.js";
import { editClasses } from "./setupEventListeners.js";

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



export const toggleStages = async (isScreenSharing, userId) => {
  const screenShareStage = document.getElementById("screen-share-stage");
  const videoStage = document.getElementById("video-stage");
  const videoWrapper = document.getElementById(`video-wrapper-${userId}`);

  if (!screenShareStage || !videoStage || !videoWrapper) {
    console.error(
      "Required elements not found: 'screen-share-stage', 'video-stage', or 'video-wrapper'."
    );
    return;
  }

  if (isScreenSharing) {
    // Show screen share stage
    screenShareStage.classList.remove("hidden");

    // Move video wrapper to the first child position if necessary
    if (videoStage.firstChild !== videoWrapper) {
      videoStage.insertBefore(videoWrapper, videoStage.firstChild);
    }

    // Await layout adjustments if `editClasses` is asynchronous
    await editClasses("below"); // Switch to "below" layout for screen sharing
  } else {
    // Hide screen share stage
    screenShareStage.classList.add("hidden");

    // Await layout adjustments if `editClasses` is asynchronous
    await editClasses("left"); // Switch back to "left" layout
  }
};

