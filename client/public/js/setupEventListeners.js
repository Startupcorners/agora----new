// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
} from "./rtcEventHandlers.js";
import { toggleMic, updateMicStatusElement } from "./uiHandlers.js";
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
    console.log("Heard user-unpublished:", user);
    await handleUserUnpublished(user, mediaType, config);
  });


  // Handle when a user joins the session
client.on("user-joined", async (user) => {
  console.log(`User joined: ${user.uid}`);

  let userAttr = {}; // Initialize an empty object for user attributes

  if (config.clientRTM) {
    try {
      // Fetch attributes for the joining user
      const fetchedAttributes = await config.clientRTM.getUserAttributes(
        user.uid.toString()
      );
      console.log(
        `Fetched attributes for user ${user.uid}:`,
        fetchedAttributes
      );

      // Merge fetched attributes with defaults to ensure all fields are covered
      userAttr = {
        name: fetchedAttributes.name || "Unknown",
        avatar: fetchedAttributes.avatar || "default-avatar-url",
        company: fetchedAttributes.company || "Unknown",
        designation: fetchedAttributes.designation || "Unknown",
        role: fetchedAttributes.role || "audience",
        rtmUid: fetchedAttributes.rtmUid || user.uid, // Fall back to user UID
        bubbleid: fetchedAttributes.bubbleid || "",
        isRaisingHand: fetchedAttributes.isRaisingHand || false,
        sharingScreen: fetchedAttributes.sharingScreen || "0",
        roleInTheCall: fetchedAttributes.roleInTheCall || "audience",
      };
    } catch (error) {
      console.error(`Failed to fetch attributes for user ${user.uid}:`, error);

      // Default attributes if fetching fails
      userAttr = {
        name: "Unknown",
        avatar: "default-avatar-url",
        company: "Unknown",
        designation: "Unknown",
        role: "audience",
        rtmUid: user.uid, // Default to user UID
        bubbleid: "",
        isRaisingHand: false,
        sharingScreen: "0",
        roleInTheCall: "audience",
      };
    }
  } else {
    console.warn(
      `RTM client not initialized. Skipping attribute fetch for user ${user.uid}.`
    );

    // Default attributes if RTM is unavailable
    userAttr = {
      name: "Unknown",
      avatar: "default-avatar-url",
      company: "Unknown",
      designation: "Unknown",
      role: "audience",
      rtmUid: user.uid,
      bubbleid: "",
      isRaisingHand: false,
      sharingScreen: "0",
      roleInTheCall: "audience",
    };
  }

  try {
    // Pass the user attributes along with the user and config
    await handleUserJoined(user, config, userAttr);
    console.log(`User ${user.uid} handled successfully.`);
  } catch (error) {
    console.error(`Error handling user ${user.uid}:`, error);
  }
});


  // Handle when a user leaves the session
  client.on("user-left", async (user) => {
    console.log("Heard user-left:", user);
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

    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.text);
    } catch (error) {
      parsedMessage = { text: message.text };
    }

    if (parsedMessage.type === "roleChange") {
      const { userUid, newRole, newRoleInTheCall } = parsedMessage;
      console.log(
        `Received role change for user ${userUid}: role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
      );

      if (userUid === config.user.rtmUid) {
        console.log(
          "Role change is for the current user. Logging out of RTM and reinitializing app with new role."
        );

        config.user.role = newRole;
        config.user.roleInTheCall = newRoleInTheCall;


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
      console.log(
        "Triggering manageParticipants for user in the waiting room:",
        memberId
      );
      manageParticipants(memberId, userAttributes, "join");
    }
  });

channelRTM.on("MemberJoined", async (memberId) => {
  console.log(`RTM Member joined: ${memberId}`);

  // If the joined member is UID 3, trigger the Bubble function
  if (memberId === "3") {
    console.log("UID 3 joined. Triggering bubble_fn_waitingForAcceptance.");
    bubble_fn_isAudioRecording("yes");
    bubble_fn_waitingForAcceptance(); // Trigger Bubble function
  }
});

// Handle RTM member left event
channelRTM.on("MemberLeft", (memberId) => {
  console.log(`RTM Member left: ${memberId}`);

  if (memberId === "3") {
    console.log("UID 3 left.");
    bubble_fn_isAudioRecording("no");
  }

});

console.log(
  "RTM message listener with member join/leave handlers initialized."
);
};


let lastMicPermissionState = null; // Track the last known microphone permission state

export async function checkMicrophonePermissions(config) {
  if (navigator.permissions) {
    try {
      const micPermission = await navigator.permissions.query({
        name: "microphone",
      });

      // Notify Bubble on initial state
      if (micPermission.state !== lastMicPermissionState) {
        handleMicPermissionChange(micPermission.state, config);
        lastMicPermissionState = micPermission.state;
      }

      // Use onchange if supported
      if ("onchange" in micPermission) {
        micPermission.onchange = () => {
          console.log(
            `Microphone permission changed to: ${micPermission.state}`
          );
          if (micPermission.state !== lastMicPermissionState) {
            handleMicPermissionChange(micPermission.state, config);
            lastMicPermissionState = micPermission.state; // Update the tracked state
          }
        };
      } else {
        console.warn(
          "Permission change listener (onchange) is not supported in this browser."
        );

        // Fallback: Polling for permission changes
        setInterval(async () => {
          const newPermission = await navigator.permissions.query({
            name: "microphone",
          });
          if (newPermission.state !== lastMicPermissionState) {
            console.log(
              `Detected permission change via polling: ${newPermission.state}`
            );
            handleMicPermissionChange(newPermission.state, config);
            lastMicPermissionState = newPermission.state; // Update the tracked state
          }
        }, 5000); // Poll every 5 seconds
      }

      console.log(
        `Initial microphone permission state: ${micPermission.state}`
      );
    } catch (error) {
      console.error("Error checking microphone permissions:", error);
    }
  } else {
    console.warn("Permission API is not supported in this browser.");
  }
}

// Handle microphone permission changes
function handleMicPermissionChange(state, config) {
  const isMicAvailable = state === "granted";

  // Notify Bubble about the microphone permission change
  if (typeof bubble_fn_micPermissionChanged === "function") {
    bubble_fn_micPermissionChanged(isMicAvailable);
    console.log(
      `Bubble notified about microphone permission change: ${
        isMicAvailable ? "granted" : "not granted"
      }`
    );
  } else {
    console.warn("bubble_fn_micPermissionChanged is not defined.");
  }

  // If the microphone is not granted, toggle the mic to update the UI
  if (!isMicAvailable) {
    console.log("Microphone permission not granted. Updating UI...");
    toggleMic(config); // Call toggleMic to handle the UI and notify the user
  } else {
    // If microphone is granted, notify Bubble using bubble_fn_systemmuted(false)
    if (typeof bubble_fn_systemmuted === "function") {
      bubble_fn_systemmuted("no");
      console.log(
        "Microphone permission granted. Bubble notified system is unmuted."
      );
    } else {
      console.warn("bubble_fn_systemmuted is not defined.");
    }

    // Update lastMutedStatuses for the current user
    if (config && config.uid) {
      lastMutedStatuses[config.uid] = "no";
      console.log(
        `Updated lastMutedStatuses for UID ${config.uid} to "no" (unmuted).`
      );
    } else {
      console.warn("Config or UID is undefined; could not update lastMutedStatuses.");
    }
  }
}
