import { sendRTMMessage } from "./helperFunctions.js";
import { manageParticipants } from "./talkToBubble.js";


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







export const raiseHand = async (userUids, config) => {
  console.log(`Processing raise hand action for users: ${userUids.join(", ")}`);

  for (const userUid of userUids) {
    try {
      // Check if the user is already in the list
      const isRaisingHand = usersRaisingHand.includes(userUid);

      // Update the `usersRaisingHand` list
      if (!isRaisingHand) {
        // Add the user to the list if not present
        usersRaisingHand.push(userUid);
        console.log(`User ${userUid} added to raising hand list.`);
      } else {
        // Remove the user from the list if already present
        usersRaisingHand = usersRaisingHand.filter((uid) => uid !== userUid);
        console.log(`User ${userUid} removed from raising hand list.`);
      }

      // Prepare the message payload for raising hand
      const message = JSON.stringify({
        type: "raiseHand",
        userUid: userUid,
      });

      // Use the helper function to send the RTM message
      await sendRTMMessage(message, config);

      console.log(`Raise hand action processed for user ${userUid}.`);
    } catch (error) {
      console.error(
        `Error processing raise hand action for user ${userUid}:`,
        error
      );
    }
  }

  // Update the list of users raising hands in the UI
  bubble_fn_usersRaisingHand(usersRaisingHand);

  console.log(`Raise hand actions completed for users: ${userUids.join(", ")}`);
};



export const handleRaisingHand = async (userUid) => {
  // Check if the user is already in the list
  if (usersRaisingHand.includes(userUid)) {
    // Remove the user if they are already in the list
    usersRaisingHand = usersRaisingHand.filter((uid) => uid !== userUid);
    console.log(`User ${userUid} removed from raising hand list.`);
  } else {
    // Add the user if they are not in the list
    usersRaisingHand.push(userUid);
    console.log(`User ${userUid} added to raising hand list.`);
  }

  console.log("usersRaisingHand:", usersRaisingHand);

  // Update Bubble with the new list of users raising their hand
  bubble_fn_usersRaisingHand(usersRaisingHand);
};
