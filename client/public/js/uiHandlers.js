import { newMainApp } from "./main.js";
// uiHandlers.js
import { fetchTokens } from "./helperFunctions.js";
import { playStreamInDiv, toggleStages } from "./videoHandlers.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { manageParticipants } from "./rtcEventHandlers.js"; // Token renewal handler

const app = newMainApp();

export const toggleMic = async () => {
  const config = app.getConfig();
  try {
    console.log("configs:", config);
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

const startMic = async () => {
  const config = app.getConfig();
  try {
    console.log("Starting microphone for user:", config.uid);

    // Ensure userTracks is initialized
    const userTracks = config.userTracks || {};
    const userTrack = userTracks[config.uid] || {};

    // Create and assign a new microphone audio track
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    userTrack.audioTrack = audioTrack;

    // Publish the audio track
    await config.client.publish([audioTrack]);
    console.log("Microphone started and published");
    updatePublishingList(config.uid.toString(), "audio", "add", config);

    // Update UI to indicate the microphone is active
    updateMicStatusElement(config.uid, false); // Mic is unmuted
    bubble_fn_isMicOff(false);

    // Update usersPublishingAudio list
    const usersPublishingAudio = config.usersPublishingAudio || [];
    if (!usersPublishingAudio.includes(config.uid.toString())) {
      usersPublishingAudio.push(config.uid.toString());
    }

    // Update config using app.updateConfig
    app.updateConfig({
      userTracks: {
        ...userTracks,
        [config.uid]: userTrack,
      },
      usersPublishingAudio,
    });

    console.log("Updated usersPublishingAudio list:", usersPublishingAudio);

    // Notify Bubble with the updated list
    if (typeof bubble_fn_usersPublishingAudio === "function") {
      bubble_fn_usersPublishingAudio(usersPublishingAudio);
    } else {
      console.warn("bubble_fn_usersPublishingAudio is not defined.");
    }
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


const endMic = async () => {
  const config = app.getConfig();
  try {
    console.log("Ending microphone for user:", config.uid);

    // Ensure userTracks is initialized
    const userTracks = config.userTracks || {};
    const userTrack = userTracks[config.uid];

    if (!userTrack) {
      console.error(`User track for UID ${config.uid} is not initialized.`);
      return;
    }

    // Check if audioTrack exists before attempting to stop/unpublish
    if (userTrack.audioTrack) {
      await config.client.unpublish([userTrack.audioTrack]);
      userTrack.audioTrack.stop();
      userTrack.audioTrack.close();
      userTrack.audioTrack = null; // Set to null to indicate mic is muted

      console.log("Microphone ended and unpublished");
      updatePublishingList(config.uid.toString(), "audio", "remove", config);
    }

    // Update UI to indicate the microphone is muted
    updateMicStatusElement(config.uid, true); // Mic is muted

    // Set wrapper border to transparent
    const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
    if (wrapper) {
      wrapper.style.borderColor = "transparent"; // Transparent when muted
      console.log(`Set border to transparent for user ${config.uid}`);
    }

    // Remove the 'animated' class from all bars
    const waveElement = document.querySelector(`#wave-${config.uid}`);
    if (waveElement) {
      const audioBars = waveElement.querySelectorAll(".bar");
      if (audioBars.length > 0) {
        audioBars.forEach((bar) => bar.classList.remove("animated"));
        console.log(
          `Removed 'animated' class from bars for user ${config.uid}`
        );
      } else {
        console.warn(`No bars found in wave-${config.uid}`);
      }
    } else {
      console.warn(`Wave element not found for user ${config.uid}`);
    }

    // Notify Bubble that the microphone is off
    bubble_fn_isMicOff(true);

    // Update config using app.updateConfig
    app.updateConfig({
      userTracks: {
        ...userTracks,
        [config.uid]: userTrack,
      },
    });
  } catch (error) {
    console.error("Error in endMic for user:", config.uid, error);
  }
};


export const toggleCamera = async () => {
  const config = app.getConfig();
  try {
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    console.log("User's UID:", config.uid);

    if (config.cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    // Prevent simultaneous toggles by setting cameraToggleInProgress
    app.updateConfig({ cameraToggleInProgress: true });

    // Ensure userTracks has an entry for the user
    const userTracks = config.userTracks || {};
    const userTrack = userTracks[config.uid] || {
      videoTrack: null,
      audioTrack: null,
    };

    // Toggle camera based on the current videoTrack state
    if (userTrack.videoTrack) {
      // User is trying to turn off the camera
      await stopCamera(config);
    } else {
      // User is trying to turn on the camera
      await startCamera(config);
    }

    // Update userTracks in the config
    app.updateConfig({
      userTracks: {
        ...userTracks,
        [config.uid]: userTrack,
      },
    });
  } catch (error) {
    console.error("Error toggling the camera for user:", config.uid, error);
  } finally {
    // Reset cameraToggleInProgress
    app.updateConfig({ cameraToggleInProgress: false });
    console.log("Camera toggle progress reset for user:", config.uid);
  }
};


export const startCamera = async (config) => {
  try {
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    console.log("Turning on the camera for user:", config.uid);

    // Get or initialize userTracks for the current user
    const userTracks = config.userTracks || {};
    const userTrack = userTracks[config.uid] || {
      videoTrack: null,
      audioTrack: null,
    };

    // Create a new video track
    const videoTrack = await AgoraRTC.createCameraVideoTrack();

    if (!videoTrack) {
      console.error("Failed to create a new video track!");
      return;
    }

    // Enable and publish the video track
    await videoTrack.setEnabled(true);
    await config.client.publish([videoTrack]);

    console.log("Camera turned on and published");
    updatePublishingList(config.uid.toString(), "video", "add", config);

    // Update UI
    if (config.sharingScreenUid === config.uid.toString()) {
      playStreamInDiv(config, config.uid, "#pip-video-track");
    } else {
      playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
    }

    // Update config using app.updateConfig
    app.updateConfig({
      userTracks: {
        ...userTracks,
        [config.uid]: {
          ...userTrack,
          videoTrack,
        },
      },
    });

    // Notify Bubble of the camera state
    if (typeof bubble_fn_isCamOn === "function") {
      bubble_fn_isCamOn(true); // Camera is on
    }
  } catch (error) {
    console.error("Error starting the camera for user:", config.uid, error);
  }
};


export const stopCamera = async (config) => {
  try {
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    console.log("Turning off the camera for user:", config.uid);

    const userTracks = config.userTracks || {};
    const userTrack = userTracks[config.uid];

    if (userTrack && userTrack.videoTrack) {
      // Unpublish and stop the video track
      await config.client.unpublish([userTrack.videoTrack]);
      userTrack.videoTrack.stop();
      userTrack.videoTrack.close();

      console.log("Camera turned off and unpublished");
      updatePublishingList(config.uid.toString(), "video", "remove", config);

      // Update UI
      if (config.sharingScreenUid === config.uid.toString()) {
        playStreamInDiv(config, config.uid, "#pip-video-track");
      } else {
        playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
      }

      // Update config using app.updateConfig
      app.updateConfig({
        userTracks: {
          ...userTracks,
          [config.uid]: {
            ...userTrack,
            videoTrack: null, // Remove the video track reference
          },
        },
      });

      // Notify Bubble of the camera state
      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(false); // Camera is off
      }
    } else {
      console.warn("No active video track to stop for user:", config.uid);
    }
  } catch (error) {
    console.error("Error stopping the camera for user:", config.uid, error);
  }
};


export const toggleScreenShare = async () => {
  const config = app.getConfig();
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
    bubble_fn_isScreenOn(true);

    // Update userTracks
    const updatedUserTracks = {
      ...config.userTracks,
      [screenShareUid]: { videoTrack: screenShareTrack },
    };
    console.log("Updated userTracks:", updatedUserTracks);

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

    // Update config using app.updateConfig
    app.updateConfig({
      userTracks: updatedUserTracks,
      screenShareRTMClient: rtmClient,
      screenShareRTCClient: rtcClient,
      sharingScreenUid: config.uid.toString(),
      generatedScreenShareId: screenShareUid,
    });

    bubble_fn_userSharingScreen(config.uid.toString());

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

    // Update userTracks to remove the screen share track
    const updatedUserTracks = { ...config.userTracks };
    updatedUserTracks[screenShareUid].videoTrack = null;

    console.log("Screen share stopped successfully.");
    bubble_fn_isScreenOn(false);

    // Update config to reflect the removal of the screen share track
    app.updateConfig({
      userTracks: updatedUserTracks,
    });
  } else {
    console.warn("No screen share track found in userTracks.");
  }

  // Toggle UI
  toggleStages(false);
  playStreamInDiv(config, config.uid, `#stream-${config.uid}`);

  // Update config to clear the screen share UID and notify Bubble
  app.updateConfig({
    sharingScreenUid: null,
  });

  bubble_fn_userSharingScreen(null);
};


export const changeUserRole = async (userUid, newRole, newRoleInTheCall) => {
  const config = app.getConfig();
  console.log(
    `Changing role for user ${userUid} to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );

  // Update participant list by removing the user
  await manageParticipants(userUid, {}, "leave");

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

  // Update the user's role in the participant list and config
  await manageParticipants(userUid, { role: newRole, roleInTheCall }, "join");

  console.log(
    `Role for user ${userUid} successfully changed to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );
};


export function updateMicStatusElement(uid, isMuted) {
  const micStatusElement = document.getElementById(`mic-status-${uid}`);
  if (micStatusElement) {
    if (isMuted) {
      micStatusElement.classList.remove("hidden");
      console.log(
        `Removed 'hidden' class from mic-status-${uid} to indicate muted status.`
      );
    } else {
      micStatusElement.classList.add("hidden");
      console.log(
        `Added 'hidden' class to mic-status-${uid} to indicate unmuted status.`
      );
    }
  } else {
    console.warn(`Mic status element not found for UID ${uid}.`);
  }
}

export const stopUserCamera = async (userUid) => {
  const config = app.getConfig();
  console.log(`Sending stop camera message for user ${userUid}`);

  // Check if the RTM channel is initialized
  if (config.channelRTM) {
    const message = JSON.stringify({
      type: "stopCamera",
      userUid: userUid,
    });

    // Send the message to the RTM channel
    try {
      await config.channelRTM.sendMessage({ text: message });
      console.log(`Stop camera message sent to RTM channel: ${message}`);
    } catch (error) {
      console.error(`Failed to send stop camera message: ${error}`);
    }
  } else {
    console.warn("RTM channel is not initialized.");
  }

  console.log(`Stop camera request for user ${userUid} completed.`);
};

export const stopUserMic = async (userUid) => {
  const config = app.getConfig();
  console.log(`Sending stop mic message for user ${userUid}`);

  // Check if the RTM channel is initialized
  if (config.channelRTM) {
    const message = JSON.stringify({
      type: "stopMic",
      userUid: userUid,
    });

    // Send the message to the RTM channel
    try {
      await config.channelRTM.sendMessage({ text: message });
      console.log(`Stop mic message sent to RTM channel: ${message}`);
    } catch (error) {
      console.error(`Failed to send stop mic message: ${error}`);
    }
  } else {
    console.warn("RTM channel is not initialized.");
  }

  console.log(`Stop mic request for user ${userUid} completed.`);
};

export const denyAccess = async (userUid) => {
  const config = app.getConfig();
  console.log(`Denying access for user ${userUid}`);

  // Check if the RTM channel is initialized
  if (config.channelRTM) {
    const message = JSON.stringify({
      type: "accessDenied",
      userUid: userUid,
    });

    // Send the message to the RTM channel
    try {
      await config.channelRTM.sendMessage({ text: message });
      console.log(`Access denied message sent to RTM channel: ${message}`);
    } catch (error) {
      console.error(`Failed to send access denied message: ${error}`);
    }
  } else {
    console.warn("RTM channel is not initialized.");
  }

  console.log(`Deny access request for user ${userUid} completed.`);
};

export const stopUserScreenshare = async (userUid) => {
  const config = app.getConfig();
  console.log(`Sending stop screenshare message for user ${userUid}`);

  // Check if the RTM channel is initialized
  if (config.channelRTM) {
    const message = JSON.stringify({
      type: "stopScreenshare",
      userUid: userUid,
    });

    // Send the message to the RTM channel
    try {
      await config.channelRTM.sendMessage({ text: message });
      console.log(`Stop screenshare message sent to RTM channel: ${message}`);
    } catch (error) {
      console.error(`Failed to send stop screenshare message: ${error}`);
    }
  } else {
    console.warn("RTM channel is not initialized.");
  }

  console.log(`Stop screenshare request for user ${userUid} completed.`);
};

export const updatePublishingList = (uid, type, action) => {
  const config = app.getConfig();
  if (!uid || !type || !action || !config) {
    console.error("Invalid arguments provided to updatePublishingList.");
    return;
  }

  // Determine which list to update
  let publishingList, bubbleFunction;
  if (type === "audio") {
    publishingList = config.usersPublishingAudio || [];
    bubbleFunction = bubble_fn_usersPublishingAudio;
  } else if (type === "video") {
    publishingList = config.usersPublishingVideo || [];
    bubbleFunction = bubble_fn_usersPublishingVideo;
  } else {
    console.error("Invalid type specified. Must be 'audio' or 'video'.");
    return;
  }

  if (action === "add") {
    if (!publishingList.includes(uid)) {
      publishingList.push(uid);
      console.log(`Added UID ${uid} to ${type} publishing list.`);
    }
  } else if (action === "remove") {
    const index = publishingList.indexOf(uid);
    if (index !== -1) {
      publishingList.splice(index, 1);
      console.log(`Removed UID ${uid} from ${type} publishing list.`);
    }
  } else {
    console.error("Invalid action specified. Must be 'add' or 'remove'.");
    return;
  }

  // Update the config with app.updateConfig
  const update =
    type === "audio"
      ? { usersPublishingAudio: publishingList }
      : { usersPublishingVideo: publishingList };
  app.updateConfig(update);

  // Notify Bubble with the updated list
  if (typeof bubbleFunction === "function") {
    bubbleFunction(publishingList);
    console.log(`Notified Bubble with updated ${type} publishing list.`);
  } else {
    console.warn(`Bubble function for ${type} publishing is not defined.`);
  }
};


let triggeredReason = null;

// Add the general leave function
export const leave = async (reason) => {
  const config = app.getConfig();
  // Check if leave function has already been triggered
  if (triggeredReason) {
    console.warn(
      `Leave function already triggered with reason: ${triggeredReason}. Ignoring subsequent call.`
    );
    return; // Exit if already triggered
  }

  console.warn("leave function called with reason:", reason);
  triggeredReason = reason; // Set the triggered reason to prevent re-entry

  try {
    // Set the leave reason in the config
    app.updateConfig({ leaveReason: reason });

    // Leave RTC
    await leaveRTC(config);
    console.log("Left RTC channel successfully");

    // Leave RTM if joined
    await leaveRTM(config);
    console.log("Left RTM channel successfully");

    // Determine the appropriate reason
    const validReasons = ["left", "removed", "deniedAccess", "connectionIssue"];
    const finalReason = validReasons.includes(reason) ? reason : "other";

    // Call the Bubble function with the final reason
    if (typeof bubble_fn_leave === "function") {
      bubble_fn_leave(finalReason);
    } else {
      console.warn("bubble_fn_leave is not defined or not a function");
    }
  } catch (error) {
    console.error("Error during leave:", error);
  } finally {
    // Reset the triggeredReason after the function completes
    triggeredReason = null;
  }
};


// Function to leave RTC
export const leaveRTC = async () => {
  const config = app.getConfig();
  console.warn("leaveRTC called");

  try {
    await config.client.leave();
    app.updateConfig({ isRTCJoined: false }); // Update config through app.updateConfig
    console.log("Successfully left RTC channel");
  } catch (error) {
    console.error("Error leaving RTC channel:", error);
  }
};


// Add the leaveRTM function
export const leaveRTM = async () => {
  const config = app.getConfig();
  console.warn("leaveRTM called");

  try {
    if (config.channelRTM) {
      await config.channelRTM.leave();
      console.log("Left the RTM channel successfully");
    }

    if (config.clientRTM) {
      await config.clientRTM.logout();
      console.log("Logged out from RTM client successfully");
    }

    app.updateConfig({
      channelRTM: null,
      clientRTM: null,
      isRTMJoined: false,
    }); // Update all RTM-related config properties through app.updateConfig
  } catch (error) {
    console.error("Error in leaveRTM:", error);
  }
};


export const raiseHand = async (userUid) => {
  const config = app.getConfig();
  console.log(`Processing raise hand action for user ${userUid}`);

  // Ensure `usersRaisingHand` is initialized as an array
  const usersRaisingHand = config.usersRaisingHand || [];

  // Check if the user is already in the list
  const isRaisingHand = usersRaisingHand.includes(userUid);

  // Update the `usersRaisingHand` list
  const updatedUsersRaisingHand = isRaisingHand
    ? usersRaisingHand.filter((uid) => uid !== userUid) // Remove the user
    : [...usersRaisingHand, userUid]; // Add the user

  app.updateConfig({ usersRaisingHand: updatedUsersRaisingHand }); // Update config using app.updateConfig

  console.log(
    `User ${userUid} ${
      isRaisingHand ? "removed from" : "added to"
    } raising hand list.`
  );

  // Check if the RTM channel is initialized
  if (config.channelRTM) {
    // Prepare the message payload
    const message = JSON.stringify({
      type: "raiseHand",
      userUid: userUid,
    });

    // Send the message to the RTM channel
    try {
      await config.channelRTM.sendMessage({ text: message });
      console.log(`Raise hand message sent to RTM channel: ${message}`);
      if (typeof bubble_fn_usersRaisingHand === "function") {
        bubble_fn_usersRaisingHand(updatedUsersRaisingHand);
      }
    } catch (error) {
      console.error(`Failed to send raise hand message: ${error}`);
    }
  } else {
    console.warn("RTM channel is not initialized.");
  }

  console.log(`Raise hand action for user ${userUid} completed.`);
};
