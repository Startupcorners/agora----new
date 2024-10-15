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

    // Get the video player and avatar elements for the current user
    const videoPlayer = document.querySelector(`#stream-${config.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${config.uid}`);

    console.log("Toggling camera for user:", config.uid);
    console.log("Video player element:", videoPlayer);
    console.log("Avatar element:", avatarDiv);

    if (!videoPlayer) {
      console.error(`Video player for user ${config.uid} not found!`);
      config.cameraToggleInProgress = false;
      return;
    }

    if (!avatarDiv) {
      console.error(`Avatar element for user ${config.uid} not found!`);
      config.cameraToggleInProgress = false;
      return;
    }

    if (isMuted) {
      // Camera is currently on, turn it off
      if (config.localVideoTrack) {
        console.log("Turning off the camera...");

        await config.client.unpublish([config.localVideoTrack]);
        config.localVideoTrack.stop();
        config.localVideoTrack.setEnabled(false); // Disable the track but keep it
        console.log("Camera turned off and unpublished for user:", config.uid);

        // Show avatar, hide video
        toggleVideoOrAvatar(config.uid, null, avatarDiv, videoPlayer);
        config.localVideoTrackMuted = true; // Update muted status

        // Notify that the camera is off
        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(false);
        }
      } else {
        console.warn("No video track to turn off for user:", config.uid);
      }
    } else {
      // Camera is off, turn it on
      console.log("Turning on the camera...");

      if (config.localVideoTrack) {
        // If the track exists, enable it
        await config.localVideoTrack.setEnabled(true);
        await config.client.publish([config.localVideoTrack]);
        console.log("Video track enabled and published for user:", config.uid);
      } else {
        // Handle the case where the video track might not exist (though it should)
        console.error("Video track was not created in the initial stage.");
        config.cameraToggleInProgress = false;
        return;
      }

      // Play video and hide avatar
      toggleVideoOrAvatar(
        config.uid,
        config.localVideoTrack,
        avatarDiv,
        videoPlayer
      );
      config.localVideoTrackMuted = false; // Update muted status

      // Notify that the camera is on
      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(true);
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera:", error);
  } finally {
    config.cameraToggleInProgress = false; // Reset toggle progress
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
      const screenShareUid = 1; // Add constant to ensure it's numeric but unique
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

      // Mark the wrapper as ready for the screen share
      if (!config.remoteTracks[screenShareUid]) {
        config.remoteTracks[screenShareUid] = {
          wrapperReady: true,
        };
      } else {
        config.remoteTracks[screenShareUid].wrapperReady = true;
      }

      // Hide all other video wrappers, including the current user's wrapper
      const allWrappers = document.querySelectorAll(
        "#video-stage .stream-wrapper, #video-stage .video-wrapper"
      );
      allWrappers.forEach((wrapper) => {
        wrapper.style.display = "none"; // Hide all other video and stream wrappers
      });

      // Play the screen share track in the background (main screen share content)
      const screenShareElement = document.getElementById(
        "screen-share-content"
      );
      config.localScreenShareTrack.play(screenShareElement);

      // Ensure that only the **camera video** plays in the small PiP window (bottom-right)
      const screenShareVideoElement =
        document.getElementById("screen-share-video");

      // Clean the PiP video element before adding the camera track
      screenShareVideoElement.innerHTML = ""; // Clear any previous tracks in PiP

      if (config.localVideoTrack) {
        config.localVideoTrack.play(screenShareVideoElement); // PiP with the camera video
      } else {
        console.error("User does not have a local video track for PiP.");
      }

      // Show the screen share stage and hide the main video stage
      document.querySelector("#screen-share-stage").style.display = "block";
      document.querySelector("#video-stage").style.display = "none";

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

      // Show the main video stage and hide the screen share
      document.querySelector("#video-stage").style.display = "block";
      document.querySelector("#screen-share-stage").style.display = "none";
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

    // Set user attributes for screen sharing (copying from main user)
    const attributes = {
      name: config.user.name || "Unknown (Screen Share)",
      avatar: config.user.avatar || "default-avatar-url",
      comp: config.user.company || "",
      desg: config.user.designation || "Screen Share",
      role: "host", // Assign host role for screen sharing
      uidSharingScreen: config.uid.toString(), // Indicate the UID of the user sharing the screen
    };

    await config.screenShareClientRTM.setLocalUserAttributes(attributes);
    console.log(
      `Screen share RTM attributes set for UID: ${rtmUid}, Sharing UID: ${config.uid}`
    );

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
