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
  console.log(
    `toggleStages called with isScreenSharing: ${isScreenSharing}, userId: ${userId}`
  );

  const screenShareStage = document.getElementById("screen-share-stage");
  const videoStage = document.getElementById("video-stage");
  const mainContainer = document.getElementById("main-container");

  // Check for elements required regardless of isScreenSharing
  if (!screenShareStage) {
    console.error(
      "Missing element: 'screenShareStage' (ID 'screen-share-stage') is not found in the DOM."
    );
  }
  if (!videoStage) {
    console.error(
      "Missing element: 'videoStage' (ID 'video-stage') is not found in the DOM."
    );
  }
  if (!mainContainer) {
    console.error(
      "Missing element: 'mainContainer' (ID 'main-container') is not found in the DOM."
    );
  }

  // Exit if critical elements are missing
  if (!screenShareStage || !videoStage || !mainContainer) {
    console.error(
      "One or more required elements are missing. Cannot proceed with toggling stages."
    );
    return;
  }

  if (isScreenSharing) {
    console.log("Screen sharing is active. Preparing to update layout.");

    const videoWrapper = document.getElementById(`video-wrapper-${userId}`);

    // Check for videoWrapper only when screen sharing
    if (!videoWrapper) {
      console.error(
        `Missing element: 'videoWrapper' (ID 'video-wrapper-${userId}') is not found in the DOM.`
      );
      return; // Exit early if videoWrapper is required but missing
    }

    // Show screen share stage
    console.log("Making screenShareStage visible.");
    screenShareStage.classList.remove("hidden");

    // Update user avatars and names for screen sharing
    console.log("Updating user avatars and names for screen sharing.");
    document.querySelectorAll(".user-avatar").forEach((userAvatar) => {
      userAvatar.classList.remove("user-avatar");
      userAvatar.classList.add("user-avatar-screenshare");
    });

    document.querySelectorAll(".user-name").forEach((userName) => {
      userName.classList.remove("user-name");
      userName.classList.add("user-name-screenshare");
    });

    // Move video wrapper to the first child position if necessary
    if (videoStage.firstChild !== videoWrapper) {
      console.log(
        `Moving videoWrapper (ID 'video-wrapper-${userId}') to the first position in videoStage.`
      );
      videoStage.insertBefore(videoWrapper, videoStage.firstChild);
    }

    // Await layout adjustments
    console.log("Calling editClasses to adjust layout for screen sharing.");
    await editClasses();
  } else {
    console.log("Screen sharing is inactive. Resetting layout.");

    // Hide screen share stage
    console.log("Hiding screenShareStage.");
    screenShareStage.classList.add("hidden");

    // Reset user avatars and names to default
    console.log("Resetting user avatars and names to default.");
    document
      .querySelectorAll(".user-avatar-screenshare")
      .forEach((userAvatar) => {
        userAvatar.classList.remove("user-avatar-screenshare");
        userAvatar.classList.add("user-avatar");
      });

    document.querySelectorAll(".user-name-screenshare").forEach((userName) => {
      userName.classList.remove("user-name-screenshare");
      userName.classList.add("user-name");
    });

    // Reset classes directly
    console.log("Resetting classes for videoStage and mainContainer.");
    videoStage.classList.remove("video-stage-screenshare", "video-stage-below");
    videoStage.classList.add("video-stage");

    mainContainer.classList.remove("main-container-below");
    mainContainer.classList.add("main-container-left");

    // Await layout adjustments
    console.log("Calling editClasses to adjust layout for default view.");
    await editClasses();
  }

  console.log("toggleStages completed.");
};
