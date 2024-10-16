// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { toggleMicIcon,toggleVideoOrAvatar } from "./updateWrappers.js";
import { fetchTokens } from "./helperFunctions.js";
import {
  addUserWrapper,
  removeUserWrapper,
  addScreenShareWrapper,
  removeScreenShareWrapper,
} from "./wrappers.js";

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
  try {
    if (config.cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    config.cameraToggleInProgress = true;

    const videoPlayer = document.querySelector(`#stream-${config.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
    const pipVideoPlayer = document.querySelector(`#pip-video-track`);
    const pipAvatarDiv = document.querySelector(`#pip-avatar`);

    if (!videoPlayer || !avatarDiv) {
      console.error(`Video player or avatar not found for user ${config.uid}`);
      config.cameraToggleInProgress = false;
      return;
    }

    if (isMuted) {
      // Camera is currently on, turn it off
      if (config.localVideoTrack) {
        console.log("Turning off the camera...");

        // Unpublish and stop the video track
        await config.client.unpublish([config.localVideoTrack]);
        config.localVideoTrack.stop();
        config.localVideoTrack.setEnabled(false); // Disable the track but keep it
        config.localVideoTrackMuted = true; // ** Mark camera as muted **
        console.log("Camera turned off and unpublished for user:", config.uid);

        // Show avatar and hide video in both the video stage and PiP
        if (config.localScreenShareEnabled && pipVideoPlayer && pipAvatarDiv) {
          toggleVideoOrAvatar(config.uid, null, pipAvatarDiv, pipVideoPlayer);
        } else {
          toggleVideoOrAvatar(config.uid, null, avatarDiv, videoPlayer);
        }

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(false);
        }
      }
    } else {
      // Camera is off, turn it on
      console.log("Turning on the camera...");

      if (config.localVideoTrack) {
        await config.localVideoTrack.setEnabled(true);
        await config.client.publish([config.localVideoTrack]);
        config.localVideoTrackMuted = false; // ** Mark camera as unmuted **
        console.log("Video track enabled and published for user:", config.uid);

        // Play video in the correct location depending on screen sharing
        if (config.localScreenShareEnabled && pipVideoPlayer && pipAvatarDiv) {
          toggleVideoOrAvatar(
            config.uid,
            config.localVideoTrack,
            pipAvatarDiv,
            pipVideoPlayer
          );
        } else {
          toggleVideoOrAvatar(
            config.uid,
            config.localVideoTrack,
            avatarDiv,
            videoPlayer
          );
        }

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(true);
        }
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera:", error);
  } finally {
    config.cameraToggleInProgress = false;
  }
};



export const toggleScreenShare = async (isEnabled, config) => {
  try {
    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    if (config.localScreenShareEnabled && isEnabled) {
      console.log("Already sharing. Stopping screen share.");
      isEnabled = false;
    }

    if (isEnabled) {
      await startScreenShare(config); // Start screen sharing
    } else {
      await stopScreenShare(config); // Stop screen sharing
    }
  } catch (error) {
    console.error("Error during screen sharing toggle:", error);
  }
};


const startScreenShare = async (config) => {
  try {
    // Create the screen share track
    config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
    console.log("Screen share track created:", config.localScreenShareTrack);

    // Play the screen share track
    const screenShareElement = document.getElementById("screen-share-content");
    config.localScreenShareTrack.play(screenShareElement);

    // Ensure the camera is still on before managing PiP
    if (!config.localVideoTrack) {
      console.error(
        "Video track is undefined during screen share. Ensure the camera is on."
      );
      return; // Stop the execution if the video track is missing
    }

    // Mark screen sharing as enabled **before** managing PiP or camera
    config.localScreenShareEnabled = true;

    // Set the RTM attributes for screen sharing
    await setRTMAttributes(config);

    // Switch to screen share stage
    toggleStages(true, config); // Show screen-share stage and hide video stage

    // Manage PiP for the camera feed (if the camera is on)
    manageCameraState(config.localVideoTrack !== null, config);

    // Call the function to indicate screen sharing is on
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(true); // Indicate screen is on
    }

    // Handle track-ended event triggered by browser
    config.localScreenShareTrack.on("track-ended", async () => {
      console.log(
        "Screen share track ended by browser. Stopping screen share."
      );

      // Trigger stopScreenShare directly
      await stopScreenShare(config);
    });
  } catch (error) {
    console.error("Error creating screen share track:", error);
    throw error;
  }
};





