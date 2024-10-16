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

    // Get the video player, avatar, and PiP elements
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
        console.log("Camera turned off and unpublished for user:", config.uid);

        // Show avatar and hide video in both the video stage and PiP
        if (config.localScreenShareEnabled && pipVideoPlayer && pipAvatarDiv) {
          toggleVideoOrAvatar(config.uid, null, pipAvatarDiv, pipVideoPlayer);
        } else {
          toggleVideoOrAvatar(config.uid, null, avatarDiv, videoPlayer);
        }

        config.localVideoTrackMuted = true;

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(false);
        }
      }
    } else {
      // Camera is off, turn it on
      console.log("Turning on the camera...");

      if (config.localVideoTrack) {
        // Enable and publish the video track
        await config.localVideoTrack.setEnabled(true);
        await config.client.publish([config.localVideoTrack]);
        console.log("Video track enabled and published for user:", config.uid);

        // Play video in the correct location depending on screen sharing
        if (config.localScreenShareEnabled && pipVideoPlayer && pipAvatarDiv) {
          // If screen sharing is active, play in the PiP (screen share stage)
          toggleVideoOrAvatar(
            config.uid,
            config.localVideoTrack,
            pipAvatarDiv,
            pipVideoPlayer
          );
        } else {
          // If not sharing screen, play in the video stage
          toggleVideoOrAvatar(
            config.uid,
            config.localVideoTrack,
            avatarDiv,
            videoPlayer
          );
        }

        config.localVideoTrackMuted = false;

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
      await setRTMAttributes(config); // Set RTM attributes
      toggleStages(true); // Switch to screen share stage
      manageCameraState(config.localVideoTrack !== null, config); // Manage PiP
    } else {
      await stopScreenShare(config); // Stop screen sharing
      await clearRTMAttributes(config); // Clear RTM attributes
      toggleStages(false); // Switch back to video stage
      manageCameraState(config.localVideoTrack !== null, config); // Show camera in main stage
    }

    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(isEnabled);
    }
  } catch (error) {
    console.error("Error during screen sharing toggle:", error);
  }
};

const startScreenShare = async (config) => {
  try {
    // Create the screen share track without a separate client
    config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
    console.log("Screen share track created:", config.localScreenShareTrack);

    // Play the screen share track
    const screenShareElement = document.getElementById("screen-share-content");
    config.localScreenShareTrack.play(screenShareElement);

    // Mark screen sharing as enabled
    config.localScreenShareEnabled = true;

    // Handle track-ended event
    config.localScreenShareTrack.on("track-ended", async () => {
      console.log("Screen share track ended, stopping screen share");
      await stopScreenShare(config); // Stop sharing when track ends
    });
  } catch (error) {
    console.error("Error creating screen share track:", error);
    throw error; // Propagate the error to handle it in toggleScreenShare
  }
};

const stopScreenShare = async (config) => {
  if (config.localScreenShareTrack) {
    config.localScreenShareTrack.stop();
    config.localScreenShareTrack.close();
    config.localScreenShareTrack = null;
  }

  config.localScreenShareEnabled = false;
};


const manageCameraState = (isCameraOn, config) => {
  if (isCameraOn) {
    playCameraVideo(config.localVideoTrack, config);
  } else {
    showAvatar(config);
  }
};

const playCameraVideo = (videoTrack, config) => {
  const videoPlayer = document.querySelector(`#stream-${config.uid}`);
  const pipVideoPlayer = document.getElementById("pip-video-track");

  if (config.localScreenShareEnabled) {
    // If screen is being shared, play in PiP
    if (pipVideoPlayer) videoTrack.play(pipVideoPlayer);
  } else {
    // Play in main video stage
    if (videoPlayer) videoTrack.play(videoPlayer);
  }
};

const showAvatar = (config) => {
  const avatarDiv = document.querySelector(`#avatar-${config.uid}`);
  const pipAvatarDiv = document.getElementById("pip-avatar");

  if (config.localScreenShareEnabled) {
    if (pipAvatarDiv) pipAvatarDiv.style.display = "block";
  } else {
    if (avatarDiv) avatarDiv.style.display = "block";
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

const toggleStages = (isScreenSharing) => {
  const videoStage = document.querySelector("#video-stage");
  const screenShareStage = document.querySelector("#screen-share-stage");

  if (isScreenSharing) {
    videoStage.style.display = "none";
    screenShareStage.style.display = "block";
  } else {
    videoStage.style.display = "flex";
    screenShareStage.style.display = "none";
  }
};













// Adjusted managePiP function to ensure the camera feed shows in PiP if the camera is on
export const managePiP = (config) => {
  const pipVideoTrack = document.getElementById("pip-video-track");
  const pipAvatar = document.getElementById("pip-avatar");

  if (pipVideoTrack && pipAvatar) {
    // If the user's camera is on, show the video track in PiP
    if (config.localVideoTrack) {
      pipVideoTrack.style.display = "block"; // Show video track
      pipAvatar.style.display = "none"; // Hide avatar
      config.localVideoTrack.play(pipVideoTrack);
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
