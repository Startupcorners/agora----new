// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { fetchTokens } from "./helperFunctions.js";
import { manageParticipants } from "./rtcEventHandlers.js"; 
import {
  startScreenShare,
  stopScreenShare,
  manageCameraState,
  playCameraVideo,
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

    // Create a shallow copy of the userTrack to avoid direct mutation
    userTrack = { ...userTrack };

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

        // Disable the video track instead of setting it to null
        await config.localVideoTrack.setEnabled(false);
        console.log("Video track disabled for user:", uid);

        // Update userTrack's isVideoMuted status
        userTrack.videoTrack = null;
        userTrack.isVideoMuted = true;
        userTracks[uid] = { ...userTrack };

        console.log("Camera turned off and unpublished for user:", uid);

        // Update camera state in the UI with false (camera off)
        manageCameraState(uid, config, false);

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

        // Update camera state in the UI with true (camera on)
        manageCameraState(uid, config, true);

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
  const screenShareUid = 1; // Define screenShareUid here

  try {
    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    // Log the current state of screen sharing
    console.log(
      `Screen share toggle called. isEnabled: ${isEnabled}, uid: ${uid}`
    );

    if (isEnabled) {
      console.log("Starting screen share process...");

      // Check if there's already a screen-sharing client
      if (!config.screenShareClient) {
        console.log(
          "No existing screen share client found. Creating a new one..."
        );

        // Initialize a new client for screen sharing
        config.screenShareClient = AgoraRTC.createClient({
          mode: "rtc",
          codec: "vp8",
        });
        console.log("New screen share client created.");

        // Create a separate RTM client for the screen share
        if (!config.screenShareRTMClient) {
          config.screenShareRTMClient = AgoraRTM.createInstance(config.appId);
          console.log("Created new RTM client for screen share.");
        }

        // Join RTC and RTM for the screen share client
        await joinScreenShareClient(screenShareUid, config, uid);
      } else {
        console.log("Screen share client already exists.");
      }

      // Start screen sharing with the new client (only after joining RTC and RTM)
      console.log("Starting the screen share...");
      await startScreenShare(screenShareUid, config);

      // Call the Bubble function to indicate screen sharing is on
      if (typeof bubble_fn_isScreenOn === "function") {
        bubble_fn_isScreenOn(true);
      }
    } else {
      console.log("Stopping screen share...");

      // Stop screen sharing and clean up
      if (config.screenShareClient) {
        console.log("Stopping the screen share track...");
        await stopScreenShare(screenShareUid, config); // Stop screen sharing

        console.log("Screen share stopped and cleaned up.");
      } else {
        console.log("No screen share client to stop.");
      }

      // Call the Bubble function to indicate screen sharing is off
      if (typeof bubble_fn_isScreenOn === "function") {
        bubble_fn_isScreenOn(false);
      }
    }
  } catch (error) {
    console.error("Error during screen sharing toggle:", error);
  }
};



export const joinScreenShareClient = async (
  screenShareUid,
  config,
  actualUserUid
) => {
  try {
    // Log the actual user UID and config details for debugging
    console.log("Joining screen share client. Actual User UID:", actualUserUid);

    // Fetch RTC token for screen sharing
    console.log("Fetching tokens for screen share UID...");
    const tokens = await fetchTokens(config, screenShareUid);
    if (!tokens || !tokens.rtcToken) {
      console.error("Failed to fetch RTC token for screen sharing");
      throw new Error("Failed to fetch RTC token for screen sharing");
    }

    console.log("Joining RTC with screen share client...");

    // Join the RTC channel with the screen share client
    await config.screenShareClient.join(
      config.appId, // Your app ID
      config.channelName, // Channel name
      tokens.rtcToken, // RTC token for screen sharing
      screenShareUid // Use the provided screenShareUid
    );

    console.log(
      "Screen share client successfully joined RTC channel with UID:",
      screenShareUid
    );

    // Join RTM for the screen share client and assign sharingUser attribute
    console.log("Joining RTM for the screen share client...");
    await joinScreenShareRTM(
      screenShareUid,
      tokens.rtmToken,
      config,
      actualUserUid
    );

    // Handle token renewal for the screen-share client
    config.screenShareClient.on("token-privilege-will-expire", async () => {
      try {
        console.log("Fetching new tokens for screen sharing...");
        const newTokens = await fetchTokens(config, screenShareUid);
        await config.screenShareClient.renewToken(newTokens.rtcToken);
        console.log("Screen share client token renewed.");
      } catch (error) {
        console.error("Error renewing screen share token:", error);
      }
    });
  } catch (error) {
    console.error("Error joining screen share client:", error);
  }
};


const joinScreenShareRTM = async (
  screenShareUid,
  rtmToken,
  config,
  actualUserUid,
  retryCount = 0
) => {
  try {
    // Convert screenShareUid to string for RTM
    const screenShareUidString = screenShareUid.toString();
    console.log("Joining RTM with screen share UID:", screenShareUidString);

    if (config.screenShareRTMClient._logined) {
      console.log("Screen share RTM client already logged in. Logging out...");
      await config.screenShareRTMClient.logout();
    }

    // Login to RTM with the screen share UID (as a string)
    console.log("Logging into RTM with the screen share UID...");
    await config.screenShareRTMClient.login({
      uid: screenShareUidString,
      token: rtmToken,
    });

    console.log("Setting local RTM user attributes...");
    // Set RTM attributes for the screen share client, pointing to the actual user UID
    const attributes = {
      sharingUser: actualUserUid.toString(), // The actual user UID who is sharing
    };

    await config.screenShareRTMClient.setLocalUserAttributes(attributes); // Store attributes in RTM for the screen share client

    console.log("Checking if RTM channel already exists...");
    // **Create the RTM channel and assign it to config.screenShareRTMChannel if needed**
    if (!config.screenShareRTMChannel) {
      config.screenShareRTMChannel = config.screenShareRTMClient.createChannel(
        config.channelName
      );
      console.log(
        "RTM channel created for screen share with name:",
        config.channelName
      );
    }

    // **Join the RTM channel**
    console.log("Joining the RTM channel...");
    await config.screenShareRTMChannel.join();
    console.log(
      "Screen share client successfully joined RTM channel:",
      config.channelName
    );
  } catch (error) {
    console.error("Error during RTM join attempt:", error);
    if (error.code === 5 && retryCount < 3) {
      console.log("Retrying RTM join (attempt", retryCount + 1, ")...");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
      return joinScreenShareRTM(
        screenShareUid,
        rtmToken,
        config,
        actualUserUid,
        retryCount + 1
      );
    } else {
      console.error(
        "Failed to join RTM for screen share after multiple attempts:",
        error
      );
      throw error;
    }
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
