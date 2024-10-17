// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { toggleMicIcon} from "./updateWrappers.js";
import {
  startScreenShare,
  stopScreenShare,
  manageCameraState,
  playCameraVideo,
  showAvatar,
} from "./videoHandlers.js";
import { userTracks } from "./state.js"; // Import userTracks from state.js


export const toggleMic = async (config) => {
  try {
    // Invert the current mute state
    const isMuted = !config.localAudioTrackMuted;
    console.log(`toggleMic called. Current isMuted: ${isMuted}`);

    if (isMuted) {
      // Muting the microphone
      if (config.localAudioTrack) {
        console.log("Muting microphone for user:", config.uid);

        // Unpublish and stop the audio track
        await config.client.unpublish([config.localAudioTrack]);
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
        config.localAudioTrack = null; // Remove the audio track reference

        console.log("Microphone muted and unpublished");

        // Toggle the mic icon to show that the microphone is muted
        toggleMicIcon(config.uid, true);
      } else {
        console.warn("No microphone track to mute for user:", config.uid);
      }
    } else {
      // Unmuting the microphone
      console.log("Unmuting microphone for user:", config.uid);

      // Check if the audio track already exists
      if (!config.localAudioTrack) {
        config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

        if (!config.localAudioTrack) {
          console.error("Failed to create a new audio track!");
          return;
        }

        console.log("Created new audio track for user:", config.uid);

        // Publish the new audio track
        await config.client.publish([config.localAudioTrack]);
        console.log("Microphone unmuted and published");

        // Toggle the mic icon to show that the microphone is unmuted
        toggleMicIcon(config.uid, false);
      } else {
        console.log("Microphone track already exists for user:", config.uid);
      }
    }

    // Update the mute state in config
    config.localAudioTrackMuted = isMuted;

    // Call bubble_fn_isMicOff with the current mute state
    if (typeof bubble_fn_isMicOff === "function") {
      bubble_fn_isMicOff(isMuted);
    } else {
      console.warn("bubble_fn_isMicOff is not defined.");
    }
  } catch (error) {
    console.error("Error in toggleMic:", error);
  }
};

