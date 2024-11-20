// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { fetchTokens } from "./helperFunctions.js";
import { playStreamInDiv, toggleStages } from "./videoHandlers.js";
import { userTracks } from "./state.js";



export const toggleMic = async (config) => {
  try {
    console.log(`toggleMic called for user: ${config.uid}`);

    if (!userTracks[config.uid]) {
      console.error(`User track for UID ${config.uid} is undefined.`);
      return;
    }

    const userTrack = userTracks[config.uid];

    if (userTrack.audioTrack) {
      // User is trying to mute the microphone
      console.log("Muting microphone for user:", config.uid);

      // Unpublish and stop the audio track
      await config.client.unpublish([userTrack.audioTrack]);
      userTrack.audioTrack.stop();
      userTrack.audioTrack.close();
      userTrack.audioTrack = null; // Set to null to indicate mic is muted

      console.log("Microphone muted and unpublished");

      // Remove the hidden class to show mic is muted
      const micStatusElement = document.getElementById(
        `mic-status-${config.uid}`
      );
      if (micStatusElement) {
        micStatusElement.classList.remove("hidden");
        console.log(
          `Removed 'hidden' class from mic-status-${config.uid} to indicate muted status`
        );
      } else {
        console.warn(`Mic status element not found for user ${config.uid}`);
      }

      // Set wrapper border to transparent
      const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
      if (wrapper) {
        wrapper.style.borderColor = "transparent"; // Transparent when muted
        console.log(`Set border to transparent for user ${config.uid}`);
      }

      // Call bubble_fn_isMicOff with `true` to indicate mic is off
      if (typeof bubble_fn_isMicOff === "function") {
        bubble_fn_isMicOff(true);
      } else {
        console.warn("bubble_fn_isMicOff is not defined.");
      }
    } else {
      // User is trying to unmute the microphone
      console.log("Unmuting microphone for user:", config.uid);

      // Create a new audio track
      userTrack.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

      if (!userTrack.audioTrack) {
        console.error("Failed to create a new audio track!");
        return;
      }

      console.log("Created new audio track for user:", config.uid);

      // Publish the new audio track
      await config.client.publish([userTrack.audioTrack]);
      console.log("Microphone unmuted and published");

      // Add the hidden class to hide mic muted status
      const micStatusElement = document.getElementById(
        `mic-status-${config.uid}`
      );
      if (micStatusElement) {
        micStatusElement.classList.add("hidden");
        console.log(
          `Added 'hidden' class to mic-status-${config.uid} to indicate unmuted status`
        );
      } else {
        console.warn(`Mic status element not found for user ${config.uid}`);
      }

      // Set wrapper border to active (optional)
      const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
      if (wrapper) {
        wrapper.style.borderColor = "#00ff00"; // Green border to indicate active mic
        console.log(`Set border to green for user ${config.uid}`);
      }

      // Call bubble_fn_isMicOff with `false` to indicate mic is on
      if (typeof bubble_fn_isMicOff === "function") {
        bubble_fn_isMicOff(false);
      } else {
        console.warn("bubble_fn_isMicOff is not defined.");
      }
    }
  } catch (error) {
    console.error("Error in toggleMic for user:", config.uid, error);
  }
};




export const toggleCamera = async (config) => {
  try {
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    console.log("User's UID:", config.uid);

    if (config.cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    config.cameraToggleInProgress = true; // Prevent simultaneous toggles

    // Ensure userTracks has an entry for the user
    if (!userTracks[config.uid]) {
      userTracks[config.uid] = {
        videoTrack: null,
        audioTrack: null,
      };
    }

    const userTrack = userTracks[config.uid];

    if (userTrack.videoTrack) {
      // User is trying to turn off the camera
      console.log("Turning off the camera for user:", config.uid);

      // Unpublish and stop the video track
      await config.client.unpublish([userTrack.videoTrack]);
      userTrack.videoTrack.stop();
      userTrack.videoTrack.close();
      userTrack.videoTrack = null; // Remove the video track reference

      console.log("Camera turned off and unpublished");

      // Update UI
      if (config.screenShareClient) {
        playStreamInDiv(config.uid, "#pip-video-track");
      } else {
        playStreamInDiv(config.uid, `#stream-${config.uid}`);
      }

      // Notify Bubble of the camera state
      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(false); // Camera is off
      }
    } else {
      // User is trying to turn on the camera
      console.log("Turning on the camera for user:", config.uid);

      // Create a new video track
      userTrack.videoTrack = await AgoraRTC.createCameraVideoTrack();

      if (!userTrack.videoTrack) {
        console.error("Failed to create a new video track!");
        return;
      }

      // Enable and publish the video track
      await userTrack.videoTrack.setEnabled(true);
      await config.client.publish([userTrack.videoTrack]);

      console.log("Camera turned on and published");

      // Update UI
      if (config.screenShareClient) {
        playStreamInDiv(config.uid, "#pip-video-track");
      } else {
        playStreamInDiv(config.uid, `#stream-${config.uid}`);
      }

      // Notify Bubble of the camera state
      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(true); // Camera is on
      }
    }
  } catch (error) {
    console.error("Error in toggleCamera for user:", config.uid, error);
  } finally {
    config.cameraToggleInProgress = false; // Reset toggle state
    console.log("Camera toggle progress reset for user:", config.uid);
  }
};




export const toggleScreenShare = async (config) => {

  try {
    if (!config.screenShareRTMClient) {
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
  const uid = config.uid;

  try {
    console.log("Starting screen share process...");

    // Fetch tokens for the screenShareUid
    console.log("Fetching tokens for screenShareUid...");
    const tokens = await fetchTokens(config, screenShareUid);
    if (!tokens || !tokens.rtcToken || !tokens.rtmToken) {
      console.error("Failed to fetch RTC or RTM token for screen sharing.");
      return;
    }

    // Create a dedicated RTM client for screen sharing
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

    // Publish the screen share track using the dedicated client
    console.log("Publishing screen share video track...");
    await config.screenShareClient.publish(screenShareTrack);

    console.log("Screen sharing started for local user with UID:", uid);

    // Update userTracks for screenShareUid (user 1)
    if (!userTracks[screenShareUid]) {
      userTracks[screenShareUid] = {};
    }
    userTracks[screenShareUid].videoTrack = screenShareTrack;

    console.log(`Updated userTracks for screenShareUid ${screenShareUid}`);

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
    console.log("Leaving RTC channel for screenShareUid...");
    await config.screenShareClient.leave();
    console.log("Screen share RTC client left the channel.");
    config.screenShareClient = null; // Clean up client

    // Logout from the RTM client for screenShareUid
    console.log("Logging out of RTM for screenShareUid...");
    await config.screenShareRTMClient.logout();
    console.log("Screen share RTM client logged out.");
    config.screenShareRTMClient = null; // Clean up client

    // Remove the screen share track from userTracks
    console.log(
      `Cleaning up userTracks entry for screenShareUid: ${screenShareUid}`
    );
    if (userTracks[screenShareUid]) {
      userTracks[screenShareUid].videoTrack.stop();
      userTracks[screenShareUid].videoTrack.close();
      delete userTracks[screenShareUid]; // Remove the entry from userTracks
    }

    // Toggle the stage back to video stage
    toggleStages(false, uid);

    // Resume playing the user's main video stream
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
