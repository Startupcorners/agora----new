// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { toggleMicIcon,toggleVideoOrAvatar } from "./updateWrappers.js";

export const toggleMic = async (isMuted, config) => {
  try {
    if (isMuted) {
      if (config.localAudioTrack) {
        // Unpublish and stop the audio track
        await config.client.unpublish([config.localAudioTrack]);
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
        config.localAudioTrack = null;

        log("Microphone muted and unpublished");

        // Toggle the mic icon to show that the microphone is muted
        toggleMicIcon(config.uid, true);
      }
    } else {
      // Create and publish a new audio track
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await config.client.publish([config.localAudioTrack]);

      log("Microphone unmuted and published");

      // Toggle the mic icon to show that the microphone is unmuted
      toggleMicIcon(config.uid, false);
    }
  } catch (error) {
    console.error("Error in toggleMic:", error);
  }
};


import { toggleVideoOrAvatar } from "./updateWrappers.js"; // Ensure toggleVideoOrAvatar is imported

export const toggleCamera = async (isMuted, config) => {
  try {
    const videoPlayer = document.querySelector(`#stream-${config.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${config.uid}`);

    if (isMuted) {
      if (config.localVideoTrack) {
        // Unpublish and stop the video track
        await config.client.unpublish([config.localVideoTrack]);
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
        config.localVideoTrack = null;

        log("Camera turned off and unpublished");

        // Toggle to show avatar since the camera is turned off
        toggleVideoOrAvatar(config.uid, null, avatarDiv, videoPlayer);
      }
    } else {
      // Create and publish the new video track
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      await config.client.publish([config.localVideoTrack]);
      log("Camera turned on and published");

      // Toggle to show video since the camera is turned on
      toggleVideoOrAvatar(
        config.uid,
        config.localVideoTrack,
        avatarDiv,
        videoPlayer
      );
    }
  } catch (error) {
    console.error("Error in toggleCamera:", error);
  }
};




// toggleScreenShare Function
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
        videoPlayer.style.display = "none";
      }

      // Play and publish the screen share track
      config.localScreenShareTrack.on("track-ended", async () => {
        log(config, "Screen share track ended, reverting back to camera");
        await toggleScreenShare(false, config, wasCameraOnBeforeSharing);
      });

      await config.client.publish([config.localScreenShareTrack]);
      config.localScreenShareTrack.play(videoPlayer);
      videoPlayer.style.display = "block";
      avatar.style.display = "none";
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
        config.localVideoTrack.play(videoPlayer);
        videoPlayer.style.display = "block";
        avatar.style.display = "none";
      } else {
        log(config, "Camera was off before sharing, showing avatar...");
        videoPlayer.style.display = "none";
        avatar.style.display = "block";
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

        if (videoPlayer) {
          log(
            config,
            "Playing camera video track in videoPlayer after error..."
          );
          config.localVideoTrack.play(videoPlayer);

          videoPlayer.style.display = wasCameraOnBeforeSharing
            ? "block"
            : "none";
          avatar.style.display = wasCameraOnBeforeSharing ? "none" : "block";
        } else {
          console.error("Video player not found after error!");
        }
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

