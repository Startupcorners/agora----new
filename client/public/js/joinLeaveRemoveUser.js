import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { manageParticipants } from "./talkToBubble.js";
import { hostJoined } from "./setupEventListeners.js";
import { handleRaiseHandMessage } from "./uiHandlers.js";
import { getSharingScreenUid } from "./video.js";

export const handleUserJoined = async (user, userAttr = {}, config) => {
  console.log("User info:", user);
  console.log("User attributes:", userAttr);

  const userUid = user.uid.toString();
  console.log("Entering handleUserJoined function for user:", userUid);

  // Handle specific UIDs (2 triggers a special Bubble function)
  if (userUid === "2") {
    console.log("UID is 2. Triggering bubble_fn_waitingForAcceptance.");
    bubble_fn_isVideoRecording("yes");
    bubble_fn_waitingForAcceptance();
    return; // No further action needed for this UID
  }

  // Skip handling for special UIDs (UIDs > 999999999 or UID 2)
  if (parseInt(userUid) > 999999999) {
    console.log(`Skipping handling for special UID (${userUid}).`);
    return; // No further action needed for this UID
  }

  try {
    // Prevent handling your own stream
    if (userUid === config.uid.toString()) {
      console.log(`Skipping wrapper creation for own UID: ${userUid}`);
      return;
    }

    const role = userAttr.role || "audience";
    const roleInTheCall = userAttr.roleInTheCall || "waiting";
    console.log(`Role for user ${userUid}: ${role}`);
    console.log(`RoleInTheCall for user ${userUid}: ${roleInTheCall}`);

    if (["speaker", "host", "master"].includes(roleInTheCall)) {
      console.log(
        `User ${userUid} has role "${roleInTheCall}". Triggering hostJoined.`
      );
      if (typeof hostJoined === "function") {
        hostJoined();
      } else {
        console.warn("hostJoined function is not defined.");
      }
    }

    // Only proceed with wrapper if the user is a host and not in "waiting" or "audience"
    if (
      role === "host" &&
      roleInTheCall !== "waiting" &&
      roleInTheCall !== "audience"
    ) {
      console.log(
        `User ${userUid} is a host and not waiting. Checking video wrapper.`
      );
      let participantWrapper = document.querySelector(
        `#video-wrapper-${userUid}`
      );
      if (!participantWrapper) {
        console.log(
          `No wrapper found for user ${userUid}, creating a new one.`
        );
        const sharingScreenUid = getSharingScreenUid();
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

        console.log(`Wrapper successfully created for user ${userUid}.`);
      } else {
        console.log(`Wrapper already exists for user ${userUid}.`);
      }
    } else {
      console.log(
        `User ${userUid} does not meet criteria (host and not waiting). Skipping wrapper creation.`
      );
    }

    console.log(
      `Invoking manageParticipants for user ${userUid} with action "join".`
    );

    console.log("user attributes :", userAttr);

    
    // Ensure userUid is a number when calling manageParticipants
    await manageParticipants(parseInt(userUid), userAttr, "join");
    // Check if user is raising their hand and call handleRaiseHandMessage if yes
    const bubbleId = userAttr.bubbleid || userUid;
    const isRaisingHand = userAttr.isRaisingHand === "yes";
    if (isRaisingHand) {
      console.log(
        `User ${userUid} is raising their hand. Calling handleRaiseHandMessage.`
      );
      await handleRaiseHandMessage(bubbleId, true, config);
    }
  } catch (error) {
    console.error(`Error in handleUserJoined for user ${userUid}:`, error);
    try {
      console.log(
        `Calling manageParticipants with action "error" for user ${userUid}.`
      );
      manageParticipants(parseInt(userUid), userAttr, "error");
    } catch (participantError) {
      console.error(
        `Error managing participant state for user ${userUid}:`,
        participantError
      );
    }
  }
};



// Handles user left event
export const handleUserLeft = async (user, config) => {
  try {
    console.log("Entered handleUserLeft:", user);

    // Handle special cases
    if (user.uid > 999999999) {
      console.log(`Skipping handling for screen share UID: ${user.uid}`);
      return; // Skip handling for screen share UIDs
    }

    if (user.uid === 2) {
      console.log(
        `User ${user.uid} is a virtual participant, stopping recording.`
      );
      bubble_fn_isVideoRecording("no");
      return; // Stop further processing for virtual participant
    }

    // Remove the user's video wrapper and manage participants
    try {

        const userUid = user.uid.toString(); // Ensure UID is a string
        const fetchedAttributes = await config.clientRTM.getUserAttributes(
          userUid
        );
        console.log(
          `Fetched attributes for user ${userUid}:`,
          fetchedAttributes
        );

        // Notify Bubble about the user's leave action
        try {
          const participantId = fetchedAttributes.participantId;
          if (!participantId) {
            console.warn(
              `Participant ID missing for user ${userUid}. Skipping API call.`
            );
          } else {
            const bubbleResponse = await axios.post(
              "https://startupcorners.com/api/1.1/wf/participantEnterLeave",
              {
                participantId: participantId,
                action: "leave",
              }
            );
            console.log(
              "Participant enter/leave API response:",
              bubbleResponse.data
            );
          }
        } catch (apiError) {
          console.error("Error notifying participantEnterLeave API:", apiError);
        }
      console.log(`Removing UI elements for user ${user.uid}...`);

      const sharingScreenUid = getSharingScreenUid();
      if (sharingScreenUid === null) {
        console.log(
          "No screen sharing UID found, adding user without screen sharing."
        );
        await removeUserWrapper(user.uid, false);
      } else {
        console.log(
          `Screen sharing UID found (${sharingScreenUid}), adding user with screen sharing.`
        );
        await removeUserWrapper(user.uid, true);
      }

      console.log(`Updating participant list for user ${user.uid}...`);
      manageParticipants(user.uid, {}, "leave"); // Update participant management

      console.log(`User ${user.uid} successfully removed.`);
    } catch (uiError) {
      console.error(
        `Error removing UI elements for user ${user.uid}:`,
        uiError
      );
    }
  } catch (error) {
    console.error(`Error in handleUserLeft for user ${user?.uid}:`, error);
  }
};

