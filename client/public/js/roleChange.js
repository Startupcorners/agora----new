import { getConfig, updateConfig } from "./config.js";
import {sendRTMMessage } from "./helperFunctions.js";
import { manageParticipants } from "./rtcEventHandlers.js";
import { joinVideoStage, leaveVideoStage } from "./joinleavestage.js";


const handleRoleChange = async (newRoleInTheCall, config) => {
  console.warn(
    "handleRoleChange called with newRoleInTheCall:",
    newRoleInTheCall
  );

  const rolesRequiringStage = [
    "master",
    "host",
    "speaker",
    "meetingParticipant",
    "audienceOnStage",
  ];

  // Store previous role and check if it requires stage
  const prevRole = config.previousRoleInTheCall;
  config.previousRoleInTheCall = newRoleInTheCall; // Update previous role
  const prevRequiresStage = rolesRequiringStage.includes(prevRole);
  const newRequiresStage = rolesRequiringStage.includes(newRoleInTheCall);

  console.log("Previous role:", prevRole);
  console.log("New role:", newRoleInTheCall);
  console.log("prevRequiresStage:", prevRequiresStage);
  console.log("newRequiresStage:", newRequiresStage);

  // Subscribe to audio tracks for existing users if transitioning from waiting
  if (prevRole === "waiting" && newRoleInTheCall !== "waiting") {
    console.log("Subscribing to audio tracks for existing users...");
    console.log("Current config.userTracks:", config.userTracks);

    // Iterate over all userTracks
    for (const userUid in config.userTracks) {
      // Skip if the user is subscribing to their own track
      if (userUid === config.uid) {
        console.log(`Skipping subscription for user ${userUid} (own track).`);
        continue;
      }

      const user = config.userTracks[userUid];

      if (user && user.audioTrack) {
        console.log(`Found audio track for user ${userUid}:`, user.audioTrack);

        if (!user.audioTrack.isPlaying) {
          try {
            console.log(
              `Attempting to subscribe to audio track for user ${userUid}...`
            );
            await config.client.subscribe(user, "audio");
            user.audioTrack.play();

            console.log(
              `Successfully subscribed and playing audio for user ${userUid}.`
            );

            // Update mic status dynamically
            const micStatusElement = document.getElementById(
              `mic-status-${userUid}`
            );
            if (micStatusElement) {
              micStatusElement.classList.add("hidden"); // Show unmuted icon
              console.log(`Updated mic status for user ${userUid}`);
            } else {
              console.warn(`Mic status element not found for user ${userUid}`);
            }

            // Update publishing list
            updatePublishingList(userUid.toString(), "audio", "add", config);
          } catch (error) {
            console.error(
              `Error subscribing to audio for user ${userUid}:`,
              error
            );
          }
        } else {
          console.log(
            `User ${userUid}'s audio track is already playing. Skipping subscription.`
          );
        }
      } else {
        console.log(
          `User ${userUid} does not have a valid audio track. Skipping.`
        );
      }
    }
  }

  // Handle video stage join/leave
  if (!prevRequiresStage && newRequiresStage && !config.isOnStage) {
    console.log("Joining video stage...");
    await joinVideoStage(config);
  } else if (prevRequiresStage && !newRequiresStage && config.isOnStage) {
    console.log("Leaving video stage...");
    await leaveVideoStage(config);
  }

  // Update the config after role change
  updateConfig(config); // Ensure the updated config is saved
};



export const onRoleChange = async (newRoleInTheCall) => {
  let config = getConfig();
  console.warn("onRoleChange called with newRoleInTheCall:", newRoleInTheCall);
  console.warn("config", config);


  // Retrieve the previous role for cleanup
  const previousRoleInTheCall = config.user.roleInTheCall;

  // Update the user's role in config
  config.user.roleInTheCall = newRoleInTheCall;
  console.warn("bubble_fn_role:", config.user.roleInTheCall);
  bubble_fn_role(config.user.roleInTheCall);

  // Update the user's attributes in RTM
  const attributes = {
    name: config.user.name || "Unknown",
    avatar: config.user.avatar || "default-avatar-url",
    company: config.user.company || "Unknown",
    designation: config.user.designation || "Unknown",
    role: config.user.role || "audience",
    rtmUid: config.uid.toString(),
    bubbleid: config.user.bubbleid,
    isRaisingHand: config.user.isRaisingHand,
    sharingScreenUid: "0",
    roleInTheCall: newRoleInTheCall || "audience",
  };

  // Update local user attributes in RTM
  if (
    config.clientRTM &&
    typeof config.clientRTM.setLocalUserAttributes === "function"
  ) {
    await config.clientRTM.setLocalUserAttributes(attributes);
    console.log("Local RTM user attributes updated:", attributes);
  } else {
    console.warn(
      "RTM client or setLocalUserAttributes method is not available."
    );
  }

  // Handle role change (e.g., join/leave RTC, update UI)
  await handleRoleChange(newRoleInTheCall, config);

  // Call manageParticipants to remove the user from the previous role
  if (previousRoleInTheCall && previousRoleInTheCall !== newRoleInTheCall) {
    console.log(
      `Calling manageParticipants to remove user ${config.uid} from previous role: ${previousRoleInTheCall}`
    );
    await manageParticipants(config, config.uid, {}, "leave");
  }

  // Update participant list for the new role
  console.log(
    `Calling manageParticipants for user ${config.uid} with new role: ${newRoleInTheCall}`
  );
  await manageParticipants(config, config.uid, attributes, "join");

  // Send a message to inform other users about the role change
  const roleUpdateMessage = {
    type: "userRoleUpdated",
    userUid: config.uid.toString(),
    newRole: config.user.role,
    newRoleInTheCall: newRoleInTheCall,
    userAttr: attributes, // Include the user attributes
  };

  // Use sendRTMMessage helper to send the message
  await sendRTMMessage(JSON.stringify(roleUpdateMessage));

  console.log("Sent userRoleUpdated message to RTM channel.");

  // Update the config to reflect the new role changes
  updateConfig(config);
};

