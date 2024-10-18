import { userTracks } from "./state.js";
import {
  setupEventListeners,
} from "./setupEventListeners.js";

export const manageCameraState = (uid, config) => {
  console.log(`Managing camera state for user with UID:`, uid);

  // Ensure that the user track exists in the global userTracks
  const userTrack = userTracks[uid];
  if (!userTrack) {
    console.log(`User track not found for UID: ${uid}`);
    return;
  }

  console.log(`User track for UID ${uid}:`, userTrack);

  // Handle camera video and avatar display for the actual user UID
  playCameraVideo(uid, config); // Pass config to playCameraVideo
  showAvatar(uid, config); // Pass config to showAvatar

  console.log("Camera state management completed for UID:", uid);
};




export const playCameraVideo = async (uid, config) => {
  const userTrack = userTracks[uid];
  const videoTrack = userTrack ? userTrack.videoTrack : null;

  console.log("playCameraVideo called for user with UID:", uid);

  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipVideoPlayer = document.getElementById(`pip-video-track`);
  const pipAvatarDiv = document.getElementById(`pip-avatar`);
  const screenShareElement = document.getElementById(`screen-share-content`);

  let isScreenSharing = false;
  const isCameraOn = !!videoTrack;

  if (uid === config.uid) {
    // Local user
    console.log("Processing local user in playCameraVideo.");

    // Use local state to determine if screen sharing is active
    isScreenSharing = config.isScreenSharing || false;
  } else {
    // Remote user
    // Fetch the RTM attributes of UID 1
    const attributes = await config.clientRTM.getUserAttributes("1");
    const sharingUser = attributes.sharingUser;
    isScreenSharing = sharingUser === uid.toString();
  }

  if (isScreenSharing) {
    console.log("Screen sharing is enabled, managing PiP for camera.");

    const screenShareTrack = userTracks[1]?.screenShareTrack;

    if (screenShareTrack && screenShareElement) {
      // Play the screen share track
      screenShareTrack.play(screenShareElement);
      screenShareElement.style.display = "block"; // Ensure screen share element is visible
      console.log("Playing screen share track in screen share element.");
    } else {
      console.warn("screenShareElement or screenShareTrack not found.");
    }

    // Play the camera in PiP if the camera is on
    if (isCameraOn && pipVideoPlayer) {
      videoTrack.play(pipVideoPlayer);
      pipVideoPlayer.style.display = "block"; // Show PiP video player
      if (pipAvatarDiv) pipAvatarDiv.style.display = "none"; // Hide PiP avatar
      console.log("Playing camera video track in PiP.");
    } else {
      console.log("Camera is off, hiding PiP.");
      if (pipVideoPlayer) pipVideoPlayer.style.display = "none";
      if (pipAvatarDiv) pipAvatarDiv.style.display = "block";
    }

    // Hide main video player
    if (videoPlayer) {
      videoPlayer.style.display = "none";
    }
  } else {
    console.log(
      "Screen sharing is not enabled, managing main video stage for camera."
    );

    // Show the camera feed in the main video stage
    if (isCameraOn && videoPlayer) {
      videoTrack.play(videoPlayer);
      videoPlayer.style.display = "block";
      console.log("Playing camera video track in main video stage.");
    } else {
      if (videoPlayer) videoPlayer.style.display = "none";
      console.log("Camera is off, hiding main video player.");
    }

    // Hide PiP when screen sharing is not active
    if (pipVideoPlayer) pipVideoPlayer.style.display = "none";
    if (pipAvatarDiv) pipAvatarDiv.style.display = "block";

    // Hide screen share element
    if (screenShareElement) {
      screenShareElement.style.display = "none";
    }
  }

  console.log("playCameraVideo function execution completed.");
};

