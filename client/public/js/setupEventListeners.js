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

    // Fetch the updated list of devices
    const { microphones, cameras, speakers } = await getAvailableDevices(
      config
    );

    // Check if selected devices are still available; if not, update to default devices
    if (
      config.selectedMic &&
      !microphones.find((mic) => mic.deviceId === config.selectedMic)
    ) {
      console.warn(
        `Selected microphone "${config.selectedMic}" is no longer available.`
      );
      const defaultMic = microphones.length ? microphones[0] : null;
      config.selectedMic = defaultMic ? defaultMic.deviceId : null;
      if (defaultMic && typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic({
          output1: defaultMic.deviceId,
          output2: defaultMic.label || "No label",
        });
      }
    }

    if (
      config.selectedCam &&
      !cameras.find((cam) => cam.deviceId === config.selectedCam)
    ) {
      console.warn(
        `Selected camera "${config.selectedCam}" is no longer available.`
      );
      const defaultCam = cameras.length ? cameras[0] : null;
      config.selectedCam = defaultCam ? defaultCam.deviceId : null;
      if (defaultCam && typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam({
          output1: defaultCam.deviceId,
          output2: defaultCam.label || "No label",
        });
      }
    }

    if (
      config.selectedSpeaker &&
      !speakers.find((spk) => spk.deviceId === config.selectedSpeaker)
    ) {
      console.warn(
        `Selected speaker "${config.selectedSpeaker}" is no longer available.`
      );
      const defaultSpeaker = speakers.length ? speakers[0] : null;
      config.selectedSpeaker = defaultSpeaker ? defaultSpeaker.deviceId : null;
      if (defaultSpeaker && typeof bubble_fn_selectedSpeaker === "function") {
        bubble_fn_selectedSpeaker({
          output1: defaultSpeaker.deviceId,
          output2: defaultSpeaker.label || "No label",
        });
      }
    }

    // Helper function to format device lists for Bubble
    const formatDeviceListForBubble = (devices) => ({
      outputlist1: devices.map((d) => d.deviceId),
      outputlist2: devices.map((d) => d.label || "No label"),
      outputlist3: devices.map((d) => d.kind || "Unknown"),
    });

    // Send the updated device lists to Bubble
    if (typeof bubble_fn_micDevices === "function") {
      bubble_fn_micDevices(formatDeviceListForBubble(microphones));
    }
    if (typeof bubble_fn_camDevices === "function") {
      bubble_fn_camDevices(formatDeviceListForBubble(cameras));
    }
    if (typeof bubble_fn_speakerDevices === "function") {
      bubble_fn_speakerDevices(formatDeviceListForBubble(speakers));
    }
  };
};


export const getAvailableDevices = async (config = {}) => {
  try {
    console.log("Fetching available media devices...");
    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log("All devices enumerated:", devices);

    // Normalize label by splitting on " - " and keeping the second part if available
    const normalizeLabel = (label) => {
      const parts = label.split(" - ");
      return parts.length > 1 ? parts[1].trim() : parts[0].trim() || "No label";
    };

    // Filter devices by kind and deduplicate within each category
    const microphones = devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: normalizeLabel(device.label),
        kind: device.kind,
      }));
    const cameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: normalizeLabel(device.label),
        kind: device.kind,
      }));
    const speakers = devices
      .filter((device) => device.kind === "audiooutput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: normalizeLabel(device.label),
        kind: device.kind,
      }));

    console.log("Filtered and unique microphone labels:", microphones);
    console.log("Filtered and unique camera labels:", cameras);
    console.log("Filtered and unique speaker labels:", speakers);

    // Set default devices if available
    const defaultMic = microphones.length ? microphones[0] : null;
    const defaultCam = cameras.length ? cameras[0] : null;
    const defaultSpeaker = speakers.length ? speakers[0] : null;

    // Update config only if selected values are empty
    if (!config.selectedMic && defaultMic) {
      config.selectedMic = defaultMic.deviceId;
      if (typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic({
          output1: defaultMic.deviceId,
          output2: defaultMic.label,
        });
      }
    }
    if (!config.selectedCam && defaultCam) {
      config.selectedCam = defaultCam.deviceId;
      if (typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam({
          output1: defaultCam.deviceId,
          output2: defaultCam.label,
        });
      }
    }
    if (!config.selectedSpeaker && defaultSpeaker) {
      config.selectedSpeaker = defaultSpeaker.deviceId;
      if (typeof bubble_fn_selectedSpeaker === "function") {
        bubble_fn_selectedSpeaker({
          output1: defaultSpeaker.deviceId,
          output2: defaultSpeaker.label,
        });
      }
    }

    // Helper function to format device lists for Bubble
    const formatDeviceListForBubble = (devices) => ({
      outputlist1: devices.map((d) => d.deviceId),
      outputlist2: devices.map((d) => d.label || "No label"),
      outputlist3: devices.map((d) => d.kind || "Unknown"),
    });

    // Send device lists to Bubble with IDs, labels, and kinds
    if (typeof bubble_fn_micDevices === "function") {
      bubble_fn_micDevices(formatDeviceListForBubble(microphones));
    }
    if (typeof bubble_fn_camDevices === "function") {
      bubble_fn_camDevices(formatDeviceListForBubble(cameras));
    }
    if (typeof bubble_fn_speakerDevices === "function") {
      bubble_fn_speakerDevices(formatDeviceListForBubble(speakers));
    }

    // Return the device lists for further use
    return { microphones, cameras, speakers };
  } catch (error) {
    console.error("Error fetching available devices:", error);
    return { microphones: [], cameras: [], speakers: [] }; // Return empty lists in case of error
  }
};

