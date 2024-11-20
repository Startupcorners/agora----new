// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { fetchTokens } from "./helperFunctions.js";
import { manageParticipants } from "./rtcEventHandlers.js"; 
import {
  manageCameraState,
} from "./videoHandlers.js";
import { userTracks } from "./state.js"; // Import userTracks from state.js


const screenShareUid = 1; // UID for the screen share client

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

        // Set wrapper border to transparent
        const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
        if (wrapper) {
          wrapper.style.borderColor = "transparent"; // Transparent when muted
          console.log(`Set border to transparent for user ${config.uid}`);
        }
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

    uid = config.uid;
    console.log("User's UID:", uid);

    userTrack = userTracks[uid];

    if (!userTrack) {
      console.error(`User track for UID ${uid} is undefined.`);
      return;
    }

    // Check if camera toggle is already in progress
    if (userTrack.cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    // Set camera toggle in progress
    userTrack.cameraToggleInProgress = true;
    console.log("Camera toggle in progress for user:", uid);

    if (isMuted) {
      // Camera is currently on, turn it off
      if (config.localVideoTrack) {
        console.log("Turning off the camera for user:", uid);

        try {
          // Unpublish the video track
          await config.client.unpublish([config.localVideoTrack]);
          console.log("Video track unpublished for user:", uid);
        } catch (unpublishError) {
          console.error(
            `Error unpublishing video track for user ${uid}:`,
            unpublishError
          );
        }

        // Disable the video track
        await config.localVideoTrack.setEnabled(false);
        console.log("Video track disabled for user:", uid);

        // Update userTrack's isVideoMuted status
        userTrack.videoTrack = null;
        userTrack.isVideoMuted = true;
        userTracks[uid] = { ...userTrack };

        console.log("Camera turned off and unpublished for user:", uid);

        // Update camera state to stop
        manageCameraState("stop", null, `#stream-${uid}`);

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(false);
        }
      } else {
        console.warn(
          `No video track found for user ${uid} when trying to turn off the camera.`
        );
      }
    } else {
      // Camera is off, turn it on
      console.log("Turning on the camera for user:", uid);

      try {
        // Use existing video track if it exists, otherwise create a new one
        if (!config.localVideoTrack) {
          console.log("Creating a new camera video track for user:", uid);
          config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
          console.log("New camera video track created for user:", uid);
        } else {
          console.log("Using existing camera video track for user:", uid);
        }

        // Enable the video track
        await config.localVideoTrack.setEnabled(true);
        console.log("Video track enabled for user:", uid);

        // Publish the video track
        await config.client.publish([config.localVideoTrack]);
        console.log("Video track published for user:", uid);

        // Update userTrack's video state
        userTrack.videoTrack = config.localVideoTrack;
        userTrack.isVideoMuted = false;
        userTracks[uid] = { ...userTrack };

        console.log(
          "Camera turned on and video track published for user:",
          uid
        );

        // Update camera state to play
        manageCameraState("play", config.localVideoTrack, `#stream-${uid}`);

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(true);
        }
      } catch (cameraError) {
        console.error(
          `Error enabling or publishing video track for user ${uid}:`,
          cameraError
        );
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera for user:", uid, error);
  } finally {
    // Ensure toggle progress is reset
    if (userTracks[uid]) {
      userTracks[uid].cameraToggleInProgress = false;
      console.log("Camera toggle progress reset for user:", uid);
    }
  }
};