const stopScreenShare = async (config) => {
  try {
    // Stop and close the screen share track
    if (config.localScreenShareTrack) {
      config.localScreenShareTrack.stop();
      config.localScreenShareTrack.close();
      config.localScreenShareTrack = null;
    }

    // Clear the RTM attributes for screen sharing
    await clearRTMAttributes(config);

    // Mark screen sharing as disabled before switching stages
    config.localScreenShareEnabled = false;

    // Switch back to the video stage and check if config.uid is available
    toggleStages(false, config); // Ensure config is passed

    // Manage camera state in the main video stage
    manageCameraState(config.localVideoTrack !== null, config);

    // Call the function to indicate screen sharing is off
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(false); // Indicate screen is off
    }
  } catch (error) {
    console.error("Error stopping screen share:", error);
    throw error;
  }
};




const manageCameraState = (config) => {
  console.log("Camera state:", !config.localVideoTrackMuted);

  if (!config.localVideoTrackMuted) {
    playCameraVideo(config.localVideoTrack, config); // If camera is on, play the video
  } else {
    showAvatar(config); // If camera is off, show the avatar
  }
};


const playCameraVideo = (videoTrack, config) => {
  if (!videoTrack) {
    console.error("Video track is undefined. Ensure the camera is on.");
    return; // Exit if no video track is provided
  }

  if (!config || typeof config !== "object") {
    console.error("Invalid config object. Ensure proper config is passed.");
    return; // Exit if config is not a valid object
  }

  const videoPlayer = document.querySelector(`#stream-${config.uid}`);
  const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
  const pipVideoPlayer = document.getElementById("pip-video-track");
  const pipAvatarDiv = document.getElementById("pip-avatar");

  console.log("videoPlayer element:", videoPlayer);
  console.log("avatarDiv element:", avatarDiv);
  console.log("pipVideoPlayer element:", pipVideoPlayer);
  console.log("pipAvatarDiv element:", pipAvatarDiv);

  if (config.localScreenShareEnabled) {
    // Play camera in PiP
    if (pipVideoPlayer) {
      console.log("Playing video track in PiP.");
      videoTrack.play(pipVideoPlayer);
      pipVideoPlayer.style.display = "block";
    } else {
      console.warn("pipVideoPlayer not found.");
    }

    if (pipAvatarDiv) {
      console.log("Hiding PiP avatar.");
      pipAvatarDiv.style.display = "none";
    } else {
      console.warn("pipAvatarDiv not found.");
    }
  } else {
    // Play in main video stage
    if (videoPlayer) {
      console.log("Playing video track in main video stage.");
      videoTrack.play(videoPlayer);
      videoPlayer.style.display = "block";
    } else {
      console.warn("videoPlayer not found.");
    }

    if (avatarDiv) {
      console.log("Hiding main avatar.");
      avatarDiv.style.display = "none";
    } else {
      console.warn("avatarDiv not found.");
    }
  }

  console.log("playCameraVideo function execution completed.");
};



const showAvatar = (config) => {
  const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
  const videoPlayer = document.querySelector(`#stream-${config.uid}`);
  const pipAvatarDiv = document.getElementById("pip-avatar");
  const pipVideoPlayer = document.getElementById("pip-video-track");

  if (config.localScreenShareEnabled) {
    // Show avatar in PiP
    if (pipAvatarDiv) {
      pipAvatarDiv.style.display = "block"; // Show PiP avatar
    }
    if (pipVideoPlayer) {
      pipVideoPlayer.style.display = "none"; // Hide PiP video player
    }
  } else {
    // Show avatar in the main video stage
    if (avatarDiv) {
      avatarDiv.style.display = "block"; // Show main avatar
    }
    if (videoPlayer) {
      videoPlayer.style.display = "none"; // Hide main video player
    }
  }
};


const setRTMAttributes = async (config) => {
  if (config.clientRTM) {
    const attributes = { uidSharingScreen: config.uid.toString() };
    await config.clientRTM.setLocalUserAttributes(attributes);
    console.log(`Screen share UID attribute set for user ${config.uid}`);
  }
};

