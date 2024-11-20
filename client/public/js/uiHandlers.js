// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { fetchTokens } from "./helperFunctions.js";
import { manageParticipants } from "./rtcEventHandlers.js"; 
import { playStreamInDiv, toggleStages } from "./videoHandlers.js";
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

    if (userTrack.cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    userTrack.cameraToggleInProgress = true; // Prevent simultaneous toggles

    if (isMuted) {
      if (config.localVideoTrack) {
        console.log("Turning off the camera for user:", uid);

        // Unpublish and disable the video track
        await config.client.unpublish([config.localVideoTrack]);
        await config.localVideoTrack.setEnabled(false);

        // Update user track state
        userTrack.videoTrack = null;
        userTrack.isVideoMuted = true;

        // Update UI based on screen share status
        if (config.screenShareClient) {
          playStreamInDiv(uid, "#pip-video-track");
        } else {
          playStreamInDiv(uid, `#stream-${uid}`);
        }

        if (typeof bubble_fn_isCamOn === "function") {
          bubble_fn_isCamOn(false);
        }
      } else {
        console.warn(
          `No video track found for user ${uid} when turning off the camera.`
        );
      }
    } else {
      if (!config.localVideoTrack) {
        console.log("Creating a new camera video track for user:", uid);
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      }

      // Enable and publish the video track
      await config.localVideoTrack.setEnabled(true);
      await config.client.publish([config.localVideoTrack]);

      // Update user track state
      userTrack.videoTrack = config.localVideoTrack;
      userTrack.isVideoMuted = false;

      // Update UI based on screen share status
      if (config.screenShareClient) {
        playStreamInDiv(uid, "#pip-video-track");
      } else {
        playStreamInDiv(uid, `#stream-${uid}`);
      }

      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(true);
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera for user:", uid, error);
  } finally {
    if (userTracks[uid]) {
      userTracks[uid].cameraToggleInProgress = false;
      console.log("Camera toggle progress reset for user:", uid);
    }
  }
};



export const toggleScreenShare = async (isEnabled, config) => {
  console.log(
    `Screen share toggle called. isEnabled: ${isEnabled}, uid: ${uid}`
  );

  try {
    if (isEnabled) {
      await startScreenShare(config); // Start screen share
    } else {
      await stopScreenShare(config); // Stop screen share
    }
  } catch (error) {
    console.error("Error during screen share toggle:", error);
  }
};


export const startScreenShare = async (config) => {
  const screenShareUid = 1; // Reserved UID for screen sharing
  const uid = config.uid
  try {
    console.log("Starting screen share process...");

    // Fetch tokens for the screenShareUid
    console.log("Fetching tokens for screenShareUid...");
    const tokens = await fetchTokens(config, screenShareUid);
    if (!tokens || !tokens.rtcToken || !tokens.rtmToken) {
      console.error("Failed to fetch RTC or RTM token for screen sharing.");
      return;
    }

    // Create a dedicated RTM client for screen sharing if not already created
    if (!config.screenShareRTMClient) {
      console.log("Creating a new RTM client for screen sharing...");
      config.screenShareRTMClient = AgoraRTM.createInstance(config.appId);
      await config.screenShareRTMClient.login({
        uid: screenShareUid.toString(),
        token: tokens.rtmToken,
      });
      console.log("Screen share RTM client logged in successfully.");

      // Set RTM attributes for the screen-sharing user
      const attributes = {
        name: config.user.name || "Unknown",
        avatar: config.user.avatar || "default-avatar-url",
        company: config.user.company || "Unknown",
        designation: config.user.designation || "Unknown",
        role: config.user.role || "audience",
        rtmUid: screenShareUid.toString(),
        bubbleid: config.user.bubbleid,
        isRaisingHand: config.user.isRaisingHand,
        sharingUserUid: uid.toString(),
        roleInTheCall: config.user.roleInTheCall || "audience",
      };

      console.log("Setting RTM attributes for screen-sharing user...");
      await config.screenShareRTMClient.setLocalUserAttributes(attributes);
      console.log("RTM attributes set successfully for screen-sharing user.");
    }

    // Create a dedicated RTC client for screen sharing if not already created
    if (!config.screenShareClient) {
      console.log("Creating a new RTC client for screen sharing...");
      config.screenShareClient = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8",
      });
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
    const screenShareTrack = await AgoraRTC.createScreenVideoTrack();
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

    console.log("Screen sharing started for local user with UID:", uid);

    // Toggle the stage to screen share
    toggleStages(true, uid);

    // Play the screen share track in #screen-share-content
    playStreamInDiv(1, "#screen-share-content");
    playStreamInDiv(uid, "#pip-video-track");


    // Set the avatar for PiP to config avatar
    const avatarElement = document.getElementById("pip-avatar");
    if (avatarElement) {
      avatarElement.src = config.user.avatar || "default-avatar.png";
      console.log(
        `Updated PiP avatar to ${config.user.avatar || "default-avatar.png"}.`
      );
    } else {
      console.warn("Could not find the PiP avatar element to update.");
    }
  } catch (error) {
    console.error("Error starting screen share:", error);
  }
};


export const stopScreenShare = async (config) => {
  const uid = config.uid;
  const screenShareUid = 1; // Reserved UID for screen sharing
  try {
    console.log("Stopping screen share...");

    // Leave the RTC channel for screenShareUid
    if (config.screenShareClient) {
      console.log("Leaving RTC channel for screenShareUid...");
      await config.screenShareClient.leave();
      console.log("Screen share RTC client left the channel.");
      config.screenShareClient = null; // Clean up client
    }

    // Leave the RTM client for screenShareUid
    if (config.screenShareRTMClient) {
      console.log("Logging out of RTM for screenShareUid...");
      await config.screenShareRTMClient.logout();
      console.log("Screen share RTM client logged out.");
      config.screenShareRTMClient = null; // Clean up client
    }

    // Toggle the stage back to video stage
    toggleStages(false, uid);
    playStreamInDiv(uid, `#stream-${uid}`);
  
  } catch (error) {
    console.error("Error stopping screen share:", error);
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