// toggleScreenShare function
export const toggleScreenShare = async (isEnabled, uid, config) => {
  const screenShareUid = 1; // Reserved UID for screen sharing

  try {
    console.log(
      `Screen share toggle called. isEnabled: ${isEnabled}, uid: ${uid}`
    );

    if (isEnabled) {
      console.log("Starting screen share process...");

      // Create a dedicated client for screen sharing if not already created
      if (!config.screenShareClient) {
        console.log("Creating a new client for screen sharing...");
        config.screenShareClient = AgoraRTC.createClient({
          mode: "rtc",
          codec: "vp8",
        });
      }

      // Check if the screenShareClient is already in the connecting/connected state
      if (config.screenShareClient.connectionState !== "DISCONNECTED") {
        console.error(
          "Screen share client is already connecting or connected. Aborting."
        );
        return;
      }

      // Fetch token for the screenShareUid
      console.log("Fetching token for screenShareUid...");
      const tokens = await fetchTokens(config, screenShareUid);
      if (!tokens || !tokens.rtcToken) {
        console.error("Failed to fetch RTC token for screen sharing.");
        return;
      }

      // Join RTC with the dedicated screenShareClient
      console.log("Joining RTC as screenShareUid:", screenShareUid);
      await config.screenShareClient.join(
        config.appId,
        config.channelName,
        tokens.rtcToken,
        screenShareUid
      );

      // Create the screen share video track
      console.log("Creating screen share video track...");
      const [screenShareTrack] = await AgoraRTC.createScreenVideoTrack();
      if (!screenShareTrack) {
        console.error("Failed to create screen share video track.");
        return;
      }

      // Store the screen share track
      userTracks[screenShareUid] = {
        screenShareTrack,
      };

      // Publish the screen share track using the dedicated client
      console.log("Publishing screen share video track...");
      await config.screenShareClient.publish(screenShareTrack);

      // Update the local user's RTM attribute to indicate they are sharing
      console.log(
        "Updating RTM attribute for local user to indicate sharing..."
      );
      await config.rtmClient.setLocalUserAttributes({
        isSharing: "true",
      });

      // Update the local config
      config.isSharing = true;
      console.log("Screen sharing started for local user with UID:", uid);

      // Toggle the stage to screen share
      toggleStages(true, uid);

      // Play the screen share track in #screen-share-video
      manageCameraState("play", screenShareTrack, "#screen-share-video");

      // Play the local video track in #pip-video-track (PiP) if available
      const localVideoTrack = config.localVideoTrack || null;
      if (localVideoTrack) {
        manageCameraState("play", localVideoTrack, "#pip-video-track");
      } else {
        console.warn(
          "No local video track found for PiP. Skipping local video play."
        );
      }

      // Set the avatar for PiP to config avatar
      const avatarElement = document.getElementById("pip-avatar");
      if (avatarElement) {
        avatarElement.src = config.avatar || "default-avatar.png";
        console.log(
          `Updated PiP avatar to ${config.avatar || "default-avatar.png"}.`
        );
      } else {
        console.warn("Could not find the PiP avatar element to update.");
      }
    } else {
      console.log("Stopping screen share...");

      // Leave the RTC channel as screenShareUid
      if (
        config.screenShareClient &&
        config.screenShareClient.connectionState === "CONNECTED"
      ) {
        console.log("Leaving RTC channel for screenShareUid...");
        await config.screenShareClient.leave();
        console.log("Screen share client left the RTC channel.");
      }

      // Update the local user's RTM attribute to indicate they are no longer sharing
      console.log(
        "Updating RTM attribute for local user to indicate not sharing..."
      );
      await config.rtmClient.setLocalUserAttributes({
        isSharing: "false",
      });

      // Update the local config
      config.isSharing = false;
      console.log("Screen sharing stopped for local user with UID:", uid);

      // Toggle the stage back to video stage
      toggleStages(false, uid);

      // Stop showing the screen share and PiP tracks
      manageCameraState("stop", null, "#screen-share-video");
      manageCameraState("stop", null, "#pip-video-track");

      // Play back the local track in #stream-${config.uid} if available
      const localVideoTrack = config.localVideoTrack || null;
      if (localVideoTrack) {
        manageCameraState("play", localVideoTrack, `#stream-${config.uid}`);
        console.log(`Playing back local video track in #stream-${config.uid}.`);
      } else {
        console.warn(
          "No local video track found to play back after stopping screen share."
        );
      }
    }
  } catch (error) {
    console.error("Error during screen sharing toggle:", error);
  }
};




export const changeUserRole = async (userUid, newRole, newRoleInTheCall, config) => {
  console.log(
    `Changing role for user ${userUid} to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );

  // Prepare the updated attributes
  const updatedAttributes = {
    role: newRole,
    roleInTheCall: newRoleInTheCall,
  };

  
  // Broadcast the role change to others in the RTM channel
  if (config.channelRTM) {
    const message = JSON.stringify({
      type: "roleChange",
      userUid: userUid,
      newRole: newRole,
      newRoleInTheCall: newRoleInTheCall,
    });
    await config.channelRTM.sendMessage({ text: message });
    console.log(`Role change message sent to RTM channel: ${message}`);
  } else {
    console.warn("RTM channel is not initialized.");
  }

  console.log(
    `Role for user ${userUid} successfully changed to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );
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
