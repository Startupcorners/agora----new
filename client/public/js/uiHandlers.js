// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { fetchTokens } from "./helperFunctions.js";
import { playStreamInDiv, toggleStages } from "./videoHandlers.js";
import { userTracks, lastMutedStatuses } from "./state.js";


export const toggleMic = async (config) => {
  try {
    console.log(`toggleMic called for user: ${config.uid}`);
    console.log(`Usertracks:`, userTracks);

    if (!userTracks[config.uid]) {
      console.error(`User track for UID ${config.uid} is undefined.`);
      return;
    }

    const userTrack = userTracks[config.uid];

    if (userTrack.audioTrack && userTrack.audioTrack.isPlaying) {
      // User is trying to mute the microphone
      console.log("Muting microphone for user:", config.uid);

      // Unpublish and stop the audio track
      await config.client.unpublish([userTrack.audioTrack]);
      userTrack.audioTrack.stop();
      userTrack.audioTrack.close();
      userTrack.audioTrack = null; // Set to null to indicate mic is muted

      console.log("Microphone muted and unpublished");

      updateMicStatusElement(config.uid, true); // Mic is muted

      // Set wrapper border to transparent
      const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
      if (wrapper) {
        wrapper.style.borderColor = "transparent"; // Transparent when muted
        console.log(`Set border to transparent for user ${config.uid}`);
      }

      // Notify Bubble that the mic is off
      if (typeof bubble_fn_isMicOff === "function") {
        bubble_fn_isMicOff(true);
      } else {
        console.warn("bubble_fn_isMicOff is not defined.");
      }
    } else {
      // User is trying to unmute the microphone
      console.log("Unmuting microphone for user:", config.uid);

      try {
        // Create a new audio track
        const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        userTrack.audioTrack = newAudioTrack;

        if (!newAudioTrack) {
          console.error("Failed to create a new audio track!");
          throw new Error("Microphone audio track creation failed");
        }

        console.log("Created new audio track for user:", config.uid);

        // Publish the new audio track
        await config.client.publish([newAudioTrack]);
        console.log("Microphone unmuted and published");

        // Update UI to show mic is unmuted
        updateMicStatusElement(config.uid, false); // Mic is unmuted

        // Set wrapper border to active
        const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
        if (wrapper) {
          wrapper.style.borderColor = "#00ff00"; // Green border to indicate active mic
          console.log(`Set border to green for user ${config.uid}`);
        }

        // Notify Bubble that the mic is on
        if (typeof bubble_fn_isMicOff === "function") {
          bubble_fn_isMicOff(false);
        } else {
          console.warn("bubble_fn_isMicOff is not defined.");
        }
      } catch (error) {
        console.warn(
          "Error accessing or creating microphone track, setting mic to off.",
          error
        );

        // Notify Bubble that the mic is off due to an error
        if (typeof bubble_fn_isMicOff === "function") {
          bubble_fn_isMicOff(true);
        }

        // Update UI to reflect muted state due to error
        updateMicStatusElement(config.uid, true); // Mic remains muted

        const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
        if (wrapper) {
          wrapper.style.borderColor = "transparent"; // Transparent for muted state
          console.log(`Set border to transparent for user ${config.uid}`);
        }
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
      if (config.sharingScreenUid === config.uid.toString()) {
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
      if (config.sharingScreenUid === config.uid.toString()) {
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
  console.log("config.sharingScreenUid", config.sharingScreenUid);

  try {
    if (config.sharingScreenUid !== config.uid.toString()) {
      await startScreenShare(config); // Start screen share
    } else {
      await stopScreenShare(config); // Stop screen share
    }
  } catch (error) {
    console.error("Error during screen share toggle:", error);
  }
};

const generateRandomScreenShareUid = () => {
  return Math.floor(Math.random() * (4294967295 - 1000000000 + 1)) + 1000000000;
};




export const startScreenShare = async (config) => {
  const screenShareUid = generateRandomScreenShareUid();
  const uid = config.uid;

  console.log("Initializing screen share process...");

  try {
    // Step 1: Create a new screen share session
    console.log("Creating screen share video track...");
    const screenShareTrack = await AgoraRTC.createScreenVideoTrack().catch(
      (error) => {
        console.warn("Screen sharing was canceled by the user.", error);
        return null; // Gracefully handle cancellation
      }
    );

    if (!screenShareTrack) {
      console.log(
        "Screen share track creation was canceled. Aborting screen share setup."
      );
      return; // Exit early if user cancels
    }

    console.log("Screen share video track created successfully.");

    // Fetch tokens for the screenShareUid
    console.log("Fetching tokens for screenShareUid...");
    const tokens = await fetchTokens(config, screenShareUid);
    if (
      !tokens ||
      typeof tokens.rtcToken !== "string" ||
      typeof tokens.rtmToken !== "string"
    ) {
      console.error("Invalid RTC or RTM tokens for screen sharing.");
      screenShareTrack.stop();
      screenShareTrack.close();
      return;
    }
    console.log("Tokens fetched successfully:", tokens);

    // Initialize RTM client for screen sharing
    console.log("Creating a new RTM client for screen sharing...");
    const rtmClient = AgoraRTM.createInstance(config.appId);
    await rtmClient.login({
      uid: screenShareUid.toString(),
      token: tokens.rtmToken,
    });
    console.log("Screen share RTM client logged in successfully.");

    // Set RTM attributes
    const user = config.user || {};
    const attributes = {
      name: user.name || "Unknown",
      avatar: user.avatar || "default-avatar-url",
      company: user.company || "Unknown",
      sharingScreenUid: uid.toString(),
    };
    console.log("Setting RTM attributes:", attributes);
    await rtmClient.setLocalUserAttributes(attributes);

    // Initialize RTC client for screen sharing
    console.log("Creating a new RTC client for screen sharing...");
    const rtcClient = AgoraRTC.createClient({
      mode: "rtc",
      codec: "vp8",
    });

    // Join RTC channel
    console.log(`Joining RTC with screenShareUid ${screenShareUid}...`);
    await rtcClient.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      screenShareUid
    );

    // Publish the screen share track
    console.log("Publishing screen share video track...");
    await rtcClient.publish(screenShareTrack);
    console.log("Screen share video track published successfully.");

    // Update userTracks
    userTracks[screenShareUid] = { videoTrack: screenShareTrack };
    console.log("Updated userTracks:", userTracks);

    // Listen for the browser's stop screen sharing event
    screenShareTrack.on("track-ended", async () => {
      console.log("Screen sharing stopped via browser UI.");
      await stopScreenShare(config); // Cleanup resources and update UI
    });

    // Toggle UI
    toggleStages(true);
    playStreamInDiv(screenShareUid, "#screen-share-content");
    playStreamInDiv(uid, "#pip-video-track");

    // Update PiP avatar
    const avatarElement = document.getElementById("pip-avatar");
    if (avatarElement) {
      avatarElement.src = user.avatar || "default-avatar.png";
    }

    // Update config
    config.screenShareRTMClient = rtmClient;
    config.screenShareRTCClient = rtcClient;
    config.sharingScreenUid = config.uid;
    config.generatedScreenShareId = screenShareUid;

    console.log("Screen sharing started successfully.");
  } catch (error) {
    console.error(
      "Error during screen share initialization:",
      error.message,
      error.stack
    );
  }
};





export const stopScreenShare = async (config) => {
  const screenShareUid = config.generatedScreenShareId; // Use the dynamic UID

  console.log("Stopping screen share for UID:", screenShareUid);
  const screenShareTrack = userTracks[screenShareUid]?.videoTrack;

  if (screenShareTrack) {
    await config.screenShareRTCClient.unpublish([screenShareTrack]);
    screenShareTrack.stop();
    screenShareTrack.close();
    userTracks[screenShareUid].videoTrack = null;

    console.log("Screen share stopped successfully.");
  } else {
    console.warn("No screen share track found in userTracks.");
  }

  // Toggle UI
  toggleStages(false);

  // Clear the screen share UID from config
  config.sharingScreenUid = null;
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


export function updateMicStatusElement(uid, isMuted) {
  const micStatusElement = document.getElementById(`mic-status-${uid}`);
  if (micStatusElement) {
    if (isMuted) {
      micStatusElement.classList.remove("hidden");
      console.log(`Removed 'hidden' class from mic-status-${uid} to indicate muted status.`);
    } else {
      micStatusElement.classList.add("hidden");
      console.log(`Added 'hidden' class to mic-status-${uid} to indicate unmuted status.`);
    }
  } else {
    console.warn(`Mic status element not found for UID ${uid}.`);
  }
}
