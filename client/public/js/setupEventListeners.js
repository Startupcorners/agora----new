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
  switchCamera,
  switchMicrophone,
  switchSpeaker,
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
        await switchCam(config, cameras[0]);
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


// Function to fetch and send the full list of devices to Bubble
export const fetchAndSendDeviceList = async () => {
  try {
    console.log("Fetching available media devices...");
    const devices = await AgoraRTC.getDevices();
    console.log("Devices enumerated by Agora:", devices);

    const microphones = devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    const cameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    const speakers = devices
      .filter((device) => device.kind === "audiooutput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    // Send all device lists to Bubble
    console.log("Sending device lists to Bubble.");
    sendDeviceDataToBubble("microphone", microphones);
    sendDeviceDataToBubble("camera", cameras);
    sendDeviceDataToBubble("speaker", speakers);

    return { microphones, cameras, speakers };
  } catch (error) {
    console.error("Error fetching available devices:", error);
    return { microphones: [], cameras: [], speakers: [] };
  }
};

// Function to update selected devices in the config and notify Bubble when user joins
export const updateSelectedDevices = (config, devices) => {
  const { microphones, cameras, speakers } = devices;

  // Set selected devices only if they are not already set
  if (!config.selectedMic && microphones.length > 0) {
    config.selectedMic = microphones[0];
    console.log("Selected microphone set to:", config.selectedMic.label);

    // Notify Bubble of the selected microphone
    if (typeof bubble_fn_selectedMic === "function") {
      bubble_fn_selectedMic(config.selectedMic.label);
    }
  }

  if (!config.selectedCam && cameras.length > 0) {
    config.selectedCam = cameras[0];
    console.log("Selected camera set to:", config.selectedCam.label);

    // Notify Bubble of the selected camera
    if (typeof bubble_fn_selectedCam === "function") {
      bubble_fn_selectedCam(config.selectedCam.label);
    }
  }

  if (!config.selectedSpeaker && speakers.length > 0) {
    config.selectedSpeaker = speakers[0];
    console.log("Selected speaker set to:", config.selectedSpeaker.label);

    // Notify Bubble of the selected speaker
    if (typeof bubble_fn_selectedSpeaker === "function") {
      bubble_fn_selectedSpeaker(config.selectedSpeaker.label);
    }
  }
};






const switchMic = async (config, micInfo) => {
  try {
    if (config.localAudioTrack) {
      await config.localAudioTrack.setDevice(micInfo.deviceId);
      config.selectedMic = micInfo; // Update selected mic in config
      console.log("Switched to new microphone:", micInfo.label);

      // Notify Bubble of the new selected mic
      if (typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic(micInfo.label);
      }
    }
  } catch (error) {
    console.error("Error switching microphone:", error);
  }
};



const switchSpeaker = async (config, speakerInfo) => {
  try {
    // Set the selected speaker in config
    config.selectedSpeaker = speakerInfo;
    console.log("Switched to new speaker:", speakerInfo.label);

    // Notify Bubble of the new selected speaker
    if (typeof bubble_fn_selectedSpeaker === "function") {
      bubble_fn_selectedSpeaker(speakerInfo.label);
    }
  } catch (error) {
    console.error("Error switching speaker:", error);
  }
};


const switchCam = async (config, camInfo) => {
  try {
    const uid = config.uid; // Assuming config has the UID for the user
    let userTrack = userTracks[uid] || {}; // Get or initialize the user track

    if (config.localVideoTrack) {
      // Switch to the specified camera device
      await config.localVideoTrack.setDevice(camInfo.deviceId);
      console.log("Switched to new camera:", camInfo.label);

      // Update selected camera in config and userTrack
      config.selectedCam = camInfo;
      userTrack.videoTrack = config.localVideoTrack;
      userTrack.selectedCam = camInfo;
      userTracks[uid] = { ...userTrack };

      // Notify Bubble of the new selected camera
      if (typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam(camInfo.label);
      }

      // Re-enable virtual background if it was enabled
      if (
        config.isVirtualBackGroundEnabled &&
        userTrack.isVideoMuted === false
      ) {
        await toggleVirtualBackground(config, config.currentVirtualBackground);
      }
    }
  } catch (error) {
    console.error("Error switching camera:", error);
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