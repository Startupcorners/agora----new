import { updatePublishingList, manageParticipants } from "./talkToBubble.js";
import { joinVideoStage, leaveVideoStage } from "./joinleavestage.js";
import { sendRTMMessage } from "./helperFunctions.js";

const handleRoleChange = async (newRoleInTheCall) => {
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

  // Handle unmuting if transitioning from waiting
  if (prevRole === "waiting" && newRoleInTheCall !== "waiting") {
    console.log("Unmuting audio tracks for existing users...");

    for (const remoteUser of client.remoteUsers) {
      const audioTrack = remoteUser.audioTrack;

      if (audioTrack && audioTrack.muted) {
        try {
          console.log(`Unmuting audio track for user ${remoteUser.uid}...`);
          audioTrack.setEnabled(true);
          console.log(`Audio track for user ${remoteUser.uid} unmuted.`);

          // Update mic status dynamically
          const micStatusElement = document.getElementById(
            `mic-status-${remoteUser.uid}`
          );
          if (micStatusElement) {
            micStatusElement.classList.add("hidden"); // Show unmuted icon
            console.log(`Updated mic status for user ${remoteUser.uid}`);
          } else {
            console.warn(
              `Mic status element not found for user ${remoteUser.uid}`
            );
          }
        } catch (error) {
          console.error(
            `Error unmuting audio for user ${remoteUser.uid}:`,
            error
          );
        }
      } else {
        console.log(
          `No valid or already unmuted audio track for user ${remoteUser.uid}.`
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
};





export const onRoleChange = async (newRoleInTheCall) => {
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
    await manageParticipants(config.uid, {}, "leave");
  }

  // Update participant list for the new role
  console.log(
    `Calling manageParticipants for user ${config.uid} with new role: ${newRoleInTheCall}`
  );
  await manageParticipants(config.uid, attributes, "join");

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

};

