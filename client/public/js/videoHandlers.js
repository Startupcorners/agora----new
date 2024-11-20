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





export const stopScreenShare = async (screenShareUid, config) => {
  try {
    console.log(`Stopping screen share for screenShareUid: ${screenShareUid}`);

    // Get the screen share track
    const screenShareTrack = userTracks[screenShareUid]?.screenShareTrack;

    if (screenShareTrack) {
      // Unpublish the screen share track
      await config.screenShareClient.unpublish(screenShareTrack);

      // Stop and close the track
      screenShareTrack.stop();
      screenShareTrack.close();

      // Remove the track from userTracks
      userTracks[screenShareUid].screenShareTrack = null;

      console.log("Screen share track stopped and unpublished.");
    } else {
      console.warn("Screen share track not found.");
    }

    // Ensure the screen share client leaves the RTC channel
    if (config.screenShareClient) {
      await config.screenShareClient.leave();
      console.log("Screen share RTC client has left the channel.");
      config.screenShareClient = null;
    } else {
      console.log("No screen share RTC client to leave.");
    }

    // Clean up RTM client and channel
    if (config.screenShareRTMChannel) {
      await config.screenShareRTMChannel.leave();
      console.log("Left the RTM channel.");
      config.screenShareRTMChannel = null;
    } else {
      console.log("No RTM channel to leave.");
    }

    if (config.screenShareRTMClient) {
      await config.screenShareRTMClient.logout();
      console.log("Logged out of RTM client.");
      config.screenShareRTMClient = null;
    } else {
      console.log("No RTM client to log out.");
    }

    // Remove any remaining listeners for token renewals, etc.
    if (config.screenShareClient) {
      config.screenShareClient.off("token-privilege-will-expire");
      console.log("Removed event listeners from screen share RTC client.");
    }

    // Update local state to indicate screen sharing has stopped
    config.isScreenSharing = false;

    // Update UI accordingly
    manageCameraState(config.uid, config);
    toggleStages(false, config.uid);
    console.log("Screen share stopped and UI updated.");
  } catch (error) {
    console.error("Error stopping screen share:", error);
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





