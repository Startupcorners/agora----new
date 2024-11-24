// uiHandlers.js
import { log, sendMessageToPeer } from "./helperFunctions.js"; // For logging and sending peer messages
import { fetchTokens } from "./helperFunctions.js";
import { playStreamInDiv, toggleStages } from "./videoHandlers.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { manageParticipants } from "./rtcEventHandlers.js"; // Token renewal handler


export const toggleMic = async (config) => {
  try {
    console.log("configs:",config);
    console.log(`UserTracks:`, config.userTracks);
    console.log(`UserTracks:`, config.userTracks[config.uid]);

    const userTrack = config.userTracks[config.uid];

    if (userTrack.audioTrack) {
      // Microphone is active; mute it
      await endMic(config);
    } else {
      // Microphone is muted; activate it
      await startMic(config);
    }
  } catch (error) {
    console.error("Error in toggleMic for user:", config.uid, error);
  }
};

const startMic = async (config) => {
  try {
    console.log("Starting microphone for user:", config.uid);

    // Ensure userTracks is initialized
    if (!config.userTracks[config.uid]) {
      config.userTracks[config.uid] = {};
    }

    // Initialize audioTrack to null if it doesn't exist
    config.userTracks[config.uid].audioTrack =
      config.userTracks[config.uid].audioTrack || null;

    // Create and assign a new microphone audio track
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    config.userTracks[config.uid].audioTrack = audioTrack;

    // Publish the audio track
    await config.client.publish([audioTrack]);
    console.log("Microphone started and published");

    // Update UI to indicate the microphone is active
    updateMicStatusElement(config.uid, false); // Mic is unmuted
    bubble_fn_isMicOff(false);
  } catch (error) {
    console.warn(
      "Error accessing or creating microphone track, setting mic to off.",
      error
    );

    // Trigger muted status in the UI
    updateMicStatusElement(config.uid, true);
    bubble_fn_isMicOff(true);
  }
};

const endMic = async (config) => {
  try {
    console.log("Ending microphone for user:", config.uid);

    // Ensure userTracks is initialized
    if (!config.userTracks[config.uid]) {
      console.error(`User track for UID ${config.uid} is not initialized.`);
      return;
    }

    const userTrack = config.userTracks[config.uid];

    // Check if audioTrack exists before attempting to stop/unpublish
    if (userTrack.audioTrack) {
      await config.client.unpublish([userTrack.audioTrack]);
      userTrack.audioTrack.stop();
      userTrack.audioTrack.close();
      userTrack.audioTrack = null; // Set to null to indicate mic is muted

      console.log("Microphone ended and unpublished");
    }

    // Update UI to indicate the microphone is muted
    updateMicStatusElement(config.uid, true); // Mic is muted

    // Set wrapper border to transparent
    const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
    if (wrapper) {
      wrapper.style.borderColor = "transparent"; // Transparent when muted
      console.log(`Set border to transparent for user ${config.uid}`);
    }

    bubble_fn_isMicOff(true);
  } catch (error) {
    console.error("Error in endMic for user:", config.uid, error);
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
    if (!config.userTracks[config.uid]) {
      config.userTracks[config.uid] = {
        videoTrack: null,
        audioTrack: null,
      };
    }

    const userTrack = config.userTracks[config.uid];

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
        playStreamInDiv(config, config.uid, "#pip-video-track");
      } else {
        playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
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
        playStreamInDiv(config, config.uid, "#pip-video-track");
      } else {
        playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
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
    config.userTracks[screenShareUid] = { videoTrack: screenShareTrack };
    console.log("Updated userTracks:", config.userTracks);

    // Listen for the browser's stop screen sharing event
    screenShareTrack.on("track-ended", async () => {
      console.log("Screen sharing stopped via browser UI.");
      await stopScreenShare(config); // Cleanup resources and update UI
    });

    // Toggle UI
    toggleStages(true);
    playStreamInDiv(config, screenShareUid, "#screen-share-content");
    playStreamInDiv(config, uid, "#pip-video-track");

    // Update PiP avatar
    const avatarElement = document.getElementById("pip-avatar");
    if (avatarElement) {
      avatarElement.src = user.avatar || "default-avatar.png";
    }

    // Update config
    config.screenShareRTMClient = rtmClient;
    config.screenShareRTCClient = rtcClient;
    config.sharingScreenUid = config.uid.toString();
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
  const screenShareTrack = config.userTracks[screenShareUid]?.videoTrack;

  if (screenShareTrack) {
    await config.screenShareRTCClient.unpublish([screenShareTrack]);
    screenShareTrack.stop();
    screenShareTrack.close();
    config.userTracks[screenShareUid].videoTrack = null;

    console.log("Screen share stopped successfully.");
  } else {
    console.warn("No screen share track found in userTracks.");
  }

  // Toggle UI
  toggleStages(false);

  // Clear the screen share UID from config
  config.sharingScreenUid = null;
};





export const changeUserRole = async (
  userUid,
  newRole,
  newRoleInTheCall,
  config
) => {
  console.log(
    `Changing role for user ${userUid} to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );

  // Prepare the updated attributes
  const updatedAttributes = {
    role: newRole,
    roleInTheCall: newRoleInTheCall,
  };

  // Retrieve the user's previous role and roleInTheCall
  const previousRole = config.user.role;
  const previousRoleInTheCall = config.user.roleInTheCall;

  // Update RTM attributes for the user
  if (config.clientRTM && config.clientRTM.addOrUpdateAttributes) {
    try {
      console.log(`Updating RTM attributes for user ${userUid}.`);
      await config.clientRTM.addOrUpdateAttributes(userUid, updatedAttributes);
      console.log(`RTM attributes updated for user ${userUid}.`);
    } catch (error) {
      console.error(
        `Failed to update RTM attributes for user ${userUid}:`,
        error
      );
    }
  } else {
    console.warn(
      "RTM client or addOrUpdateAttributes method is not available."
    );
  }

  // Define roles that require a wrapper
  const rolesRequiringWrapper = [
    "master",
    "host",
    "speaker",
    "meetingParticipant",
    "audienceOnStage",
  ];

  // Call addUserWrapper or removeUserWrapper based on the role
  if (rolesRequiringWrapper.includes(newRole)) {
    console.log(
      `Role ${newRole} requires a video wrapper. Adding if necessary.`
    );
    await addUserWrapper({ uid: userUid, ...updatedAttributes }, config);
  } else {
    console.log(
      `Role ${newRole} does not require a video wrapper. Removing if exists.`
    );
    removeUserWrapper(userUid);
  }

  // Handle leaving the previous role
  if (previousRoleInTheCall && previousRoleInTheCall !== newRoleInTheCall) {
    console.log(
      `Calling manageParticipants to remove user ${userUid} from previous role: ${previousRoleInTheCall}`
    );
    await manageParticipants(config, userUid, {}, "leave");
  }

  // Handle joining the new role
  console.log(
    `Calling manageParticipants for user ${userUid} with role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );
  await manageParticipants(config, userUid, updatedAttributes, "join");

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

  // Update the user's role in config
  config.user.role = newRole;
  config.user.roleInTheCall = newRoleInTheCall;

  console.log(
    `Role for user ${userUid} successfully changed to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );
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
