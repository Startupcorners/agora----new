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


export const initializeDeviceChangeListener = (config) => {
  navigator.mediaDevices.ondevicechange = async () => {
    console.log("Device change detected. Refreshing device list...");

    // Call getAvailableDevices, which will handle fetching, deduplication, and sending to Bubble
    await getAvailableDevices(config);
  };
};


export const getAvailableDevices = async (config) => {
  try {
    console.log("Fetching available media devices...");
    const devices = await navigator.mediaDevices.enumerateDevices();

    const normalizeLabel = (label) => {
      const parts = label.split(" - ");
      return parts.length > 1 ? parts[1].trim() : parts[0].trim() || "No label";
    };

    const deduplicateDevices = (deviceList) => {
      const uniqueLabels = new Set();
      return deviceList.filter((device) => {
        const normalizedLabel = normalizeLabel(device.label);
        if (uniqueLabels.has(normalizedLabel)) {
          return false;
        }
        uniqueLabels.add(normalizedLabel);
        return true;
      });
    };

    const microphones = deduplicateDevices(
      devices.filter((device) => device.kind === "audioinput")
    ).map((device) => ({
      deviceId: device.deviceId,
      label: normalizeLabel(device.label),
      kind: device.kind,
    }));

    const cameras = deduplicateDevices(
      devices.filter((device) => device.kind === "videoinput")
    ).map((device) => ({
      deviceId: device.deviceId,
      label: normalizeLabel(device.label),
      kind: device.kind,
    }));

    const speakers = deduplicateDevices(
      devices.filter((device) => device.kind === "audiooutput")
    ).map((device) => ({
      deviceId: device.deviceId,
      label: normalizeLabel(device.label),
      kind: device.kind,
    }));

    // Check if selected devices are still available and update if necessary
    if (!microphones.find((mic) => mic.deviceId === config.selectedMic)) {
      const defaultMic = microphones[0] || null;
      config.selectedMic = defaultMic ? defaultMic.deviceId : null;
      if (defaultMic && typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic({
          output1: defaultMic.deviceId,
          output2: defaultMic.label || "No label",
        });
      }
    }

    if (!cameras.find((cam) => cam.deviceId === config.selectedCam)) {
      const defaultCam = cameras[0] || null;
      config.selectedCam = defaultCam ? defaultCam.deviceId : null;
      if (defaultCam && typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam({
          output1: defaultCam.deviceId,
          output2: defaultCam.label || "No label",
        });
      }
    }

    if (!speakers.find((spk) => spk.deviceId === config.selectedSpeaker)) {
      const defaultSpeaker = speakers[0] || null;
      config.selectedSpeaker = defaultSpeaker ? defaultSpeaker.deviceId : null;
      if (defaultSpeaker && typeof bubble_fn_selectedSpeaker === "function") {
        bubble_fn_selectedSpeaker({
          output1: defaultSpeaker.deviceId,
          output2: defaultSpeaker.label || "No label",
        });
      }
    }

    // Send deduplicated device lists to Bubble
    sendDeviceDataToBubble("microphone", microphones);
    sendDeviceDataToBubble("camera", cameras);
    sendDeviceDataToBubble("speaker", speakers);

    return { microphones, cameras, speakers };
  } catch (error) {
    console.error("Error fetching available devices:", error);
    return { microphones: [], cameras: [], speakers: [] };
  }
};


// Helper function to format and send device data to Bubble
const sendDeviceDataToBubble = (deviceType, devices) => {
  const formattedData = {
    outputlist1: devices.map((d) => d.deviceId),
    outputlist2: devices.map((d) => d.label || "No label"),
    outputlist3: devices.map((d) => d.kind || "Unknown"),
  };

  // Determine the appropriate Bubble function to call based on device type
  if (deviceType === "microphone" && typeof bubble_fn_micDevices === "function") {
    bubble_fn_micDevices(formattedData);
  } else if (deviceType === "camera" && typeof bubble_fn_camDevices === "function") {
    bubble_fn_camDevices(formattedData);
  } else if (deviceType === "speaker" && typeof bubble_fn_speakerDevices === "function") {
    bubble_fn_speakerDevices(formattedData);
  }
};
