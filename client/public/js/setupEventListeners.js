// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
  manageUserPromise,
} from "./publishUnpublishHub.js";
import { handleUserJoined, handleUserLeft } from "./joinLeaveRemoveUser.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { fetchAndSendDeviceList, manageParticipants } from "./talkToBubble.js";
import { switchCam, switchSpeaker, handleCameraDeactivation, handleMicDeactivation, handleSpeakerDeactivation } from "./handleDevices.js";
import { handleRaiseHandMessage } from "./uiHandlers.js";
import { leave } from "./joinLeaveLocalUser.js";
import { onRoleChange } from "./roleChange.js";
import { toggleCamera, toggleScreenShare, getSharingScreenUid } from "./video.js";
import { toggleMic } from "./audio.js";
import { sendRTMMessage } from "./helperFunctions.js";

let lastMutedStatuses = {}; // External variable to track the mute status of users
let speakingIntervals = {}; // External variable to track speaking intervals for users
let lastMicPermissionState = null; // External variable to track the microphone permission state
let inactivityTimer;
let isTimerActive = false; // Tracks whether the inactivity timer is active
let stillPresentTimer;
const inactivityTimeout = 7200000; // 2 hours in milliseconds
const stillPresentTimeout = 60000; // 1 minute in milliseconds
let isTabActive = true; // Tracks if the tab is active
let noHostTimer;
const noHostTimeout = 300000; // 5 minutes in milliseconds
let override = false; // Default value for the override variable

