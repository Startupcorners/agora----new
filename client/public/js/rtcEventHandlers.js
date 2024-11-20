// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import {
  manageCameraState,
  toggleStages,
} from "./videoHandlers.js";
import { userTracks } from "./state.js"; 
const userJoinPromises = {};

let participantList = [];

// Handles user published event
export const handleUserPublished = async (user, mediaType, config, client) => {
  const userUid = user.uid.toString();
  console.log(
    `handleUserPublished for user: ${userUid}, mediaType: ${mediaType}`
  );

  // Skip subscribing to local user's own media
  if (userUid === config.uid.toString()) {
    console.log("Skipping subscription to local user's own media.");
    return;
  }

  // Skip processing for UID 2
  if (userUid === "2") {
    console.log("Skipping processing for UID 2.");
    return;
  }

  // Handle screen share client (UID 1)
  if (userUid === "1") {
    console.log(`User with UID 1 (screen share client) published.`);

    try {
      // Fetch attributes for UID 1 to check who is sharing
      const attributes = await config.clientRTM.getUserAttributes("1");
      const sharingUserUid = attributes.sharingUserUid;

      if (!sharingUserUid) {
        console.warn(
          "No sharingUserUid found in attributes. Skipping processing."
        );
        return;
      }

      // If the sharingUserUid matches the local user's UID, skip processing
      if (sharingUserUid === config.uid.toString()) {
        console.log(
          "Screen share is from the local user. Skipping processing."
        );
        return;
      }

      console.log(`Screen share is from remote user: ${sharingUserUid}`);

      // Update the avatar for the PiP view
      const avatarElement = document.getElementById("pip-avatar");
      if (avatarElement) {
        avatarElement.src = attributes.avatar || "default-avatar.png";
        console.log(
          `Updated PiP avatar to ${attributes.avatar || "default-avatar.png"}.`
        );
      } else {
        console.warn("Could not find the PiP avatar element to update.");
      }

      // Subscribe to the screen share track
      await client.subscribe(user, mediaType);

      // Store the screen share track
      if (!userTracks[1]) {
        userTracks[1] = {};
      }
      userTracks[1].screenShareTrack = user.videoTrack;

      // Toggle the stage to screen share
      toggleStages(true, sharingUserUid);

      // Check if the user has a video track before managing the camera state
      if (user.videoTrack) {
        manageCameraState("play", user.videoTrack, `#stream-${sharingUserUid}`);
        manageCameraState("play", user.videoTrack, "#screen-share-video");
      } else {
        manageCameraState("stop", user.videoTrack, "#screen-share-video");
        console.warn(
          `User ${sharingUserUid} does not have a video track. Skipping manageCameraState.`
        );
      }

      return;
    } catch (error) {
      console.error(`Error fetching attributes for UID 1:`, error);
    }
  }

  // **Wait for handleUserJoined to complete before proceeding**
  if (userJoinPromises[userUid]) {
    console.log(`Waiting for handleUserJoined to complete for user ${userUid}`);
    await userJoinPromises[userUid]; // Wait for the promise to resolve
  }

  // Proceed with subscribing to the user's media
  if (!userTracks[userUid]) {
    userTracks[userUid] = {};
  }

  try {
    await client.subscribe(user, mediaType);
    console.log(`Subscribed to ${mediaType} track for user ${userUid}`);

    if (mediaType === "video") {
      userTracks[userUid].videoTrack = user.videoTrack;

      manageCameraState("play", user.videoTrack, `#stream-${userUid}`);
    } else if (mediaType === "audio") {
      userTracks[userUid].audioTrack = user.audioTrack;

      // Play audio track
      user.audioTrack.play();
      console.log(`Playing audio track for user ${userUid}.`);
    }
  } catch (error) {
    console.error(`Error subscribing to user ${userUid}:`, error);
  }
};





