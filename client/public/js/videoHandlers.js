import { updateLayout } from "./wrappers.js";

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



export const toggleStages = (isScreenSharing, userId) => {
  const screenShareStage = document.getElementById("screen-share-stage");
  const videoStage = document.getElementById("video-stage");

  if (isScreenSharing) {
    const streamDiv = document.querySelector(`#video-wrapper-${userId}`); // Select the stream div by ID

    if (!streamDiv) {
      console.error(`Stream div with ID stream-${userId} not found.`);
      return;
    }

    // Show screen share stage
    screenShareStage.classList.remove("hidden");
    videoStage.classList.remove("video-stage");
    videoStage.classList.add("video-stage-screenshare");

    // Move streamDiv to be the first child of the screenShareStage and add a class
    if (screenShareStage.firstChild !== streamDiv) {
      screenShareStage.insertBefore(streamDiv, screenShareStage.firstChild);
    }
    streamDiv.classList.add("stream-div-screenshare"); // Add a specific class for screensharing

    // Update user avatars and names for screensharing
    const userAvatars = document.querySelectorAll(".user-avatar");
    userAvatars.forEach((userAvatar) => {
      userAvatar.classList.remove("user-avatar");
      userAvatar.classList.add("user-avatar-screenshare");
    });

    const userNames = document.querySelectorAll(".user-name");
    userNames.forEach((userName) => {
      userName.classList.remove("user-name");
      userName.classList.add("user-name-screenshare");
    });

    updateLayout("video-stage-screenshare");
  } else {
    // Hide screen share stage
    screenShareStage.classList.add("hidden");
    videoStage.classList.remove("video-stage-screenshare");
    videoStage.classList.add("video-stage");

    // Reset participant, avatar, and name styles
    const participants = document.querySelectorAll(
      ".video-participant-screenshare"
    );
    participants.forEach((participant) => {
      participant.classList.remove("video-participant-screenshare");
      participant.classList.add("video-participant");
    });

    const userAvatars = document.querySelectorAll(".user-avatar-screenshare");
    userAvatars.forEach((userAvatar) => {
      userAvatar.classList.remove("user-avatar-screenshare");
      userAvatar.classList.add("user-avatar");
    });

    const userNames = document.querySelectorAll(".user-name-screenshare");
    userNames.forEach((userName) => {
      userName.classList.remove("user-name-screenshare");
      userName.classList.add("user-name");
    });

    // Remove the screenshare-specific class from all stream divs
    const allStreamDivs = document.querySelectorAll(".stream-div-screenshare");
    allStreamDivs.forEach((div) => {
      div.classList.remove("stream-div-screenshare");
    });

    updateLayout("video-stage");
  }
};
