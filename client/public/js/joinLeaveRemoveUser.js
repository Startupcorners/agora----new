import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { manageParticipants } from "./talkToBubble.js";

export const handleUserJoined = async (user, userAttr = {}) => {
  console.log("User info:", user);
  console.log("User attributes:", userAttr);
  const userUid = user.uid.toString();
  console.log("Entering handleUserJoined function for user:", userUid);

  // Handle specific UIDs (2 triggers a special Bubble function)
  if (userUid === "2") {
    console.log("UID is 2. Triggering bubble_fn_waitingForAcceptance.");
    bubble_fn_isVideoRecording("yes");
    bubble_fn_waitingForAcceptance();
  }

  // Skip handling for special UIDs (UIDs > 999999999 or UID 2)
  if (parseInt(userUid) > 999999999 || userUid === "2") {
    console.log(`Skipping handling for special UID (${userUid}).`);
    userJoinPromise = Promise.resolve(); // Assign a resolved promise to the global variable
    console.log(`Promise for UID ${userUid} resolved and skipped.`);
    return userJoinPromise; // Return the resolved promise
  }

  // If a promise for this user already exists, return it
  if (userJoinPromise) {
    console.log(`User join already in progress for UID: ${userUid}`);
    return userJoinPromise; // Return the existing promise
  }

  // Create a new promise for this user
  userJoinPromise = new Promise(async (resolve, reject) => {
    try {
      console.log(`Starting promise for user ${userUid}.`);

      // Prevent handling your own stream
      if (userUid === config.uid.toString()) {
        console.log(`Skipping wrapper creation for own UID: ${userUid}`);
        resolve();
        return;
      }

      // Log the role and roleInTheCall for clarity
      const role = userAttr.role || "audience";
      const roleInTheCall = userAttr.roleInTheCall || "waiting";
      console.log(`Role for user ${userUid}: ${role}`);
      console.log(`RoleInTheCall for user ${userUid}: ${roleInTheCall}`);

      // Only proceed with wrapper if the user is a host and not in the "waiting" state
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
          await addUserWrapper(userUid, config);
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
      // Ensure userUid is a number when calling manageParticipants
      manageParticipants(parseInt(userUid), userAttr, "join");

      console.log(`Promise resolved for user ${userUid}.`);
      resolve();
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
      reject(error);
    }
  });

  console.log(`Returning promise for user ${userUid}.`);
  return userJoinPromise; // Return the global promise variable
};

// Handles user left event
export const handleUserLeft = async (user) => {
  console.log("Entered handleUserLeft:", user);

  try {
    console.log(`User ${user.uid} left`);

    // Skip handling for screen share UID (RTC UID > 999999999)
    if (user.uid > 999999999) {
      console.log(`Skipping handling for screen share UID: ${user.uid}`);
      return;
    }

    if (user.uid === 2) {
      console.log(
        `User ${user.uid} is a virtual participant, stopping recording.`
      );
      bubble_fn_isVideoRecording("no");
      return;
    }

    // Remove the user's wrapper (video element and UI components)
    await removeUserWrapper(user.uid);

    // Remove the user's tracks from the config
    if (config.userTracks && config.userTracks[user.uid]) {
      delete config.userTracks[user.uid];
      console.log(`Removed tracks for user ${user.uid}`);
    } else {
      console.log(`No tracks found for user ${user.uid}`);
    }

    // Call manageParticipants with the user's UID and action "leave"
    manageParticipants(user.uid, {}, "leave");

    console.log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
};