export const handleUserUnpublished = async (user, mediaType, config) => {
  console.log(
    `handleUserUnpublished called for user: ${user.uid}, mediaType: ${mediaType}`
  );

  // Skip handling for local user's own media (excluding screen share client)
  if (user.uid === config.uid && user.uid !== 1) {
    console.log("Skipping handling of local user's own media.");
    return;
  }

  if (user.uid == 2) {
    console.log("Skipping handling virtual participant.");
    return;
  }

  // Handle video unpublishing (including screen share)
  if (mediaType === "video") {
    // If the unpublished video is the screen share (UID 1)
    if (user.uid === 1) {
      console.log(`Screen share track unpublished from user with UID 1.`);

      // Use the stored sharingUserUid
      const sharingUserUid = config.currentScreenSharingUserUid;

      if (sharingUserUid) {
        console.log(`Screen share was from user: ${sharingUserUid}`);

        // Update UI accordingly
        config.currentScreenSharingUserUid = null;
        manageCameraState(sharingUserUid, config);
        toggleStages(false, sharingUserUid); // Hide screen share stage

        // Remove the screen share track from userTracks
        if (userTracks[1]) {
          if (userTracks[1].screenShareTrack) {
            userTracks[1].screenShareTrack.stop();
            userTracks[1].screenShareTrack.close();
            userTracks[1].screenShareTrack = null;
            console.log("Screen share track stopped and removed.");
          }
        }
      } else {
        console.error(
          "Could not determine who was sharing the screen. 'currentScreenSharingUserUid' is not set."
        );
      }
    } else {
      // For other users, handle unpublishing of their video track
      console.log(`User ${user.uid} has unpublished their video track.`);

      // Remove the video track from userTracks
      if (userTracks[user.uid] && userTracks[user.uid].videoTrack) {
        userTracks[user.uid].videoTrack.stop();
        userTracks[user.uid].videoTrack.close();
        userTracks[user.uid].videoTrack = null;
        console.log(`Removed video track for user ${user.uid}`);
      }

      // Update UI accordingly
      manageCameraState(user.uid, config);
    }
  }

  // Handle audio unpublishing
  if (mediaType === "audio") {
    console.log(`User ${user.uid} has unpublished their audio track.`);

    // Remove the audio track from userTracks
    if (userTracks[user.uid] && userTracks[user.uid].audioTrack) {
      userTracks[user.uid].audioTrack.stop();
      userTracks[user.uid].audioTrack = null;
      console.log(`Removed audio track for user ${user.uid}`);
    }

    // Optionally update UI for audio status, like muting mic icons
    toggleMicIcon(user.uid, true); // Show muted mic icon

    // Set the wrapper border to transparent if found
    const wrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (wrapper) {
      wrapper.style.borderColor = "transparent"; // Transparent when audio is unpublished
      console.log(`Set border to transparent for user ${user.uid}`);
    }
  }
};


