// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
} from "./publishUnpublishHub.js";
import { handleUserJoined, handleUserLeft } from "./joinLeaveRemoveUser.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { fetchAndSendDeviceList, manageParticipants } from "./talkToBubble.js";
import { switchCam, switchSpeaker, handleCameraDeactivation, handleMicDeactivation, handleSpeakerDeactivation } from "./handleDevices.js";
import { handleRaisingHand } from "./uiHandlers.js";
import { leave } from "./joinLeaveLocalUser.js";
import { onRoleChange } from "./roleChange.js";
import { toggleCamera, toggleScreenShare } from "./video.js";
import { toggleMic } from "./audio.js";

let lastMutedStatuses = {}; // External variable to track the mute status of users
let speakingIntervals = {}; // External variable to track speaking intervals for users
let lastMicPermissionState = null; // External variable to track the microphone permission state

export const setupEventListeners = (config) => {
  console.log("listenerConfig", config);
  const client = config.client;

  // Handle when a user publishes their media (audio/video)
  client.on("user-published", async (user, mediaType) => {
    console.log(
      `user-published event received for user: ${user.uid}, mediaType: ${mediaType}`
    );
    await handleUserPublished(user, mediaType, client, config);
  });

  // Handle when a user stops publishing their media
  client.on("user-unpublished", async (user, mediaType) => {
    console.log("Heard user-unpublished:", user);
    await handleUserUnpublished(user, mediaType, config);
  });

  config.client.on("autoplay-fallback", () => {
    console.warn("Autoplay was blocked by the browser.");

    // Notify the user with a UI element (e.g., a button)
    const autoplayButton = document.createElement("button");
    autoplayButton.textContent = "Start Media";
    autoplayButton.style.position = "absolute";
    autoplayButton.style.zIndex = "1000";
    autoplayButton.style.top = "50%";
    autoplayButton.style.left = "50%";
    autoplayButton.style.transform = "translate(-50%, -50%)";
    document.body.appendChild(autoplayButton);

    autoplayButton.addEventListener("click", () => {
      config.client.enableLocalAudio(); // Start audio manually
      config.client.enableLocalVideo(); // Start video manually
      autoplayButton.remove(); // Remove the button after interaction
    });
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
          sharingScreenUid: fetchedAttributes.sharingScreenUid || "0",
          roleInTheCall: fetchedAttributes.roleInTheCall || "audience",
        };
      } catch (error) {
        console.error(
          `Failed to fetch attributes for user ${user.uid}:`,
          error
        );

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
          sharingScreenUid: "0",
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
        sharingScreenUid: "0",
        roleInTheCall: "audience",
      };
    }

    try {
      // Pass the user attributes along with the user and config
      await handleUserJoined(user, userAttr);
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

  client.on("connection-state-change", async (curState, revState, reason) => {
    console.log(
      `Connection state changed from ${revState} to ${curState} due to ${reason}`
    );

    if (curState === "DISCONNECTED" && !config.leaveReason) {
      console.log("Processing disconnection because leaveReason is empty.");

      if (reason === "NETWORK_ERROR" || reason === "FAILURE") {
        console.warn("User has been disconnected due to network issues.");
        if (leave && typeof leave === "function") {
          await leave("connectionIssue", config);
        } else {
          console.warn("Leave function is not available");
        }
      } else if (reason === "LEAVE_CHANNEL") {
        console.log("User has left the channel voluntarily.");
        await leave("left", config);
        // No action needed; this is a normal leave
      } else {
        console.warn("User has been disconnected for an unknown reason.");
        if (leave && typeof leave === "function") {
          await leave("other", config);
        }
      }
    } else if (config.leaveReason) {
      console.log(
        `Disconnection handling skipped because leaveReason is set to: ${config.leaveReason}`
      );
    }
  });

  AgoraRTC.on("microphone-changed", async (info) => {
    console.log("Microphone device change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";

    if (action === "activated") {
      await switchMic(info.device);
    } else if (action === "deactivated") {
      await handleMicDeactivation(info.device);
    }
  });

  AgoraRTC.on("playback-device-changed", async (info) => {
    console.log("Playback device (speaker) change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";

    if (action === "activated") {
      await switchSpeaker(info.device);
    } else if (action === "deactivated") {
      await handleSpeakerDeactivation(info.device);
    }
  });

  AgoraRTC.on("camera-changed", async (info) => {
    console.log("Camera device change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";

    if (action === "activated") {
      console.log("Camera activated:", info.device.label);
    } else if (action === "deactivated") {
      await handleCameraDeactivation(info.device);
    }
  });
};

export const setupRTMMessageListener = (config) => {
  const channelRTM = config.channelRTM;
  if (!channelRTM) {
    console.warn("RTM channel is not initialized.");
    return;
  }

  console.log("Current user's rtmUid:", config.user.rtmUid);

  // Listen for messages on the RTM channel
  channelRTM.on("ChannelMessage", async (message, memberId) => {
    console.log("Received RTM message:", message.text);

    // Ignore messages sent by yourself
    if (memberId === config.user.rtmUid) {
      console.log("Message is from the current user. Ignoring.");
      return;
    }

    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.text);
    } catch (error) {
      console.error("Failed to parse RTM message:", error);
      return;
    }

    const { type, userUid, newRole, newRoleInTheCall, userAttr } =
      parsedMessage;

    if (type === "raiseHand") {
      // Handle "raiseHand" message
      console.log(`Raise hand message received for user ${userUid}`);
      if (userUid) {
        console.log(`User ${userUid} has raised their hand.`);
        await handleRaisingHand(userUid);
      }
    } else if (type === "roleChange") {
      // Handle "roleChange" message
      if (newRoleInTheCall === "audience") {
        await removeUserWrapper(userUid);
      }

      console.log(config.user.rtmUid);

      if (userUid.toString() === config.user.rtmUid) {
        console.log(
          "Role change is for the current user. Calling onRoleChange."
        );
        try {
          await onRoleChange(newRoleInTheCall);
          console.log("Successfully handled role change.");
        } catch (error) {
          console.error("Error handling role change:", error);
        }
      } else {
        console.log(
          `Role change message for user ${userUid}, but not current user. Ignoring.`
        );
      }
    } else if (type === "userRoleUpdated") {
      // Handle "userRoleUpdated" message
      console.log(
        `Received userRoleUpdated for user ${userUid}: role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
      );

      if (!userAttr) {
        console.warn(
          `No userAttr provided in userRoleUpdated message for user ${userUid}.`
        );
        return;
      }

      // Update participant list
      await manageParticipants(userUid, {}, "leave");
      await manageParticipants(userUid, userAttr, "join");

      // Handle video wrapper logic
      const rolesRequiringWrapper = [
        "master",
        "host",
        "speaker",
        "meetingParticipant",
        "audienceOnStage",
      ];

      if (rolesRequiringWrapper.includes(newRoleInTheCall)) {
        console.log(
          `Role ${newRoleInTheCall} requires a video wrapper. Adding if necessary.`
        );
        await addUserWrapper(userUid, config);
      } else {
        console.log(
          `Role ${newRoleInTheCall} does not require a video wrapper. Removing if exists.`
        );
        removeUserWrapper(userUid);
      }
    } else if (type === "stopCamera") {
      // Handle "stopCamera" message
      console.log(`Stop camera message received for user ${userUid}`);
      if (userUid.toString() === config.user.rtmUid) {
        console.log(
          "stopCamera is for the current user. Calling toggleCamera."
        );
        toggleCamera(config);
      }
    } else if (type === "stopMic") {
      // Handle "stopMic" message
      console.log(`Stop mic message received for user ${userUid}`);
      if (userUid.toString() === config.user.rtmUid) {
        console.log("stopMic is for the current user. Calling toggleMic.");
        toggleMic(config);
      }
    } else if (type === "stopScreenshare") {
      // Handle "stopScreenshare" message
      console.log(`Stop screenshare message received for user ${userUid}`);
      if (userUid.toString() === config.user.rtmUid) {
        console.log(
          "stopScreenshare is for the current user. Calling toggleScreenShare."
        );
        toggleScreenShare(config);
      }
    } else if (type === "accessDenied") {
      // Handle "accessDenied" message
      console.log(`Access denied message received for user ${userUid}`);
      if (userUid.toString() === config.user.rtmUid) {
        console.log(
          "Access denied is for the current user. Triggering leave with 'removed'."
        );
        await leave("removed", config);
      }
    } else {
      console.warn("Unhandled RTM message type:", type);
    }
  });

  // Handle member join
  channelRTM.on("MemberJoined", async (memberId) => {
    console.log(`RTM Member joined: ${memberId}`);
  });

  // Handle member leave
  channelRTM.on("MemberLeft", async (memberId) => {
    console.log(`RTM Member left: ${memberId}`);
  });

  console.log(
    "RTM message listener with member join/leave handlers initialized."
  );
};

export async function checkMicrophonePermissions(config) {
  if (navigator.permissions) {
    try {
      const micPermission = await navigator.permissions.query({
        name: "microphone",
      });

      // Notify Bubble on initial state
      if (micPermission.state !== lastMicPermissionState) {
        handleMicPermissionChange(micPermission.state, config); // pass a placeholder config object
        lastMicPermissionState = micPermission.state; // Update the external variable
      }

      // Use onchange if supported
      if ("onchange" in micPermission) {
        micPermission.onchange = () => {
          console.log(
            `Microphone permission changed to: ${micPermission.state}`
          );
          if (micPermission.state !== lastMicPermissionState) {
            handleMicPermissionChange(micPermission.state, config); // pass a placeholder config object
            lastMicPermissionState = micPermission.state; // Update the external variable
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
            handleMicPermissionChange(newPermission.state, config); // pass a placeholder config object
            lastMicPermissionState = newPermission.state; // Update the external variable
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
  if (!config || config.user.roleInTheCall === "waiting" || !config.client) {
    console.log(
      "Microphone permission change ignored: user in 'waiting' role or client not initialized."
    );
    return;
  }

  const isMicAvailable = state === "granted";

  // Initialize lastMutedStatuses for the user if not already set (external variable)
  if (!lastMutedStatuses[config.uid]) {
    lastMutedStatuses[config.uid] = "unknown"; // Default to "unknown" for first-time detection
    console.log(
      `Initialized lastMutedStatuses for UID ${config.uid}: "unknown"`
    );
  }

  // Notify Bubble about the microphone permission change
  if (typeof bubble_fn_micPermissionIsGranted === "function") {
    const bubbleMessage = isMicAvailable ? "yes" : "no";
    bubble_fn_micPermissionIsGranted(bubbleMessage);
    console.log(
      `Bubble notified about microphone permission change: ${bubbleMessage}`
    );
  } else {
    console.warn("bubble_fn_micPermissionIsGranted is not defined.");
  }

  // If the microphone is not granted, toggle the mic to update the UI
  if (!isMicAvailable) {
    console.log("Microphone permission not granted. Updating UI...");
    toggleMic(); // Call toggleMic to handle the UI and notify the user
    lastMutedStatuses[config.uid] = "unknown"; // Set to "unknown" when mic is unavailable
    console.log(`Set lastMutedStatuses for UID ${config.uid} to "unknown".`);
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

    // Update lastMutedStatuses for the current user (external variable)
    lastMutedStatuses[config.uid] = "no"; // Update the external variable to "no" (unmuted)
    console.log(
      `Updated lastMutedStatuses for UID ${config.uid} to "no" (unmuted).`
    );
  }
}


export const setupLeaveListener = () => {
  // Listen for page unload events (close, reload, or navigating away)
  window.addEventListener("beforeunload", (event) => {
    const leaveReason = "left"; // You can customize the reason based on your needs
    leave(leaveReason);
  });
};

export const handleVolumeIndicator = (() => {
  return async (result, config) => {
    const currentUserUid = config.uid; // Extract the current user's UID from the config

    for (const volume of result) {
      const userUID = volume.uid;

      // Ignore UID 1 (screen share client or any other special case)
      if (userUID === 1) {
        continue; // Skip this iteration
      }

      const audioLevel = volume.level; // The audio level, used to determine when the user is speaking
      let wrapper = document.querySelector(`#video-wrapper-${userUID}`);
      let waveElement = document.querySelector(`#wave-${userUID}`);
      console.log(`UID: ${userUID}, Audio Level: ${audioLevel}`);

      // Determine the current status based on audio level
      const currentStatus = audioLevel < 3 ? "yes" : "no";

      // Apply audio level indicator styles if the wrapper is available
      if (wrapper) {
        if (audioLevel > 50) {
          wrapper.style.borderColor = "#1a73e8"; // Blue when the user is speaking
        } else {
          wrapper.style.borderColor = "transparent"; // Transparent when not speaking
        }
      }

      if (waveElement) {
        const audioBars = waveElement.querySelectorAll(".bar");
        if (audioBars.length > 0) {
          if (audioLevel > 50) {
            // User is speaking

            // If we don't already have an interval for this user, create one
            if (!speakingIntervals[userUID]) {
              // Start interval to update bars
              speakingIntervals[userUID] = setInterval(() => {
                audioBars.forEach((bar, index) => {
                  // Define height ranges
                  const minHeight = 3; // Minimum height
                  const maxHeight = 12; // Maximum height

                  // Generate random height within the range
                  const randomHeight =
                    Math.floor(Math.random() * (maxHeight - minHeight + 1)) +
                    minHeight;

                  bar.style.height = `${randomHeight}px`;
                });
              }, 100); // Update every 100ms
            }
          } else {
            // User is not speaking

            // If we have an interval for this user, clear it
            if (speakingIntervals[userUID]) {
              clearInterval(speakingIntervals[userUID]);
              delete speakingIntervals[userUID];

              // Reset bars to minimum height
              audioBars.forEach((bar) => {
                bar.style.height = `5px`; // Reset to minimum height
              });
            }
          }
        }
      }

      // Only process and send notifications for the local user (currentUserUid)
      if (userUID === currentUserUid) {
        // Initialize lastMutedStatuses for the user if not already set
        if (!lastMutedStatuses[userUID]) {
          lastMutedStatuses[userUID] = "unknown"; // Default to "unknown" for first-time detection
          console.log(
            `Initialized lastMutedStatuses for UID ${userUID}: "unknown"`
          );
        }

        // Notify Bubble only when the status changes
        if (currentStatus !== lastMutedStatuses[userUID]) {
          console.log(
            `Sending to bubble: bubble_fn_systemmuted("${currentStatus}") for UID ${userUID}`
          );
          bubble_fn_systemmuted(currentStatus);
          lastMutedStatuses[userUID] = currentStatus; // Update the last status for this UID
        } else {
          console.log(
            `Status for UID ${userUID} remains unchanged (${currentStatus}), no notification sent.`
          );
        }
      }
    }
  };
})();

