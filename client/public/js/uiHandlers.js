// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages

export const toggleMic = async (isMuted, config) => {
  try {
    if (isMuted) {
      await config.localAudioTrack.setMuted(true);
      config.localAudioTrackMuted = true;
    } else {
      await config.localAudioTrack.setMuted(false);
      config.localAudioTrackMuted = false;
    }

    config.onMicMuted(config.localAudioTrackMuted);
  } catch (error) {
    console.error("Error in toggleMic:", error);
    if (config.onError) {
      config.onError(error);
    }
  }
};

export const toggleCamera = async (isMuted, config) => {
  try {
    const uid = config.uid;
    const videoPlayer = document.querySelector(`#stream-${uid}`);
    const avatar = document.querySelector(`#avatar-${uid}`);

    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    log(config, `Camera is about to be ${isMuted ? "muted" : "unmuted"}`);

    if (!videoPlayer) {
      console.error(`Video player with id #stream-${uid} not found`);
      return;
    }

    // Check if the video track exists, if not create and initialize it
    if (!config.localVideoTrack) {
      log(config, "Initializing new camera video track...");
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    }

    // Mute or unmute the video track
    if (isMuted) {
      log(config, "Muting camera...");
      await config.localVideoTrack.setMuted(true);
      config.localVideoTrackMuted = true;

      // Show the avatar and hide the video player
      videoPlayer.style.display = "none";
      avatar.style.display = "block";
    } else {
      log(config, "Unmuting camera...");
      videoPlayer.style.display = "block";
      avatar.style.display = "none";

      if (
        videoPlayer.childNodes.length === 0 ||
        !videoPlayer.querySelector("video")
      ) {
        log(config, "Reattaching video element...");
        config.localVideoTrack.play(videoPlayer);
      } else {
        log(config, "Video element already exists, playing it.");
        config.localVideoTrack.play(videoPlayer);
      }

      await config.localVideoTrack.setMuted(false);
      config.localVideoTrackMuted = false;
    }

    config.onCamMuted(uid, config.localVideoTrackMuted);
  } catch (error) {
    console.error("Error in toggleCamera:", error);
    if (config.onError) {
      config.onError(error);
    }
  }
};

export const updateMicIcon = (uid, isMuted) => {
  const micStatusIcon = document.querySelector(`#mic-status-${uid}`);
  if (micStatusIcon) {
    micStatusIcon.style.display = isMuted ? "block" : "none";
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
    const videoPlayer = document.querySelector(`#stream-${uid}`);
    const avatar = document.querySelector(`#avatar-${uid}`);

    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    if (config.localScreenShareEnabled && isEnabled) {
      log(config, "Already sharing. Stopping screen share.");
      isEnabled = false;
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
