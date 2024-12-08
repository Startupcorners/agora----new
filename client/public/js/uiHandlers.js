import { sendRTMMessage } from "./helperFunctions.js";
import { manageParticipants } from "./talkToBubble.js";
import {removeUserWrapper} from "./wrappers.js"
import {onRoleChange} from "./roleChange.js"


let usersRaisingHand = []; // External variable to track users raising their hands

export const changeUserRole = async (
  userUids,
  newRole,
  newRoleInTheCall,
  config
) => {
  console.log(
    `Changing roles for users ${userUids.join(
      ", "
    )} to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
  );

  // Iterate through the list of user UIDs
  for (const userUid of userUids) {
    try {
      // Manage the participant by removing their existing role
      console.log(`Managing participant for user ${userUid}...`);
      await manageParticipants(userUid, {}, "leave");

      // Prepare the message for the role change
      const message = JSON.stringify({
        type: "roleChange",
        userUid: userUid,
        newRole: newRole,
        newRoleInTheCall: newRoleInTheCall,
      });

      // Use the helper function to send the RTM message
      console.log(`Sending role change message for user ${userUid}...`);
      await sendRTMMessage(message, config);

      console.log(
        `Role for user ${userUid} successfully changed to role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
      );
    } catch (error) {
      console.error(`Error changing role for user ${userUid}:`, error);
    }
  }

  console.log(`Roles successfully changed for all specified users.`);
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

export const stopUserCamera = async (userUids, config) => {
  console.log(`Sending stop camera messages for users: ${userUids.join(", ")}`);

  for (const userUid of userUids) {
    // Skip the current user's UID
    if (userUid === config.uid.toString()) {
      console.log(`Skipping stop camera for the current user UID: ${userUid}`);
      continue;
    }

    try {
      // Prepare the stop camera message for the current user
      const message = JSON.stringify({
        type: "stopCamera",
        userUid: userUid,
      });

      // Use the helper function to send the RTM message
      console.log(`Sending stop camera message for user ${userUid}...`);
      await sendRTMMessage(message, config);

      console.log(`Stop camera request for user ${userUid} completed.`);
    } catch (error) {
      console.error(
        `Error sending stop camera message for user ${userUid}:`,
        error
      );
    }
  }

  console.log(
    `Stop camera requests completed for users: ${userUids.join(", ")}`
  );
};




export const stopUserMic = async (userUids, config) => {
  console.log(`Sending stop mic messages for users: ${userUids.join(", ")}`);

  for (const userUid of userUids) {
    // Skip the current user's UID
    if (userUid === config.uid.toString()) {
      console.log(`Skipping stop mic for the current user UID: ${userUid}`);
      continue;
    }

    try {
      // Prepare the stop mic message
      const message = JSON.stringify({
        type: "stopMic",
        userUid: userUid,
      });

      // Use the helper function to send the RTM message
      console.log(`Sending stop mic message for user ${userUid}...`);
      await sendRTMMessage(message, config);

      console.log(`Stop mic request for user ${userUid} completed.`);
    } catch (error) {
      console.error(
        `Error sending stop mic message for user ${userUid}:`,
        error
      );
    }
  }

  console.log(`Stop mic requests completed for users: ${userUids.join(", ")}`);
};




export const denyAccess = async (userUid, config) => {
  console.log(`Denying access for user ${userUid}`);

  // Prepare the access denied message
  const message = JSON.stringify({
    type: "accessDenied",
    userUid: userUid,
  });

  // Use the helper function to send the RTM message
  await sendRTMMessage(message, config);

  console.log(`Deny access request for user ${userUid} completed.`);
};


export const stopUserScreenshare = async (userUid, config) => {
  console.log(`Sending stop screenshare message for user ${userUid}`);

  // Prepare the stop screenshare message
  const message = JSON.stringify({
    type: "stopScreenshare",
    userUid: userUid,
  });

  // Use the helper function to send the RTM message
  await sendRTMMessage(message, config);

  console.log(`Stop screenshare request for user ${userUid} completed.`);
};







