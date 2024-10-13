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

    // Check if the camera is currently muted
    if (isMuted) {
      // Camera is on, turn it off
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

        config.localVideoTrackMuted = true; // Set the muted status to true

        // Run bubble function to notify the camera is off
        if (typeof bubble_fn_isCamOff === "function") {
          bubble_fn_isCamOff(true); // Camera is off
        }
      } else {
        console.warn("No video track to turn off for user:", config.uid);
      }
    } else {
      // Camera is off, turn it on
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

      config.localVideoTrackMuted = false; // Set the muted status to false

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
    const uid = config.uid; // Main UID

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

      // Create a separate Agora client for screen share if not already initialized
      if (!config.screenShareClient) {
        console.log("Initializing screenShareClient");
        config.screenShareClient = AgoraRTC.createClient({
          mode: "rtc",
          codec: "vp8",
        });
      }

      // Generate a unique UID for screen sharing (numeric, different from camera UID)
      const screenShareUid = uid + 100000; // Add constant to ensure it's numeric but unique
      config.screenShareUid = screenShareUid;

      // Fetch tokens for screen sharing by passing the screenShareUid
      const tokens = await fetchTokens(config, screenShareUid); // Pass screenShareUid here
      if (!tokens) throw new Error("Failed to fetch token for screen share");

      // Join RTM for screen sharing
      await joinRTMForScreenShare(tokens.rtmToken, screenShareUid, config);

      // Join the RTC channel with the screenShareClient
      await config.screenShareClient.join(
        config.appId,
        config.channelName,
        tokens.rtcToken, // Use RTC token for screen sharing
        screenShareUid
      );

      // Create the screen share track
      try {
        config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
        console.log(
          "Screen share track created:",
          config.localScreenShareTrack
        );
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

      // Hide all other video wrappers, including the current user's wrapper
      const allWrappers = document.querySelectorAll(
        "#video-stage .stream-wrapper, #video-stage .video-wrapper"
      );
      allWrappers.forEach((wrapper) => {
        wrapper.style.display = "none"; // Hide all other video and stream wrappers
      });

      // Explicitly hide the current user's wrapper (both stream-wrapper and video-wrapper)
      const userStreamWrapper = document.querySelector(
        `#stream-wrapper-${uid}`
      );
      const userVideoWrapper = document.querySelector(`#video-wrapper-${uid}`);

      if (userStreamWrapper) {
        userStreamWrapper.style.display = "none"; // Hide the current user's stream wrapper
      }
      if (userVideoWrapper) {
        userVideoWrapper.style.display = "none"; // Hide the current user's video wrapper
      }

      // Add the screen share wrapper
      const videoStage = document.querySelector(config.callContainerSelector);
      const screenShareWrapperHTML = `
        <div id="screen-share-wrapper" class="fullscreen-wrapper" style="width: 100%; height: 100%; position: relative;">
          <div id="stream-${screenShareUid}" class="stream fullscreen-wrapper"></div>
        </div>
      `;
      videoStage.insertAdjacentHTML("beforeend", screenShareWrapperHTML);

      // Play the screen share track in the screen share wrapper
      const screenShareElement = document.getElementById(
        `stream-${screenShareUid}`
      );
      config.localScreenShareTrack.play(screenShareElement);

      // Publish the screen share track using the separate client
      await config.screenShareClient.publish([config.localScreenShareTrack]);
      console.log("Screen share track published.");

      // Handle track-ended event
      config.localScreenShareTrack.on("track-ended", async () => {
        console.log("Screen share track ended, stopping screen share");
        await toggleScreenShare(false, config); // Stop sharing when track ends
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
      }

      config.screenShareUid = null;

      // Show all previously hidden video and stream wrappers again
      const allWrappers = document.querySelectorAll(
        "#video-stage .stream-wrapper, #video-stage .video-wrapper"
      );
      allWrappers.forEach((wrapper) => {
        wrapper.style.display = "block"; // Show all other video and stream wrappers
      });

      // Show the current user's wrapper again
      const userStreamWrapper = document.querySelector(
        `#stream-wrapper-${uid}`
      );
      const userVideoWrapper = document.querySelector(`#video-wrapper-${uid}`);

      if (userStreamWrapper) {
        userStreamWrapper.style.display = "block"; // Show the current user's stream wrapper again
      }
      if (userVideoWrapper) {
        userVideoWrapper.style.display = "block"; // Show the current user's video wrapper again
      }

      // Remove the screen share player's DOM elements
      const screenShareWrapper = document.querySelector(
        "#screen-share-wrapper"
      );
      if (screenShareWrapper) {
        screenShareWrapper.remove(); // Remove the screen share wrapper
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


// RTM Join function for screen share
const joinRTMForScreenShare = async (
  rtmToken,
  screenShareUid,
  config,
  retryCount = 0
) => {
  try {
    const rtmUid = screenShareUid.toString();

    if (!config.screenShareClientRTM) {
      console.log("Initializing screenShare RTM client");
      config.screenShareClientRTM = AgoraRTM.createInstance(config.appId);
    }

    if (config.screenShareClientRTM._logined) {
      await config.screenShareClientRTM.logout(); // Logout if already logged in
    }

    // Log the UID and token for debugging
    console.log(`Logging into RTM for screen share with UID: ${rtmUid}`);
    console.log(`Using RTM Token: ${rtmToken}`);

    // Login to RTM with the screen share UID
    await config.screenShareClientRTM.login({ uid: rtmUid, token: rtmToken });

    // Set user attributes for screen sharing (copying from main user)
    const attributes = {
      name: config.user.name || "Unknown (Screen Share)",
      avatar: config.user.avatar || "default-avatar-url",
      comp: config.user.company || "",
      desg: config.user.designation || "Screen Share",
      role: "host", // Assign host role for screen sharing
    };

    await config.screenShareClientRTM.setLocalUserAttributes(attributes); // Store attributes for screen share

    await config.screenShareClientRTM.createChannel(config.channelName).join(); // Join RTM channel for screen sharing
  } catch (error) {
    console.error(`Error during RTM login for screen share: ${error.message}`);

    if (error.code === 5 && retryCount < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Retry delay
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