export const toggleCamera = async (isMuted, config) => {
  let uid;
  let userTrack;

  try {
    // Ensure config and uid are defined
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    uid = config.uid; // Assign UID from config
    console.log("User's UID:", uid); // Confirm UID is set

    userTrack = userTracks[uid];

    if (!userTrack) {
      console.error(`User track for UID ${uid} is undefined.`);
      return;
    }

    // Create a shallow copy of the userTrack to avoid direct mutation
    userTrack = { ...userTrack };

    // Check if camera toggle is already in progress
    if (userTrack.cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    // Set camera toggle in progress
    userTrack.cameraToggleInProgress = true;

    if (isMuted) {
      // Camera is currently on, turn it off
      if (userTrack.videoTrack) {
        console.log("Turning off the camera...");

        // Unpublish and stop the video track
        await config.client.unpublish([userTrack.videoTrack]);
        userTrack.videoTrack.stop();

        // Set videoTrack to null and update isVideoMuted
        userTrack.videoTrack = null;
        userTrack.isVideoMuted = true;

        // Update userTracks[uid] with the modified userTrack
        userTracks[uid] = { ...userTrack };

        console.log("Camera turned off and unpublished for user:", uid);

        // Use generalized function to manage the camera state
        manageCameraState(uid);

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(false);
        }
      }
    } else {
      // Camera is off, turn it on
      console.log("Turning on the camera...");

      // Check if the video track exists or create a new one
      if (!userTrack.videoTrack) {
        console.log("Creating a new camera video track.");
        userTrack.videoTrack = await AgoraRTC.createCameraVideoTrack();
      } else {
        console.log("Using existing camera video track.");
      }

      await userTrack.videoTrack.setEnabled(true);
      await config.client.publish([userTrack.videoTrack]);
      userTrack.isVideoMuted = false;

      // Update userTracks[uid] with the modified userTrack
      userTracks[uid] = { ...userTrack };

      console.log("Video track enabled and published for user:", uid);

      // Use generalized function to manage the camera state
      manageCameraState(uid);

      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(true);
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera:", error);
  } finally {
    // Ensure toggle progress is reset
    if (userTracks[uid]) {
      userTracks[uid].cameraToggleInProgress = false;
    }
  }
};


export const toggleScreenShare = async (isEnabled, uid, config) => {
  try {
    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    const userTrack = userTracks[uid]; // Access the correct userTrack

    if (!userTrack) {
      console.error(`No user track found for user with UID: ${uid}`);
      return;
    }

    // Check if the user is already screen sharing
    const isScreenSharing = !!userTrack.screenShareTrack;

    if (isScreenSharing && isEnabled) {
      console.log(`User is already sharing. Stopping screen share.`);
      isEnabled = false; // Disable screen share
    }

    if (isEnabled) {
      await startScreenShare(uid, config); // Start screen sharing
    } else {
      await stopScreenShare(uid, config); // Stop screen sharing
    }
  } catch (error) {
    console.error(`Error during screen sharing toggle:`, error);
  }
};



// const startScreenShare = async (uid, userType) => {
//   try {
//     console.log(`Starting screen share process for ${userType} user with UID:`, uid);

//     // Get the userTrack information
//     const userTrack = userTracks[uid];

//     // Try to create the screen share track
//     userTrack.screenShareTrack = await AgoraRTC.createScreenVideoTrack();
//     console.log(`${userType} screen share track created:`, userTrack.screenShareTrack);

//     // Play the screen share track
//     const screenShareElement = document.getElementById(`${userType}-screen-share-content`);
//     userTrack.screenShareTrack.play(screenShareElement);

//     // Ensure the camera is still on before managing PiP
//     if (!userTrack.videoTrack) {
//       console.error(`Video track is undefined during screen share for ${userType}.`);
//       return; // Stop the execution if the video track is missing
//     }

//     console.log(`Video track found for ${userType}, proceeding to manage PiP...`);

//     // Mark screen sharing as enabled **before** managing PiP or camera
//     userTrack.screenShareEnabled = true;

//     // Set RTM attributes for screen sharing
//     console.log(`Setting RTM attributes for ${userType} screen sharing...`);
//     await setRTMAttributes(uid);

//     // Switch to screen share stage
//     console.log(`Toggling stages: switching to screen-share stage for ${userType}...`);
//     toggleStages(true, uid, userType); // Show screen-share stage and hide video stage

//     // Manage PiP for the camera feed (if the camera is on)
//     manageCameraState(uid, userType);

//     // Call the function to indicate screen sharing is on
//     if (typeof bubble_fn_isScreenOn === "function") {
//       console.log(`Calling bubble_fn_isScreenOn(true) to indicate screen sharing is on for ${userType}...`);
//       bubble_fn_isScreenOn(true); // Indicate screen is on
//     }

//     // Handle track-ended event triggered by browser
//     userTrack.screenShareTrack.on("track-ended", async () => {
//       console.log(`${userType} screen share track ended by browser. Stopping screen share.`);

//       // Trigger stopScreenShare directly
//       await stopScreenShare(uid, userType);
//     });
//   } catch (error) {
//     // Handle case when user cancels the screen sharing permission prompt
//     if (error.name === "NotAllowedError" || error.message.includes("Permission denied")) {
//       console.log(`User canceled the screen sharing prompt for ${userType}.`);
//       if (typeof bubble_fn_isScreenOn === "function") {
//         bubble_fn_isScreenOn(false); // Reset screen sharing state
//       }
//     } else {
//       // Handle other errors
//       console.error(`Error creating screen share track for ${userType}:`, error);
//     }
//   }
// };





// const stopScreenShare = async (config) => {
//   try {
//     console.log("Stopping screen share...");

//     // Stop and close the screen share track
//     if (config.localScreenShareTrack) {
//       config.localScreenShareTrack.stop();
//       config.localScreenShareTrack.close();
//       config.localScreenShareTrack = null;
//       console.log("Screen share track stopped and closed.");
//     } else {
//       console.warn("No active screen share track found to stop.");
//     }

//     // Clear the RTM attributes for screen sharing
//     console.log("Clearing RTM attributes for screen sharing...");
//     await clearRTMAttributes(config);

//     // Mark screen sharing as disabled before switching stages
//     config.localScreenShareEnabled = false;
//     console.log("Screen sharing marked as disabled.");

//     // Switch back to the video stage
//     console.log("Toggling stages: switching to video stage...");
//     toggleStages(false, config); // Ensure config is passed

//     // Manage camera state in the main video stage
//     console.log("Managing camera state after screen share stopped...");
//     manageCameraState(config); // Simply pass config, as manageCameraState handles the checks

//     // Call the function to indicate screen sharing is off
//     if (typeof bubble_fn_isScreenOn === "function") {
//       console.log(
//         "Calling bubble_fn_isScreenOn(false) to indicate screen sharing is off..."
//       );
//       bubble_fn_isScreenOn(false); // Indicate screen is off
//     }
//   } catch (error) {
//     console.error("Error stopping screen share:", error);
//     throw error;
//   }
// };



// const manageCameraState = (config) => {
//   console.log("Managing camera state...");

//   // Simply call both functions and let them handle the decision-making
//   playCameraVideo(config.localVideoTrack, config); // Always try to play the camera video
//   showAvatar(config); // Always try to show the avatar

//   console.log("Camera state management completed.");
// };





// const playCameraVideo = (videoTrack, config) => {
//   console.log(
//     "playCameraVideo called with videoTrack:",
//     videoTrack,
//     "config:",
//     config
//   );

//   if (!videoTrack) {
//     console.error("Error: Video track is undefined. Ensure the camera is on.");
//     return;
//   }

//   // Define video elements
//   const videoPlayer = document.querySelector(`#stream-${config.uid}`);
//   const pipVideoPlayer = document.getElementById("pip-video-track");
//   const pipAvatarDiv = document.getElementById("pip-avatar");

//   const isCameraOn = videoTrack && !config.localVideoTrackMuted;

//   if (isCameraOn) {
//     if (config.localScreenShareEnabled) {
//       console.log("Screen sharing is enabled, managing PiP.");

//       // If screen is being shared, play camera in PiP
//       if (pipVideoPlayer) {
//         console.log("Playing video track in PiP.");
//         videoTrack.play(pipVideoPlayer);
//         pipVideoPlayer.style.display = "block"; // Ensure PiP video player is visible
//       } else {
//         console.warn("pipVideoPlayer not found.");
//       }

//       if (pipAvatarDiv) {
//         console.log("Hiding PiP avatar.");
//         pipAvatarDiv.style.display = "none"; // Hide PiP avatar if the camera is on
//       }
//     } else {
//       console.log("Screen sharing is not enabled, managing main video stage.");

//       // Play the camera feed in the main video stage
//       if (videoPlayer) {
//         console.log("Playing video track in main video stage.");
//         videoTrack.play(videoPlayer);
//         videoPlayer.style.display = "block"; // Ensure main video player is visible
//       } else {
//         console.warn("videoPlayer not found.");
//       }
//     }
//   } else {
//     console.log("Camera is off or muted, skipping play.");
//   }

//   console.log("playCameraVideo function execution completed.");
// };


// const showAvatar = (config) => {
//   console.log("Entering showAvatar...");

//   const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
//   const videoPlayer = document.querySelector(`#stream-${config.uid}`);
//   const pipAvatarDiv = document.getElementById("pip-avatar");
//   const pipVideoPlayer = document.getElementById("pip-video-track");

//   console.log("localScreenShareEnabled:", config.localScreenShareEnabled);
//   console.log("Avatar div:", avatarDiv);
//   console.log("Video player:", videoPlayer);
//   console.log("PiP Avatar div:", pipAvatarDiv);
//   console.log("PiP Video player:", pipVideoPlayer);

//   // Check if the camera is on or off
//   const isCameraOn = config.localVideoTrack && !config.localVideoTrackMuted;

//   if (!isCameraOn) {
//     console.log("Camera is off or muted, showing avatar.");

//     if (config.localScreenShareEnabled) {
//       // Show avatar in PiP
//       if (pipAvatarDiv) {
//         console.log("Showing PiP avatar.");
//         pipAvatarDiv.style.display = "block"; // Show PiP avatar
//       } else {
//         console.warn("PiP avatar div not found.");
//       }

//       if (pipVideoPlayer) {
//         console.log("Hiding PiP video player.");
//         pipVideoPlayer.style.display = "none"; // Hide PiP video player
//       } else {
//         console.warn("PiP video player not found.");
//       }
//     } else {
//       // Show avatar in the main video stage
//       if (avatarDiv) {
//         console.log("Showing main avatar.");
//         avatarDiv.style.display = "block"; // Show main avatar
//       } else {
//         console.warn("Main avatar div not found.");
//       }

//       if (videoPlayer) {
//         console.log("Hiding main video player.");
//         videoPlayer.style.display = "none"; // Hide main video player
//       } else {
//         console.warn("Main video player not found.");
//       }
//     }
//   } else {
//     console.log("Camera is on, hiding avatar.");

//     if (config.localScreenShareEnabled) {
//       // Hide avatar in PiP when camera is on
//       if (pipAvatarDiv) {
//         console.log("Hiding PiP avatar.");
//         pipAvatarDiv.style.display = "none"; // Hide PiP avatar
//       }

//       if (pipVideoPlayer) {
//         console.log("Showing PiP video player.");
//         pipVideoPlayer.style.display = "block"; // Show PiP video player
//       }
//     } else {
//       // Hide avatar in the main video stage when the camera is on
//       if (avatarDiv) {
//         console.log("Hiding main avatar.");
//         avatarDiv.style.display = "none"; // Hide main avatar
//       }

//       if (videoPlayer) {
//         console.log("Showing main video player.");
//         videoPlayer.style.display = "block"; // Show main video player
//       }
//     }
//   }

//   console.log("Exiting showAvatar...");
// };


// const setRTMAttributes = async (config) => {
//   if (config.clientRTM) {
//     const attributes = { uidSharingScreen: config.uid.toString() };
//     await config.clientRTM.setLocalUserAttributes(attributes);
//     console.log(`Screen share UID attribute set for user ${config.uid}`);
//   }
// };

// const clearRTMAttributes = async (config) => {
//   if (config.clientRTM) {
//     await config.clientRTM.clearLocalUserAttributes();
//     console.log(`Screen share UID attribute cleared for user ${config.uid}`);
//   }
// };
// const toggleStages = (isScreenSharing, config) => {
//   const videoStage = document.getElementById("video-stage");
//   const screenShareStage = document.getElementById("screen-share-stage");

//   if (!config || !config.uid) {
//     console.error("toggleStages: config or config.uid is undefined.");
//     return; // Exit early to prevent further errors
//   }

//   if (isScreenSharing) {
//     videoStage.style.display = "none";
//     screenShareStage.style.display = "block";
//   } else {
//     videoStage.style.display = "flex";
//     screenShareStage.style.display = "none";

//     // Ensure that after returning to the video stage, the avatar is shown if the camera is off
//     const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
//     if (avatarDiv) {
//       avatarDiv.style.display = "block"; // Force avatar visibility if camera is off
//     } else {
//       console.warn(`Avatar for UID ${config.uid} not found.`);
//     }
//   }
// };













export const removeParticipant = async (clientRTM, uid, config) => {
  try {
    // If RTM is enabled, you can also send a message or notification to the participant before removal
    if (clientRTM) {
      const message = "You have been removed from the session";
      await sendMessageToPeer(clientRTM, uid.toString(), message);
    }

    // Remove the participant's tracks from the Agora RTC client
    const participant = config.remoteTracks[uid];
    if (participant && participant.videoTrack) {
      participant.videoTrack.stop();
      participant.videoTrack.close();
    }
    if (participant && participant.audioTrack) {
      participant.audioTrack.stop();
      participant.audioTrack.close();
    }

    // Unpublish the participant from the Agora RTC client
    await config.client.unpublish([
      participant.audioTrack,
      participant.videoTrack,
    ]);

    // Remove the participant from the remoteTracks object
    delete config.remoteTracks[uid];

    // Remove the participant's UI element from the DOM
    const player = document.querySelector(`#video-wrapper-${uid}`);
    if (player) {
      player.remove();
    }

    log(`Participant with UID ${uid} has been removed from the session`);
  } catch (error) {
    console.error(`Error removing participant with UID ${uid}:`, error);
  }
};
