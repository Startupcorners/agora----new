// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { toggleMicIcon,toggleVideoOrAvatar } from "./updateWrappers.js";

export const toggleMic = async (isMuted, config) => {
  try {
    if (isMuted) {
      if (config.localAudioTrack) {
        console.log("Muting microphone for user:", config.uid);

        // Unpublish and stop the audio track
        await config.client.unpublish([config.localAudioTrack]);
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
        config.localAudioTrack = null; // Remove the audio track reference

        log("Microphone muted and unpublished");

        // Toggle the mic icon to show that the microphone is muted
        toggleMicIcon(config.uid, true);
      } else {
        console.warn("No microphone track to mute for user:", config.uid);
      }
    } else {
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
        log("Microphone unmuted and published");

        // Toggle the mic icon to show that the microphone is unmuted
        toggleMicIcon(config.uid, false);
      } else {
        console.log("Microphone track already exists for user:", config.uid);
      }
    }
  } catch (error) {
    console.error("Error in toggleMic:", error);
  }
};


export const toggleCamera = async (isMuted, config) => {
  try {
    // Get the video player and avatar elements for the current user
    const videoPlayer = document.querySelector(`#stream-${config.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${config.uid}`);

    console.log("Toggling camera for user:", config.uid);
    console.log("Video player element:", videoPlayer);
    console.log("Avatar element:", avatarDiv);

    if (!videoPlayer) {
      console.error(`Video player for user ${config.uid} not found!`);
      return;
    }

    if (!avatarDiv) {
      console.error(`Avatar element for user ${config.uid} not found!`);
      return;
    }

    if (isMuted) {
      // Turn off the camera
      if (config.localVideoTrack) {
        console.log("Turning off the camera...");

        await config.client.unpublish([config.localVideoTrack]);
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
        config.localVideoTrack = null; // Ensure the video track is completely removed

        console.log("Camera turned off and unpublished for user:", config.uid);

        // Show avatar, hide video
        toggleVideoOrAvatar(config.uid, null, avatarDiv, videoPlayer);
        console.log("Avatar shown, video hidden for user:", config.uid);

        config.localVideoTrackMuted = true; // Set muted status
      } else {
        console.warn("No video track to turn off for user:", config.uid);
      }
    } else {
      // Turn on the camera
      console.log("Turning on the camera...");

      // Check if the video track already exists
      if (!config.localVideoTrack) {
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack(); // Create a new video track

        if (!config.localVideoTrack) {
          console.error("Failed to create a new video track!");
          return;
        }

        console.log("Created new video track for user:", config.uid);

        await config.client.publish([config.localVideoTrack]);
        console.log("Published new video track for user:", config.uid);
      } else {
        console.log("Video track already exists for user:", config.uid);
      }

      // Play video and hide avatar
      toggleVideoOrAvatar(
        config.uid,
        config.localVideoTrack,
        avatarDiv,
        videoPlayer
      );
      console.log("Video shown, avatar hidden for user:", config.uid);

      config.localVideoTrackMuted = false; // Update the muted status
    }
  } catch (error) {
    console.error("Error in toggleCamera:", error);
  }
};





import { toggleVideoOrAvatar } from "./updateWrappers.js";

export const toggleScreenShare = async (
  isEnabled,
  config,
  wasCameraOnBeforeSharing
) => {
  try {
    const uid = config.uid;

    // Ensure UID is set
    if (!uid) {
      console.error("UID is not set in config.");
      return;
    }

    const videoPlayer = document.querySelector(`#stream-${uid}`);
    const avatar = document.querySelector(`#avatar-${uid}`);

    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    if (!videoPlayer) {
      console.error(`Video player with id #stream-${uid} not found`);
      return;
    }

    if (config.localScreenShareEnabled && isEnabled) {
      log(config, "Already sharing. Stopping screen share.");
      isEnabled = false; // This will stop the current screen share
    }

    if (isEnabled) {
      log(config, "Starting screen share");
      wasCameraOnBeforeSharing = !config.localVideoTrackMuted;

      // Create the screen share track if it doesn't already exist
      if (!config.localScreenShareTrack) {
        log(config, "Creating screen share track...");
        config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
      }

      // Stop and unpublish the local video track before screen share
      if (config.localVideoTrack) {
        log(
          config,
          "Stopping and unpublishing local video track before screen share..."
        );
        config.localVideoTrack.stop();
        await config.client.unpublish([config.localVideoTrack]);
      }

      // Play and publish the screen share track
      config.localScreenShareTrack.on("track-ended", async () => {
        log(config, "Screen share track ended, reverting back to camera");
        await toggleScreenShare(false, config, wasCameraOnBeforeSharing);
      });

      await config.client.publish([config.localScreenShareTrack]);

      // Use toggleVideoOrAvatar to handle video or avatar display
      toggleVideoOrAvatar(
        uid,
        config.localScreenShareTrack,
        avatar,
        videoPlayer
      );
    } else {
      log(config, "Stopping screen share");

      // Stop the screen share and revert to the camera
      if (config.localScreenShareTrack) {
        log(config, "Stopping and closing the screen share track...");
        config.localScreenShareTrack.stop();
        config.localScreenShareTrack.close();
        await config.client.unpublish([config.localScreenShareTrack]);
        config.localScreenShareTrack = null;
      }

      // Reinitialize the camera track only if it was on before sharing
      if (wasCameraOnBeforeSharing) {
        log(config, "Restoring camera track after screen share...");
        if (!config.localVideoTrack) {
          log(config, "Creating new camera video track...");
          config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        }

        await config.client.publish([config.localVideoTrack]);

        // Use toggleVideoOrAvatar to handle video or avatar display
        toggleVideoOrAvatar(uid, config.localVideoTrack, avatar, videoPlayer);
      } else {
        log(config, "Camera was off before sharing, showing avatar...");
        toggleVideoOrAvatar(uid, null, avatar, videoPlayer); // Show avatar if the camera was off
      }
    }

    config.localScreenShareEnabled = isEnabled;
    config.onScreenShareEnabled(isEnabled);
  } catch (error) {
    console.error("Error during screen sharing:", error);
    if (config.onError) {
      config.onError(error);
    }

    // Ensure local video is active in case of an error
    if (!isEnabled && !config.localVideoTrack) {
      try {
        log(config, "Reinitializing camera track after error...");
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await config.client.publish([config.localVideoTrack]);

        // Use toggleVideoOrAvatar to handle video or avatar display after error
        toggleVideoOrAvatar(uid, config.localVideoTrack, avatar, videoPlayer);
      } catch (cameraError) {
        console.error("Error reinitializing camera track:", cameraError);
      }
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