const clearRTMAttributes = async (config) => {
  if (config.clientRTM) {
    await config.clientRTM.clearLocalUserAttributes();
    console.log(`Screen share UID attribute cleared for user ${config.uid}`);
  }
};
const toggleStages = (isScreenSharing, config) => {
  const videoStage = document.getElementById("video-stage");
  const screenShareStage = document.getElementById("screen-share-stage");

  if (!config || !config.uid) {
    console.error("toggleStages: config or config.uid is undefined.");
    return; // Exit early to prevent further errors
  }

  if (isScreenSharing) {
    videoStage.style.display = "none";
    screenShareStage.style.display = "block";
  } else {
    videoStage.style.display = "flex";
    screenShareStage.style.display = "none";

    // Ensure that after returning to the video stage, the avatar is shown if the camera is off
    const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
    if (avatarDiv) {
      avatarDiv.style.display = "block"; // Force avatar visibility if camera is off
    } else {
      console.warn(`Avatar for UID ${config.uid} not found.`);
    }
  }
};








export const managePiP = (config) => {
  const pipVideoTrack = document.getElementById("pip-video-track");
  const pipAvatar = document.getElementById("pip-avatar");

  if (pipVideoTrack && pipAvatar) {
    // If the user's camera is on, show the video track in PiP
    if (config.localVideoTrack) {
      pipVideoTrack.style.display = "block"; // Show video track
      pipAvatar.style.display = "none"; // Hide avatar
      config.localVideoTrack.play(pipVideoTrack); // Ensure camera feed plays in PiP
    } else {
      // If the user's camera is off, show the avatar in PiP
      pipVideoTrack.style.display = "none"; // Hide video track
      pipAvatar.style.display = "block"; // Show avatar
    }
  } else {
    console.error("PiP elements not found in the DOM.");
  }
};




// RTM Join function for screen share
const joinRTMForScreenShare = async (
  rtmToken,
  screenShareUid,
  config,
  retryCount = 0
) => {
  try {
    const rtmUid = screenShareUid.toString();

    // Initialize RTM client for screen sharing if not done already
    if (!config.screenShareClientRTM) {
      console.log("Initializing screenShare RTM client");
      config.screenShareClientRTM = AgoraRTM.createInstance(config.appId);
    }

    // Logout if already logged in
    if (config.screenShareClientRTM._logined) {
      console.log("Logging out from previous screen share RTM session.");
      await config.screenShareClientRTM.logout();
    }

    // Log the UID and token for debugging
    console.log(`Logging into RTM for screen share with UID: ${rtmUid}`);
    console.log(`Using RTM Token: ${rtmToken}`);

    // Login to RTM with the screen share UID
    await config.screenShareClientRTM.login({ uid: rtmUid, token: rtmToken });

    // Set RTM attributes for screen sharing (uidSharingScreen is the main UID of the user sharing)
    const attributes = {
      name: config.user.name || "Unknown (Screen Share)",
      avatar: config.user.avatar || "default-avatar-url",
      comp: config.user.company || "",
      desg: config.user.designation || "Screen Share",
      role: "host", // Assign host role for screen sharing
      uidSharingScreen: config.uid.toString(), // Indicate the UID of the user sharing the screen
    };

    // Set the RTM attributes
    await config.screenShareClientRTM.setLocalUserAttributes(attributes);
    console.log(
      `Screen share RTM attributes set for UID: ${rtmUid}, Sharing UID: ${config.uid}`
    );

    // Fetch the attributes to confirm they are set
    const setAttributes = await config.screenShareClientRTM.getUserAttributes(
      rtmUid
    );
    console.log(`RTM Attributes after setting:`, setAttributes);

    // Join the RTM channel for screen sharing
    if (!config.screenShareRTMChannel) {
      config.screenShareRTMChannel = config.screenShareClientRTM.createChannel(
        config.channelName
      );
    }

    console.log("Joining the RTM channel for screen share.");
    await config.screenShareRTMChannel.join();
    console.log("Successfully joined RTM channel for screen share.");
  } catch (error) {
    console.error(`Error during RTM login for screen share: ${error.message}`);

    // Retry logic in case of certain errors (code 5)
    if (error.code === 5 && retryCount < 3) {
      console.log(
        `Retrying RTM login for screen share (attempt ${retryCount + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Retry after delay
      return joinRTMForScreenShare(
        rtmToken,
        screenShareUid,
        config,
        retryCount + 1
      );
    } else {
      throw new Error(
        "Failed to join RTM for screen share after multiple attempts"
      );
    }
  }
};



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
