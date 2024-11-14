// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
} from "./rtcEventHandlers.js";
import {
  startScreenShare,
  stopScreenShare,
  manageCameraState,
  playCameraVideo,
  showAvatar,
  toggleStages,
} from "./videoHandlers.js";
import { userTracks } from "./state.js";
import {
  fetchTokens,
  switchCam,
  switchMic,
  switchSpeaker,
  fetchAndSendDeviceList,
} from "./helperFunctions.js";

export const setupEventListeners = (config) => {
  const client = config.client;

  // Handle when a user publishes their media (audio/video)
  client.on("user-published", async (user, mediaType) => {
    console.log(
      `user-published event received for user: ${user.uid}, mediaType: ${mediaType}`
    );
    await handleUserPublished(user, mediaType, config, client);
  });

  // Handle when a user stops publishing their media
  client.on("user-unpublished", async (user, mediaType) => {
    await handleUserUnpublished(user, mediaType, config);
  });

  // Handle when a user joins the session
  client.on("user-joined", async (user) => {
    console.log(`User joined: ${user.uid}`);
    await handleUserJoined(user, config);
  });

  // Handle when a user leaves the session
  client.on("user-left", async (user) => {
    await handleUserLeft(user, config);
  });

  // Enable the audio volume indicator
  client.enableAudioVolumeIndicator();

  // Handle volume indicator changes
  client.on("volume-indicator", async (volumes) => {
    await handleVolumeIndicator(volumes, config);
  });

config.client.on("onMicrophoneChanged", async (info) => {
  console.log("Microphone device change detected:", info);
  await fetchAndSendDeviceList();

  const action = info.state === "ADDED" ? "added" : "removed";

  if (action === "added") {
    if (info.kind === "audiooutput") {
      // If a speaker is added, switch to the new speaker
      await switchSpeaker(config, info);
    } else if (info.kind === "audioinput") {
      // If a microphone is added, set it as the selected mic
      await switchMic(config, info);
    }
  } else if (action === "removed") {
    if (info.kind === "audiooutput") {
      // If the selected speaker is removed, set it to null
      if (
        config.selectedSpeaker &&
        config.selectedSpeaker.deviceId === info.deviceId
      ) {
        config.selectedSpeaker = null;

        // Get the updated list of devices and select the first available speaker if any
        const devices = await AgoraRTC.getDevices();
        const speakers = devices.filter(
          (device) => device.kind === "audiooutput"
        );

        if (speakers.length > 0) {
          await switchSpeaker(config, speakers[0]);
        } else {
          console.log("No speakers available to switch to after removal.");
        }
      }
    } else if (info.kind === "audioinput") {
      // If the selected mic is removed, set it to null if it was the selected mic
      if (config.selectedMic && config.selectedMic.deviceId === info.deviceId) {
        config.selectedMic = null;

        // Get the updated list of devices and select the first available microphone if any
        const devices = await AgoraRTC.getDevices();
        const microphones = devices.filter(
          (device) => device.kind === "audioinput"
        );

        if (microphones.length > 0) {
          await switchMic(config, microphones[0]);
        } else {
          console.log("No microphones available to switch to after removal.");
        }
      }
    }
  }
});

config.client.on("onCameraChanged", async (info) => {
  console.log("Camera device change detected:", info);
  await fetchAndSendDeviceList();

  if (info.state === "ADDED") {
    // A camera was added, so we only update the device list
    console.log("Camera added. Device list updated.");
  } else if (info.state === "REMOVED") {
    // A camera was removed, check if we need to switch to a default camera
    if (config.selectedCam && config.selectedCam.deviceId === info.deviceId) {
      config.selectedCam = null; // Reset the selected camera

      // Get the updated list of devices and select the first available camera
      const devices = await AgoraRTC.getDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");

      if (cameras.length > 0) {
        // If there's at least one camera left, switch to it
        await switchCam(config, userTracks, cameras[0]);
      } else {
        console.log("No cameras available to switch to after removal.");
      }
    }
  }
});


};

// eventListeners.js
export const setupRTMMessageListener = (
  channelRTM,
  manageParticipants,
  config
) => {
  if (!channelRTM) {
    console.warn("RTM channel is not initialized.");
    return;
  }

  console.log("Current user's rtmUid:", config.user.rtmUid);

  // Listen for messages on the RTM channel
  channelRTM.on("ChannelMessage", async (message, memberId, messagePros) => {
    console.log("Received RTM message:", message.text);

    // Retrieve the attributes of the user who sent the message
    let userAttributes = {};
    try {
      userAttributes = await config.clientRTM.getUserAttributes(memberId);
      console.log(`Attributes for user ${memberId}:`, userAttributes);
    } catch (error) {
      console.error(
        `Failed to retrieve attributes for user ${memberId}:`,
        error
      );
    }

    // Parse the message text as JSON if it contains structured data
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.text);
    } catch (error) {
      // If parsing fails, it's likely a plain text message (e.g., "waiting room")
      parsedMessage = { text: message.text };
    }

    // Handle different types of messages
    if (parsedMessage.type === "roleChange") {
      // Handle role change messages
      const { userUid, newRole, newRoleInTheCall } = parsedMessage;
      console.log(
        `Received role change for user ${userUid}: role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
      );

      // If the role change is for the current user, log out and reinitialize app with new role
      if (userUid === config.user.rtmUid) {
        console.log(
          "Role change is for the current user. Logging out of RTM and reinitializing app with new role."
        );

        // Update local user config with new role and roleInTheCall
        config.user.role = newRole;
        config.user.roleInTheCall = newRoleInTheCall;

        try {
          // Log out of RTM to ensure a clean state
          await config.clientRTM.logout();
          console.log("Logged out of RTM successfully.");
        } catch (error) {
          console.error(
            "Failed to log out of RTM before reinitialization:",
            error
          );
        }

        // Reinitialize the app with newMainApp to apply the new role configuration
        const newAppInstance = newMainApp(config);
        window.app = newAppInstance;
        newAppInstance
          .join()
          .then(() => {
            console.log("Successfully joined with updated role.");
          })
          .catch((error) => {
            console.error("Error joining after role change:", error);
          });
      }
    } else if (
      parsedMessage.text &&
      parsedMessage.text.includes("waiting room")
    ) {
      // Handle waiting room messages
      console.log(
        "Triggering manageParticipants for user in the waiting room:",
        memberId
      );
      manageParticipants(memberId, userAttributes, "join");
    }
  });

  console.log("RTM message listener initialized.");
};
