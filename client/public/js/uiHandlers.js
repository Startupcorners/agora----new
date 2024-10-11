// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { toggleMicIcon,toggleVideoOrAvatar } from "./updateWrappers.js";

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

        // Run bubble function to notify the camera is off
        if (typeof bubble_fn_isCamOff === "function") {
          bubble_fn_isCamOff(true); // Camera is off
        }
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

      // Run bubble function to notify the camera is on
      if (typeof bubble_fn_isCamOff === "function") {
        bubble_fn_isCamOff(false); // Camera is on
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera:", error);
  }
};

export const toggleScreenShare = async (isEnabled, config) => {
  try {
    const uid = config.uid; // UID is already a string

    if (!uid) {
      console.error("UID is not set in config.");
      return;
    }

    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    if (config.localScreenShareEnabled && isEnabled) {
      console.log("Already sharing. Stopping screen share.");
      isEnabled = false; // This will stop the current screen share
    }

    if (isEnabled) {
      console.log("Starting screen share");

      // Initialize screenShareClient if not already done
      if (!config.screenShareClient) {
        console.log("Initializing screenShareClient");
        config.screenShareClient = AgoraRTC.createClient({
          mode: "live",
          codec: "vp8",
        });
      }

      // Generate a unique UID for screen sharing
      const screenShareUid = `${uid}-screen`; // Use a string UID
      config.screenShareUid = screenShareUid;

      // Fetch a new token for screenShareUid
      const tokens = await fetchTokens({
        ...config,
        uid: screenShareUid,
      });
      if (!tokens) throw new Error("Failed to fetch token for screen share");

      // Join the channel with screenShareClient
      await config.screenShareClient.join(
        config.appId,
        config.channelName,
        tokens.rtcToken,
        screenShareUid
      );

      // Set client role to "host" for screenShareClient
      await config.screenShareClient.setClientRole("host");

      // Set RTM attributes for the screen share UID
      try {
        const screenShareRTMClient = AgoraRTM.createInstance(config.appId, {
          enableLogUpload: false,
          logFilter: config.debugEnabled
            ? AgoraRTM.LOG_FILTER_INFO
            : AgoraRTM.LOG_FILTER_OFF,
        });
        await screenShareRTMClient.login({
          uid: screenShareUid,
          token: tokens.rtmToken,
        });

        // Set the mainUid attribute
        await screenShareRTMClient.setLocalUserAttributes({
          mainUid: uid,
        });

        // Logout from RTM after setting attributes
        await screenShareRTMClient.logout();
      } catch (error) {
        console.error("Error setting RTM attributes for screen share:", error);
      }

      // Create the screen share track
      try {
        config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
      } catch (error) {
        console.error("Error creating screen share track:", error);

        // Handle user cancellation
        if (
          error.name === "NotAllowedError" ||
          error.message.includes("Permission denied")
        ) {
          console.log("User canceled the screen sharing prompt.");
          if (typeof bubble_fn_isScreenOn === "function") {
            bubble_fn_isScreenOn(false);
          }
          return;
        } else {
          throw error;
        }
      }

      // Publish the screen share track with screenShareClient
      await config.screenShareClient.publish([config.localScreenShareTrack]);

      // Add user wrapper for screen share
      await addUserWrapper({ uid: screenShareUid, ...config.user }, config);

      // Play the screen share track
      const screenSharePlayer = document.querySelector(
        `#stream-${screenShareUid}`
      );
      if (screenSharePlayer) {
        config.localScreenShareTrack.play(screenSharePlayer);
      } else {
        console.error(
          `Screen share player with id #stream-${screenShareUid} not found`
        );
      }

      // Handle track-ended event
      config.localScreenShareTrack.on("track-ended", async () => {
        console.log("Screen share track ended, stopping screen share");
        await toggleScreenShare(false, config);
      });
    } else {
      console.log("Stopping screen share");

      // Unpublish the screen share track and leave the channel
      if (config.localScreenShareTrack) {
        await config.screenShareClient.unpublish([
          config.localScreenShareTrack,
        ]);
        config.localScreenShareTrack.stop();
        config.localScreenShareTrack.close();
        config.localScreenShareTrack = null;
      }

      // Leave the screenShareClient channel
      if (config.screenShareClient) {
        await config.screenShareClient.leave();
        config.screenShareClient = null;
        config.screenShareUid = null;
      }

      // Remove the screen share player's DOM elements
      const screenShareWrapper = document.querySelector(
        `#participant-${config.screenShareUid}`
      );
      if (screenShareWrapper) {
        screenShareWrapper.remove();
      }
    }

    config.localScreenShareEnabled = isEnabled;

    // Call bubble_fn_isScreenOn with the current screen sharing state
    if (typeof bubble_fn_isScreenOn === "function") {
      bubble_fn_isScreenOn(isEnabled);
    } else {
      console.warn("bubble_fn_isScreenOn is not defined.");
    }
  } catch (error) {
    console.error("Error during screen sharing:", error);
    if (config.onError) {
      config.onError(error);
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