// Function to toggle the local user's hand-raising status
export const toggleHand = async (bubbleId, config) => {
  try {
    const isCurrentlyRaisingHand = usersRaisingHand.includes(bubbleId);
    const newIsRaisingHand = !isCurrentlyRaisingHand;

    // Update the local usersRaisingHand list
    if (newIsRaisingHand) {
      usersRaisingHand.push(bubbleId);
      console.log(`User ${bubbleId} raised their hand.`);
    } else {
      usersRaisingHand = usersRaisingHand.filter((uid) => uid !== bubbleId);
      console.log(`User ${bubbleId} lowered their hand.`);
    }

    // Update the UI
    bubble_fn_usersRaisingHand(usersRaisingHand);

    // Update the RTM attribute 'isRaisingHand' for the local user
    if (config.clientRTM) {
      config.clientRTM.addOrUpdateLocalUserAttributes({
        isRaisingHand: newIsRaisingHand ? "yes" : "no",
      });
      console.log(
        `RTM attribute 'isRaisingHand' updated for local user ${bubbleId}.`
      );
    } else {
      console.warn('RTM client is not available in the config.');
    }

    // Prepare the message payload
    const message = JSON.stringify({
      type: 'toggleHand',
      bubbleId: bubbleId,
      isRaisingHand: newIsRaisingHand,
    });

    // Send the message to the channel
    await sendRTMMessage(message, config);

    console.log(`Toggle hand action processed for user ${bubbleId}.`);
  } catch (error) {
    console.error(`Error toggling hand for user ${bubbleId}:`, error);
  }
};



// Combined function to handle hand raise/lower messages
export const handleRaiseHandMessage = async (bubbleId, isRaisingHand, config) => {
  if (isRaisingHand) {
    if (!usersRaisingHand.includes(bubbleId)) {
      usersRaisingHand.push(bubbleId);
      console.log(`User ${bubbleId} added to raising hand list.`);
    }
  } else {
    usersRaisingHand = usersRaisingHand.filter((uid) => uid !== bubbleId);
    console.log(`User ${bubbleId} removed from raising hand list.`);
    if (bubbleId === config.user.bubbleid) {
      if (config.clientRTM) {
        config.clientRTM.addOrUpdateLocalUserAttributes({
          isRaisingHand: "no",
        });
        console.log(
          `Local user ${bubbleId} updated isRaisingHand attribute to 'no'.`
        );
      } else {
        console.warn("RTM client is not available in the config.");
      }
    }
  }

  bubble_fn_usersRaisingHand(usersRaisingHand);
};



// Function to lower another user's hand
export const lowerHand = async (targetBubbleId, config) => {
  try {
    // Prepare the message payload
    const message = JSON.stringify({
      type: 'lowerHand',
      bubbleId: targetBubbleId,
    });

    // Send the message to the channel
    await sendRTMMessage(message, config);

    console.log(`Lower hand message sent for user ${targetBubbleId}.`);

    // Remove the user from the local usersRaisingHand list
    usersRaisingHand = usersRaisingHand.filter((uid) => uid !== targetBubbleId);

    // Update the UI
    bubble_fn_usersRaisingHand(usersRaisingHand);
  } catch (error) {
    console.error(`Error lowering hand for user ${targetBubbleId}:`, error);
  }
};

export const triggerLeaveStage = async (config) => {
  try {
    if (!config || !config.user || !config.user.rtmUid) {
      throw new Error("Invalid configuration or missing user UID.");
    }
    const userUid = config.user.rtmUid;
    await changeUserRole([userUid], "host", "audience", config);
    await removeUserWrapper(userUid);
    await onRoleChange("audience", config);
  } catch (error) {
    console.error("Error during leaveStage process:", error);
  }
};