export const manageParticipants = async (userUid, userAttr, actionType) => {
  console.log(
    `Managing participant list for user ${userUid} with action ${actionType}`
  );
  updateLayout();

  // Log the participant list before update
  console.log(
    "Participant list before update:",
    JSON.stringify(participantList, null, 2)
  );

  if (actionType === "join") {
    // Find the participant in the list
    let participantIndex = participantList.findIndex((p) => p.uid === userUid);

    if (participantIndex === -1) {
      // Add new participant if they don't exist in the list
      const newParticipant = {
        uid: userUid,
        rtmUid: userAttr.rtmUid || "",
        name: userAttr.name || "Unknown",
        company: userAttr.company || "",
        designation: userAttr.designation || "",
        avatar: userAttr.avatar,
        role: userAttr.role || "audience",
        bubbleid: userAttr.bubbleid,
        isRaisingHand: userAttr.isRaisingHand || false,
        roleInTheCall: userAttr.roleInTheCall || "audience",
      };
      participantList.push(newParticipant);
    } else {
      // Update existing participant details if they exist
      participantList[participantIndex] = {
        ...participantList[participantIndex],
        ...userAttr,
      };
    }
  } else if (actionType === "leave") {
    // Remove the participant if they are leaving
    participantList = participantList.filter((p) => p.uid !== userUid);
    console.log(`Participant ${userUid} has left.`);
  } else {
    console.warn(`Unknown action type: ${actionType}`);
    return;
  }

  // Log the participant list after update
  console.log(
    "Participant list after update:",
    JSON.stringify(participantList, null, 2)
  );

  // Separate participants by role
  const speakers = participantList.filter((p) => p.roleInTheCall === "speaker");
  const audiences = participantList.filter(
    (p) => p.roleInTheCall === "audience"
  );
  const hosts = participantList.filter((p) => p.roleInTheCall === "host");
  const waiting = participantList.filter((p) => p.roleInTheCall === "waiting");
  const audienceOnStage = participantList.filter(
    (p) => p.roleInTheCall === "audienceOnStage"
  );
  const meetingParticipants = participantList.filter(
    (p) => p.roleInTheCall === "meetingParticipant"
  );
  const masters = participantList.filter((p) => p.roleInTheCall === "master");

  // Helper to format data for Bubble, including rtmUid
  const formatForBubble = (participants) => ({
    outputlist1: participants.map((p) => p.name),
    outputlist2: participants.map((p) => p.company),
    outputlist3: participants.map((p) => p.designation),
    outputlist4: participants.map((p) => p.avatar),
    outputlist5: participants.map((p) => p.bubbleid),
    outputlist6: participants.map((p) => p.isRaisingHand),
    outputlist7: participants.map((p) => p.rtmUid),
  });

  // Send data to Bubble functions
  if (typeof bubble_fn_speaker === "function") {
    console.log("Sending speaker data to Bubble:", formatForBubble(speakers));
    bubble_fn_speaker(formatForBubble(speakers));
  }

  if (typeof bubble_fn_audience === "function") {
    console.log("Sending audience data to Bubble:", formatForBubble(audiences));
    bubble_fn_audience(formatForBubble(audiences));
  }

  if (typeof bubble_fn_host === "function") {
    console.log("Sending host data to Bubble:", formatForBubble(hosts));
    bubble_fn_host(formatForBubble(hosts));
  }

  if (typeof bubble_fn_waiting === "function") {
    console.log("Sending waiting data to Bubble:", formatForBubble(waiting));
    bubble_fn_waiting(formatForBubble(waiting));
  }

  if (typeof bubble_fn_audienceOnStage === "function") {
    console.log(
      "Sending audienceOnStage data to Bubble:",
      formatForBubble(audienceOnStage)
    );
    bubble_fn_audienceOnStage(formatForBubble(audienceOnStage));
  }

  if (typeof bubble_fn_meetingParticipant === "function") {
    console.log(
      "Sending meetingParticipant data to Bubble:",
      formatForBubble(meetingParticipants)
    );
    bubble_fn_meetingParticipant(formatForBubble(meetingParticipants));
  }

  if (typeof bubble_fn_master === "function") {
    console.log("Sending master data to Bubble:", formatForBubble(masters));
    bubble_fn_master(formatForBubble(masters));
  }

  console.log("Participant list updated.");
};