export const showAvatar = async (uid, config) => {
  console.log(`Entering showAvatar for user with UID:`, uid);

  const userTrack = userTracks[uid];
  const isCameraOn = userTrack && userTrack.videoTrack;

  let isScreenSharing = false;

  if (uid === config.uid) {
    // Local user
    console.log("Processing local user in showAvatar.");

    // Use local state to determine if screen sharing is active
    isScreenSharing = config.isScreenSharing || false;
  } else {
    // Remote user
    // Fetch RTM attributes of UID 1 to check if the user is sharing their screen
    const attributes = await config.clientRTM.getUserAttributes("1");
    const sharingUser = attributes.sharingUser;
    isScreenSharing = sharingUser === uid.toString();
  }

  const avatarDiv = document.querySelector(`#avatar-${uid}`);
  const videoPlayer = document.querySelector(`#stream-${uid}`);
  const pipAvatarDiv = document.getElementById(`pip-avatar`);
  const pipVideoPlayer = document.getElementById(`pip-video-track`);
  const screenShareElement = document.getElementById(`screen-share-content`);

  if (!isCameraOn) {
    console.log("Camera is off, showing avatar for user with UID:", uid);

    if (isScreenSharing) {
      // When screen sharing is active and camera is off
      // Show the avatar in PiP
      if (pipAvatarDiv) {
        pipAvatarDiv.style.display = "block"; // Show PiP avatar
        console.log("Showing PiP avatar.");
      }

      // Hide PiP video player
      if (pipVideoPlayer) {
        pipVideoPlayer.style.display = "none";
        console.log("Hiding PiP video player.");
      }

      // Hide main video player
      if (videoPlayer) {
        videoPlayer.style.display = "none"; // Hide main video player
        console.log("Hiding main video player.");
      }

      // Hide main avatar
      if (avatarDiv) {
        avatarDiv.style.display = "none"; // Hide main avatar
        console.log("Hiding main avatar.");
      }
    } else {
      // When not screen sharing and camera is off
      // Show avatar in main video stage
      if (avatarDiv) {
        avatarDiv.style.display = "block"; // Show main avatar
        console.log("Showing main avatar.");
      }

      // Hide main video player
      if (videoPlayer) {
        videoPlayer.style.display = "none";
        console.log("Hiding main video player.");
      }

      // Hide PiP elements
      if (pipAvatarDiv) pipAvatarDiv.style.display = "none";
      if (pipVideoPlayer) pipVideoPlayer.style.display = "none";
      if (screenShareElement) screenShareElement.style.display = "none";
    }
  } else {
    console.log("Camera is on, hiding avatar for user with UID:", uid);

    if (isScreenSharing) {
      // When screen sharing is active and camera is on
      // Show PiP video player
      if (pipVideoPlayer) {
        pipVideoPlayer.style.display = "block"; // Show PiP video player
        console.log("Showing PiP video player.");
      }

      // Hide PiP avatar
      if (pipAvatarDiv) {
        pipAvatarDiv.style.display = "none"; // Hide PiP avatar
        console.log("Hiding PiP avatar.");
      }

      // Hide main video player
      if (videoPlayer) {
        videoPlayer.style.display = "none"; // Hide main video player
        console.log("Hiding main video player.");
      }

      // Hide main avatar
      if (avatarDiv) {
        avatarDiv.style.display = "none"; // Hide main avatar
        console.log("Hiding main avatar.");
      }
    } else {
      // When not screen sharing and camera is on
      // Show main video player
      if (videoPlayer) {
        videoPlayer.style.display = "block";
        console.log("Showing main video player.");
      }

      // Hide main avatar
      if (avatarDiv) {
        avatarDiv.style.display = "none";
        console.log("Hiding main avatar.");
      }

      // Hide PiP elements and screen share
      if (pipAvatarDiv) pipAvatarDiv.style.display = "none";
      if (pipVideoPlayer) pipVideoPlayer.style.display = "none";
      if (screenShareElement) screenShareElement.style.display = "none";
    }
  }

  console.log("Exiting showAvatar...");
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
    }

    // Clean up RTM client and channel
    if (config.screenShareRTMChannel) {
      await config.screenShareRTMChannel.leave();
      console.log("Left the RTM channel.");
      config.screenShareRTMChannel = null;
    }

    if (config.screenShareRTMClient) {
      await config.screenShareRTMClient.logout();
      console.log("Logged out of RTM client.");
      config.screenShareRTMClient = null;
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
    videoStage.style.display = "none";
    screenShareStage.style.display = "block";
  } else {
    console.log(`Toggling back to video stage for user with UID: ${uid}`);
    videoStage.style.display = "flex";
    screenShareStage.style.display = "none";

    // Ensure that after returning to the video stage, the avatar is shown if the camera is off
    const avatarDiv = document.querySelector(`#avatar-${uid}`);
    if (avatarDiv) {
      avatarDiv.style.display = "block"; // Force avatar visibility if camera is off
      console.log(`Avatar for UID ${uid} is displayed.`);
    } else {
      console.warn(`Avatar for UID ${uid} not found.`);
    }
  }
};