export const setupEventListeners = (config) => {
  console.log("listenerConfig", config);
  const client = config.client;

  // Handle when a user publishes their media (audio/video)
  client.on("user-published", async (user, mediaType) => {
    console.log(
      `user-published event received for user: ${user.uid}, mediaType: ${mediaType}`
    );
    await handleUserPublished(user, mediaType, config);
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
  const userUid = user.uid.toString();

  // Check if a promise already exists
  let existingPromise = manageUserPromise(userUid, "get");
  if (existingPromise) {
    console.log(
      `A promise is already running for user: ${userUid}. Waiting...`
    );
    await existingPromise; // Wait for the existing promise to resolve
    console.log(`Existing promise for user ${userUid} completed.`);
    return; // Exit early since the user is already being processed
  }

  // Create a new promise for this user
  const userJoinPromise = (async () => {
    let userAttr = {}; // Initialize an empty object for user attributes

    if (config.clientRTM) {
      try {
        // Fetch attributes for the joining user
        const fetchedAttributes = await config.clientRTM.getUserAttributes(
          userUid
        );
        console.log(
          `Fetched attributes for user ${userUid}:`,
          fetchedAttributes
        );

        // Merge fetched attributes with defaults
        userAttr = {
          name: fetchedAttributes.name || "Unknown",
          avatar: fetchedAttributes.avatar || "default-avatar-url",
          company: fetchedAttributes.company || "Unknown",
          designation: fetchedAttributes.designation || "Unknown",
          role: fetchedAttributes.role || "audience",
          rtmUid: fetchedAttributes.rtmUid || userUid, // Default to user UID
          bubbleid: fetchedAttributes.bubbleid || "",
          speakerId: fetchedAttributes.speakerId,
          participantId: fetchedAttributes.participantId,
          isRaisingHand: fetchedAttributes.isRaisingHand || false,
          sharingScreenUid: fetchedAttributes.sharingScreenUid || "0",
          roleInTheCall: fetchedAttributes.roleInTheCall || "audience",
        };
      } catch (error) {
        console.error(`Failed to fetch attributes for user ${userUid}:`, error);

        // Default attributes if fetching fails
        userAttr = {
          name: "Unknown",
          avatar: "default-avatar-url",
          company: "Unknown",
          designation: "Unknown",
          role: "audience",
          rtmUid: userUid, // Default to user UID
          bubbleid: "",
          speakerId: "",
          participantId: "",
          isRaisingHand: false,
          sharingScreenUid: "0",
          roleInTheCall: "audience",
        };
      }
    } else {
      console.warn(
        `RTM client not initialized. Skipping attribute fetch for user ${userUid}.`
      );

      // Default attributes if RTM is unavailable
      userAttr = {
        name: "Unknown",
        avatar: "default-avatar-url",
        company: "Unknown",
        designation: "Unknown",
        role: "audience",
        rtmUid: userUid,
        bubbleid: "",
        isRaisingHand: false,
        sharingScreenUid: "0",
        roleInTheCall: "audience",
      };
    }

    try {
      // Process the user join logic
      await handleUserJoined(user, userAttr, config);
      console.log(`User ${userUid} handled successfully.`);
    } catch (error) {
      console.error(`Error handling user ${userUid}:`, error);
    }
  })();

  // Add the promise to the map
  manageUserPromise(userUid, "add", userJoinPromise);

  // Wait for the promise to complete
  await userJoinPromise;

  // Remove the promise from the map
  manageUserPromise(userUid, "remove");
  console.log(`Promise for user ${userUid} completed and removed.`);
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
      await handleMicDeactivation(info.device, config);
    }
  });

  AgoraRTC.on("playback-device-changed", async (info) => {
    console.log("Playback device (speaker) change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";

    if (action === "activated") {
      await switchSpeaker(info.device);
    } else if (action === "deactivated") {
      await handleSpeakerDeactivation(info.device, config);
    }
  });

  client.on("exception", (error) => {
    console.error("RTC Exception detected:", error);
    notifyErrorToChannel(error, config);
  });


  AgoraRTC.on("camera-changed", async (info) => {
    console.log("Camera device change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";

    if (action === "activated") {
      console.log("Camera activated:", info.device.label);
    } else if (action === "deactivated") {
      await handleCameraDeactivation(info.device, config);
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

   // Ignore messages sent by the current user
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

   const { type, userUid, newRole, newRoleInTheCall, userAttr, bubbleId, isRaisingHand } = parsedMessage;

// Switch-case to handle different message types
switch (type) {
  case "toggleHand":
    console.log(`Raise hand message received for user ${bubbleId}`);
    if (bubbleId !== undefined && typeof isRaisingHand === "boolean") {
      handleRaiseHandMessage(bubbleId, isRaisingHand, config);
    } else {
      console.warn("Invalid raiseHand message format.");
    }
    break;
  case "lowerHand":
    console.log(`Raise hand message received for user ${bubbleId}`);
    if (bubbleId !== undefined) {
      handleRaiseHandMessage(bubbleId, false, config);
    } else {
      console.warn("Invalid raiseHand message format.");
    }
    break;

  case "roleChange":
    console.log(`Role change message received for user ${userUid}`);
    if (newRoleInTheCall === "audience") {
      await removeUserWrapper(userUid);
    }
    if (userUid.toString() === config.user.rtmUid) {
      console.log("Role change is for the current user. Handling role change.");
      try {
        await onRoleChange(newRoleInTheCall, config);
      } catch (error) {
        console.error("Error handling role change:", error);
      }
    }
    break;

  case "userRoleUpdated":
    console.log(
      `UserRoleUpdated for user ${userUid}: role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
    );
    if (!userAttr) {
      console.warn(
        `No userAttr provided in userRoleUpdated message for user ${userUid}.`
      );
      return;
    }

    await manageParticipants(userUid, {}, "leave");
    await manageParticipants(userUid, userAttr, "join");

    const rolesRequiringWrapper = [
      "master",
      "host",
      "speaker",
      "meetingParticipant",
      "audienceOnStage",
    ];
    const sharingScreenUid = getSharingScreenUid();
    if (rolesRequiringWrapper.includes(newRoleInTheCall)) {
      console.log(
        `Role ${newRoleInTheCall} requires a video wrapper. Adding if necessary.`
      );

      
      if (sharingScreenUid === null) {
        console.log(
          "No screen sharing UID found, adding user without screen sharing."
        );
        await addUserWrapper(userUid, config, false);
      } else {
        console.log(
          `Screen sharing UID found (${sharingScreenUid}), adding user with screen sharing.`
        );
        await addUserWrapper(userUid, config, true);
      }
    } else {
      console.log(
        `Role ${newRoleInTheCall} does not require a video wrapper. Removing if exists.`
      );
      if (sharingScreenUid === null) {
        console.log(
          "No screen sharing UID found, adding user without screen sharing."
        );
        await removeUserWrapper(userUid, false);
      } else {
        console.log(
          `Screen sharing UID found (${sharingScreenUid}), adding user with screen sharing.`
        );
        await removeUserWrapper(userUid, true);
      }
    }
    break;

  case "stopCamera":
    console.log(`Stop camera message received for user ${userUid}`);
    if (userUid.toString() === config.user.rtmUid) {
      toggleCamera(config);
    }
    break;

  case "stopMic":
    console.log(`Stop mic message received for user ${userUid}`);
    if (userUid.toString() === config.user.rtmUid) {
      toggleMic(config);
    }
    break;

  case "stopScreenshare":
    console.log(`Stop screenshare message received for user ${userUid}`);
    if (userUid.toString() === config.user.rtmUid) {
      toggleScreenShare(config);
    }
    break;

  case "ERROR_NOTIFICATION":
    console.warn(
      `Error from user ${parsedMessage.user}: ${parsedMessage.message}`
    );
    break;

  case "log":
    console.warn(
      `Error from user ${parsedMessage.user}: ${parsedMessage.message}`
    );
    break;

  case "accessDenied":
    console.log(`Access denied message received for user ${userUid}`);
    if (userUid.toString() === config.user.rtmUid) {
      await leave("removed", config);
    }
    break;

  default:
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


export const setupLeaveListener = (config) => {
  // Listen for page unload events (close, reload, or navigating away)
  window.addEventListener("beforeunload", (event) => {
    const leaveReason = "left"; // You can customize the reason based on your needs
    leave(leaveReason, config);
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
      console.log(
        `UID: ${userUID}, Audio Level: ${audioLevel}, Override: ${override}`
      );

      // Determine the current status based on audio level, bypassing logic if override is true
      const currentStatus = override ? "no" : audioLevel < 3 ? "yes" : "no";

      // Reset the inactivity timer if the volume is above 30 and it's the local user
      if (userUID === currentUserUid && audioLevel > 30) {
        console.log(
          `Audio level above 30 detected for local user ${userUID}. Resetting inactivity timer.`
        );
        resetInactivityTimer(config);
      }

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

        // Notify Bubble only when the status changes and override is false
        if (
          !override &&
          currentStatus !== lastMutedStatuses[userUID] &&
          userUID === config.uid
        ) {
          console.log(
            `Sending to bubble: bubble_fn_systemmuted("${currentStatus}") for UID ${userUID}`
          );
          bubble_fn_systemmuted(currentStatus);
          lastMutedStatuses[userUID] = currentStatus; // Update the last status for this UID
        } else {
          console.log(
            `Status for UID ${userUID} remains unchanged (${currentStatus}), or override is active, no notification sent.`
          );
        }
      }
    }
  };
})();






// Function to reset the inactivity timer
const resetInactivityTimer = (config) => {
  if (!isTabActive) {
    console.log("Tab is inactive. Inactivity timer will not reset.");
    return; // Do not reset the timer if the tab is inactive
  }

  // Prevent resetting the timer if it has already expired
  if (!isTimerActive) {
    console.log("Inactivity timer has already expired. No reset allowed.");
    return;
  }

  clearTimeout(inactivityTimer);
  console.log("User activity detected. Resetting inactivity timer.");

  isTimerActive = true; // Mark the timer as active
  inactivityTimer = setTimeout(() => {
    console.log("User inactive for 5 minutes. Displaying inactivity message.");
    isTimerActive = false; // Mark the timer as expired

    if (typeof bubble_fn_inactive === "function") {
      bubble_fn_inactive(); // Show the inactivity message
      waitForStillPresentOrLeave(config); // Start waiting for user response
    } else {
      console.warn("bubble_fn_inactive is not defined.");
    }
  }, inactivityTimeout);
};

// Function to handle the user response timeout
const waitForStillPresentOrLeave = (config) => {
  clearTimeout(stillPresentTimer); // Clear any existing stillPresentTimer

  stillPresentTimer = setTimeout(() => {
    console.log(
      "User did not respond within 1 minute. Calling leave('inactive', config)."
    );
    if (typeof leave === "function") {
      leave("inactive", config); // Trigger leave with "inactive" reason
    } else {
      console.warn("leave is not defined.");
    }
  }, stillPresentTimeout);
};

// Function to be called by the user when they confirm presence
export const stillPresent = (config) => {
  console.log("User confirmed presence. Resetting inactivity timer.");
  clearTimeout(stillPresentTimer); // Stop the leave timer
  isTimerActive = true; // Reactivate the timer after confirmation
  resetInactivityTimer(config); // Reset the inactivity timer
};

// Listener for user activity
const addUserActivityListeners = (config) => {
  document.addEventListener("mousemove", () => resetInactivityTimer(config));
  document.addEventListener("keydown", () => resetInactivityTimer(config));
  document.addEventListener("click", () => resetInactivityTimer(config));
  document.addEventListener("scroll", () => resetInactivityTimer(config)); // Optional for scroll activity
};

// Listener for tab visibility
const handleVisibilityChange = (config) => {
  if (document.hidden) {
    console.log("Tab is inactive. Pausing inactivity detection.");
    isTabActive = false;
  } else {
    console.log("Tab is active. Resuming inactivity detection.");
    isTabActive = true;
    resetInactivityTimer(config); // Reset the timer when the tab becomes active
  }
};

// Initialize listeners
export const initializeInactivityTracker = (config) => {
  console.log("Initializing enhanced inactivity tracker...");
  isTimerActive = true; // Ensure timer starts as active
  addUserActivityListeners(config);
  document.addEventListener("visibilitychange", () =>
    handleVisibilityChange(config)
  );
  resetInactivityTimer(config); // Start the timer initially
};




// Function to be triggered when no host is detected
export const noHosts = (config) => {
  console.log("No hosts detected. Starting 5-minute timer.");

  // Clear any existing noHostTimer
  clearTimeout(noHostTimer);

  // Start the 5-minute timer
  noHostTimer = setTimeout(() => {
    console.log("No host joined within 5 minutes. Leaving the session.");
    if (typeof leave === "function") {
      leave("nohost", config); // Trigger leave with "nohost" reason
    } else {
      console.warn("leave function is not defined.");
    }
  }, noHostTimeout);
};

// Function to be triggered when a host joins
export const hostJoined = () => {
  console.log("A host has joined. Clearing the no-host timer.");

  // Clear the no-host timer
  clearTimeout(noHostTimer);

  // Trigger Bubble function to indicate the host has joined
  if (typeof bubble_fn_hostJoined === "function") {
    bubble_fn_hostJoined(); // Notify Bubble that a host has joined
  } else {
    console.warn("bubble_fn_hostJoined is not defined.");
  }
};


const notifyErrorToChannel = async (error, config) => {
  const errorMessage = {
    type: "ERROR_NOTIFICATION",
    message: error.message || "An unknown error occurred.",
    details: error.details || null,
    user: config.uid, // Include the UID of the user reporting the error
    timestamp: Date.now(),
  };

  try {
    // Use the existing function to send the RTM message
    await sendRTMMessage(JSON.stringify(errorMessage), config);
    console.log("Error notification sent:", errorMessage);
  } catch (sendError) {
    console.error("Failed to send error notification via RTM:", sendError);
  }
};




/**
 * Toggles the state of the override variable and handles the reset logic.
 */
export function toggleOverride(config) {
  override = !override; // Toggle the boolean value

  if (override) {
    console.log("Override enabled. Resetting mute status for local user.");

    const currentUserUid = config.uid; // Get the current user's UID
    lastMutedStatuses[currentUserUid] = "no"; // Reset mute status to "no"

    // Notify Bubble about the reset
    if (typeof bubble_fn_systemmuted === "function") {
      console.log(
        `Sending to Bubble: bubble_fn_systemmuted("no") for UID ${currentUserUid}`
      );
      bubble_fn_systemmuted("no");
    }
  } else {
    console.log("Override disabled. Normal mute detection logic will resume.");
  }

  console.log(`Override is now: ${override ? "enabled" : "disabled"}`);
}

// Add an event listener to the window's resize event
window.addEventListener("resize", () => {
    editClasses(); // Trigger layout adjustment on resize
});

// Function to edit classes for different layouts
export const editClasses = async () => {
  const videoStage = document.getElementById("video-stage");
  const mainContainer = document.getElementById("main-container");
  const sharingScreenUid = getSharingScreenUid(); // Check screen sharing status

  // Check for missing elements individually
  if (!videoStage) {
    console.error("Missing element: 'video-stage' not found in the DOM.");
  }
  if (!mainContainer) {
    console.error("Missing element: 'main-container' not found in the DOM.");
  }

  // If any required element is missing, exit early
  if (!videoStage || !mainContainer) {
    console.error(
      "Required elements are missing. Cannot proceed with layout adjustments."
    );
    return;
  }

  // Check if screen sharing is active
  if (sharingScreenUid === null) {
    console.warn(
      "Screen sharing is not active. No layout changes will be applied."
    );
    videoStage.classList.remove("video-stage-screenshare");
    videoStage.classList.remove("video-stage-screenshare-below");
    videoStage.classList.add("video-stage");
    mainContainer.classList.remove("main-container-below");
    mainContainer.classList.add("main-container-left");
    
    return; // Exit early if screen sharing is inactive
  }
  console.warn("sharingScreenUid is:", sharingScreenUid);

  // Determine the layout based on the width of the left container
  const width = mainContainer.getBoundingClientRect().width;
  const layout = width < 600 ? "below" : "left";

  // Simulate an asynchronous operation if needed (e.g., animation, API call)
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Apply the appropriate classes based on the layout
  if (layout === "below") {
    console.log("Switching to below layout.");
    videoStage.classList.remove("video-stage");
    videoStage.classList.remove("video-stage-screenshare");
    videoStage.classList.add("video-stage-screenshare-below");
    mainContainer.classList.remove("main-container-left");
    mainContainer.classList.add("main-container-below");
  } else {
    console.log("Switching to left layout.");
    videoStage.classList.remove("video-stage");
    videoStage.classList.remove("video-stage-screenshare-below");
    videoStage.classList.add("video-stage-screenshare");
    mainContainer.classList.remove("main-container-below");
    mainContainer.classList.add("main-container-left");
  }
};