// Handles user joined event
export const handleUserJoined = async (user, config, userAttr = {}) => {
  console.log("User info:", user);
  console.log("User attributes:", userAttr);
  const userUid = user.uid.toString();
  console.log("Entering handleUserJoined function for user:", userUid);

  // Handle specific UIDs (2 triggers a special Bubble function, and 1/2 are skipped)
  if (userUid === "2") {
    console.log("UID is 2. Triggering bubble_fn_waitingForAcceptance.");
    bubble_fn_isVideoRecording("yes");
    bubble_fn_waitingForAcceptance();
  }

  if (userUid === "1" || userUid === "2") {
    console.log(`Skipping handling for special UID (${userUid}).`);
    userJoinPromises[userUid] = Promise.resolve(); // Ensure a resolved promise is set
    console.log(`Promise for UID ${userUid} resolved and skipped.`);
    return userJoinPromises[userUid];
  }

  // If a promise for this user already exists, return it
  if (userJoinPromises[userUid]) {
    console.log(`User join already in progress for UID: ${userUid}`);
    return userJoinPromises[userUid];
  }

  // Create a new promise for this user
  userJoinPromises[userUid] = new Promise(async (resolve, reject) => {
    try {
      console.log(`Starting promise for user ${userUid}.`);

      // Prevent handling your own stream
      if (userUid === config.uid.toString()) {
        console.log(`Skipping wrapper creation for own UID: ${userUid}`);
        resolve();
        return;
      }

      // Log the role for clarity
      const role = userAttr.role || "audience";
      console.log(`Role for user ${userUid}: ${role}`);

      // Initialize remoteTracks if needed
      config.remoteTracks = config.remoteTracks || {};
      config.remoteTracks[userUid] = { wrapperReady: false };

      // Only proceed with wrapper if the user is a host
      if (role === "host") {
        console.log(`User ${userUid} is a host. Checking video wrapper.`);
        let participantWrapper = document.querySelector(
          `#video-wrapper-${userUid}`
        );
        if (!participantWrapper) {
          console.log(
            `No wrapper found for user ${userUid}, creating a new one.`
          );
          await addUserWrapper({ uid: userUid, ...userAttr }, config);
          console.log(`Wrapper successfully created for user ${userUid}.`);
        } else {
          console.log(`Wrapper already exists for user ${userUid}.`);
        }

        // Mark the wrapper as ready
        config.remoteTracks[userUid].wrapperReady = true;
        console.log(`Wrapper marked as ready for user ${userUid}.`);
      } else {
        console.log(
          `User ${userUid} is not a host. Skipping wrapper creation.`
        );
      }

      console.log(
        `Invoking manageParticipants for user ${userUid} with action "join".`
      );
      manageParticipants(userUid, userAttr, "join");

      console.log(`Promise resolved for user ${userUid}.`);
      resolve();
    } catch (error) {
      console.error(`Error in handleUserJoined for user ${userUid}:`, error);
      try {
        console.log(
          `Calling manageParticipants with action "error" for user ${userUid}.`
        );
        manageParticipants(userUid, userAttr, "error");
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
  return userJoinPromises[userUid];
};




// Handles user left event
export const handleUserLeft = async (user, config) => {
  try {
    console.log(`User ${user.uid} left`);

    // Skip handling for screen share UID (RTC UID 1)
    if (user.uid === 1) {
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
    if (config.remoteTracks && config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid];
      console.log(`Removed tracks for user ${user.uid}`);
    } else {
      console.log(`No tracks found for user ${user.uid}`);
    }

    // Convert user.uid to a string when calling manageParticipants
    manageParticipants(String(user.uid), {}, "leave");

    // Clear user join promise when the user leaves
    if (config.userJoinPromises && config.userJoinPromises[user.uid]) {
      delete config.userJoinPromises[user.uid];
      console.log(`Cleared userJoinPromises for user ${user.uid}`);
    }

    console.log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
};


// Handles volume indicator change
export const handleVolumeIndicator = (() => {
  let lastMutedStatuses = {}; // Store the last muted status for each UID ("yes" or "no")

  return async (result) => {
    for (const volume of result) {
      const userUID = volume.uid;

      // Ignore UID 1 (screen share client or any other special case)
      if (userUID === 1) {
        continue; // Skip this iteration
      }

      const audioLevel = volume.level; // The audio level, used to determine when the user is speaking
      let wrapper = document.querySelector(`#video-wrapper-${userUID}`);
      console.log(userUID, audioLevel);

      const currentStatus = audioLevel < 3 ? "yes" : "no";

      // Initialize lastMutedStatus for this userUID if it doesn't exist
      if (!lastMutedStatuses[userUID]) {
        lastMutedStatuses[userUID] = "no"; // Default to "no"
      }

      // Only send to Bubble if the status has changed for this userUID
      if (currentStatus !== lastMutedStatuses[userUID]) {
        console.log(
          `Sending to bubble: bubble_fn_systemmuted("${currentStatus}") for UID ${userUID}`
        );
        bubble_fn_systemmuted(currentStatus);
        lastMutedStatuses[userUID] = currentStatus; // Update the last status for this UID
      }

      // Apply audio level indicator styles if the wrapper is available
      if (wrapper) {
        if (audioLevel > 60) {
          // Adjust the threshold based on your needs
          wrapper.style.borderColor = "#00ff00"; // Green when the user is speaking
        } else {
          wrapper.style.borderColor = "transparent"; // Transparent when not speaking
        }
      }
    }
  };
})();




// Handles token renewal
export const handleRenewToken = async (config, client) => {
  config.token = await fetchTokens();
  await client.renewToken(config.token);
};

