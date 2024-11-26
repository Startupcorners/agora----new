// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import {
  toggleStages,
} from "./videoHandlers.js";
import { updatePublishingList} from "./uiHandlers.js"; 
import { playStreamInDiv } from "./videoHandlers.js"; 
const userJoinPromises = {};


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

  // Skip processing for UID 2 (e.g., reserved UID for a different purpose)
  if (userUid === "2") {
    console.log("Skipping processing for UID 2.");
    return;
  }

  if (mediaType === "video") {
    await handleVideoPublished(user, userUid, config, client);
  } else if (mediaType === "audio") {
    await handleAudioPublished(user, userUid, config, client);
  } else {
    console.warn(`Unsupported mediaType: ${mediaType}`);
  }
};

const handleVideoPublished = async (user, userUid, config, client) => {
  console.log(`Handling video published for user: ${userUid}`);

  // Special case: Handle screen share (userUid > 999999999)
  if (userUid > 999999999) {
    console.log(`User ${userUid} is a screen share publisher.`);

    try {
      // Fetch attributes for UID > 999999999 to get sharing user details
      console.log(
        `Fetching attributes for screen-sharing user (UID: ${userUid})...`
      );
      const attributes = await config.clientRTM.getUserAttributes(
        userUid.toString()
      );

      const sharingUserUid = attributes.sharingScreenUid;
      const sharingAvatar = attributes.avatar || "default-avatar.png";

      console.log(`Screen share is from remote user: ${sharingUserUid}`);
      console.log(
        `current user config.sharingScreenUid: ${config.sharingScreenUid}`
      );

      // Skip if the current screen share is from the local user
      if (config.sharingScreenUid === sharingUserUid) {
        console.log("Local user is currently sharing. Skipping processing.");
        return;
      }

      // Set screenShareRTMClient to the sharing user's UID
      config.sharingScreenUid = sharingUserUid;
      bubble_fn_userSharingScreen(config.sharingScreenUid);

      // Update the PiP avatar
      const avatarElement = document.getElementById("pip-avatar");
      if (avatarElement) {
        avatarElement.src = sharingAvatar;
        console.log(`Updated PiP avatar to ${sharingAvatar}.`);
      } else {
        console.warn("Could not find the PiP avatar element to update.");
      }

      // Subscribe to the screen share track
      await client.subscribe(user, "video");

      // Store the screen share track
      if (!config.userTracks[userUid]) {
        config.userTracks[userUid] = {};
      }
      config.userTracks[userUid].videoTrack = user.videoTrack;
      
      // Toggle stage to screen share
      toggleStages(true);

      // Play screen share track
      playStreamInDiv(config, userUid, "#screen-share-content");
    } catch (error) {
      console.error("Error processing screen share:", error);
    }

    return;
  }

  // General video handling for other users
  try {
    if (!config.userTracks[userUid]) {
      config.userTracks[userUid] = {};
    }
    console.log("Video tracks: ", config.userTracks);

    await client.subscribe(user, "video");
    console.log(`Subscribed to video track for user ${userUid}`);

    updatePublishingList(userUid.toString(), "video", "add", config);
    

    if (config.sharingScreenUid) {
      playStreamInDiv(config, userUid, "#pip-video-track");
    } else {
      playStreamInDiv(config, userUid, `#stream-${userUid}`);
    }
  } catch (error) {
    console.error(`Error subscribing to video for user ${userUid}:`, error);
  }
};



const handleAudioPublished = async (user, userUid, config, client) => {
  console.log(`Handling audio published for user: ${userUid}`);

  try {
    if (!config.userTracks[userUid]) {
      config.userTracks[userUid] = {};
    }

    await client.subscribe(user, "audio");
    console.log(`Subscribed to audio track for user ${userUid}`);

    config.userTracks[userUid].audioTrack = user.audioTrack;

    // Play audio track directly
    user.audioTrack.play();
    console.log(`Playing audio track for user ${userUid}.`);

    // Update the mic status element to show unmuted state
    const micStatusElement = document.getElementById(`mic-status-${userUid}`);
    if (micStatusElement) {
      micStatusElement.classList.add("hidden"); // Hide the muted icon
      console.log(
        `Added 'hidden' class to mic-status-${userUid} to indicate unmuted status`
      );
    } else {
      console.warn(`Mic status element not found for user ${userUid}`);
    }

    updatePublishingList(userUid.toString(), "audio", "add", config);

  } catch (error) {
    console.error(`Error subscribing to audio for user ${userUid}:`, error);
  }
};







export const handleUserUnpublished = async (user, mediaType, config) => {
  console.log("Entered handleuserUnpublished:", user);
  console.log("User :",user);
  const userUid = user.uid.toString();
  console.log(
    `handleUserUnpublished called for user: ${userUid}, mediaType: ${mediaType}`
  );

  if (mediaType === "video") {
    await handleVideoUnpublished(user, userUid, config);
  } else if (mediaType === "audio") {
    await handleAudioUnpublished(user, userUid, config);
  } else {
    console.warn(`Unsupported mediaType: ${mediaType}`);
  }
};


const handleVideoUnpublished = async (user, userUid, config) => {
  console.log(`Handling video unpublishing for user: ${userUid}`);

  // Special case: Handle screen share (UID > 999999999)
  if (userUid > 999999999) {
    console.log(`Screen share track unpublished for UID: ${userUid}.`);

    try {
      // Check if the local user is the one sharing
      if (config.sharingScreenUid === config.uid.toString()) {
        console.log(
          `Local user (UID: ${config.uid}) was sharing. Stopping local screen share.`
        );

        // Log the UID of the screenShareRTCClient
        console.log(
          `UID of the screenShareRTCClient being logged out: ${config.screenShareRTCClient.uid}`
        );

        // Log and logout from screenShareRTMClient
        console.log(
          `Attempting to log out from screenShareRTMClient for UID: ${config.screenShareRTCClient.uid}...`
        );
        await config.screenShareRTMClient.logout();
        console.log(
          `Successfully logged out from screenShareRTMClient for UID: ${config.screenShareRTCClient.uid}.`
        );

        // Log and leave screenShareRTCClient
        console.log(
          `Attempting to leave screenShareRTCClient for UID: ${config.screenShareRTCClient.uid}...`
        );
        await config.screenShareRTCClient.leave();
        console.log(
          `Successfully left screenShareRTCClient for UID: ${config.screenShareRTCClient.uid}.`
        );
        config.screenShareRTMClient = null;
        config.screenShareRTCClient = null;
        config.sharingScreenUid = null;
        config.generatedScreenShareId = null;
        bubble_fn_userSharingScreen(config.sharingScreenUid);

        return; // Exit as local user cleanup is already handled elsewhere
      }

      // If another user was previously sharing, restore their video
      if (config.sharingScreenUid !== config.uid.toString()) {
        console.log("Restoring previous user's video.");

        toggleStages(false); // Hide screen share stage

        if (
          config.userTracks[userUid] &&
          config.userTracks[userUid].videoTrack
        ) {
          config.userTracks[userUid].videoTrack.stop();
          config.userTracks[userUid].videoTrack = null;
          console.log(`Removed video track for user ${userUid}`);
        }

        playStreamInDiv(
          config,
          config.sharingScreenUid,
          `#stream-${config.sharingScreenUid}`
        );

        // Reset screen share tracking
        config.screenShareRTMClient = null;
        config.screenShareRTCClient = null;
        config.sharingScreenUid = null;
        config.generatedScreenShareId = null;
      }
    } catch (error) {
      console.error("Error handling screen share unpublishing:", error);
    }

    return;
  }

  // General video handling for other users
  console.log(`User ${userUid} has unpublished their video track.`);

  if (config.userTracks[userUid] && config.userTracks[userUid].videoTrack) {
    config.userTracks[userUid].videoTrack.stop();
    config.userTracks[userUid].videoTrack = null;
    console.log(`Removed video track for user ${userUid}`);
  }

  updatePublishingList(userUid.toString(), "video", "remove", config);

  // Stop displaying the user's video in the UI
  playStreamInDiv(config, userUid, `#stream-${userUid}`);
};





const handleAudioUnpublished = async (user, userUid, config) => {
  console.log(`Handling audio unpublishing for user: ${userUid}`);

  // Stop and remove the audio track
  if (config.userTracks[userUid] && config.userTracks[userUid].audioTrack) {
    config.userTracks[userUid].audioTrack.stop();
    config.userTracks[userUid].audioTrack = null;
    console.log(`Removed audio track for user ${userUid}`);
  }

  // Update the mic status element to show muted state
  const micStatusElement = document.getElementById(`mic-status-${userUid}`);
  if (micStatusElement) {
    micStatusElement.classList.remove("hidden"); // Show the muted icon
    console.log(
      `Removed 'hidden' class from mic-status-${userUid} to indicate muted status`
    );
  } else {
    console.warn(`Mic status element not found for user ${userUid}`);
  }

  // Update the wrapper's border style to indicate no active audio
  const wrapper = document.querySelector(`#video-wrapper-${userUid}`);
  if (wrapper) {
    wrapper.style.borderColor = "transparent"; // Transparent when audio is unpublished
    console.log(`Set border to transparent for user ${userUid}`);
  }

  updatePublishingList(userUid.toString(), "audio", "remove", config);
};



export const manageParticipants = async (
  config,
  userUid,
  userAttr,
  actionType
) => {
  console.warn(
    `Managing participant list for user ${userUid} with action ${actionType}`
  );
  updateLayout();

  // Use config.participantList
  let participantList = config.participantList;

  // Log the participant list before update
  console.log(
    "Participant list before update:",
    JSON.stringify(participantList, null, 2)
  );

  // Ensure consistent UID type
  const userUidNumber = Number(userUid); // Convert userUid to a number for consistent comparisons

  if (actionType === "join") {
    // Find the participant in the list
    let participantIndex = participantList.findIndex(
      (p) => p.uid === userUidNumber
    );

    if (participantIndex === -1) {
      // Add new participant if they don't exist in the list
      const newParticipant = {
        uid: userUidNumber, // Store uid as a number
        rtmUid: userAttr.rtmUid || "",
        name: userAttr.name || "Unknown",
        company: userAttr.company || "",
        designation: userAttr.designation || "",
        avatar: userAttr.avatar || "https://ui-avatars.com/api/?name=Unknown",
        role: userAttr.role || "audience",
        bubbleid: userAttr.bubbleid || "",
        isRaisingHand: userAttr.isRaisingHand || "no",
        roleInTheCall: userAttr.roleInTheCall || "audience",
      };
      participantList.push(newParticipant);
      console.log(`Participant ${userUid} has joined.`);
    } else {
      // Update existing participant details if they exist
      participantList[participantIndex] = {
        ...participantList[participantIndex],
        ...userAttr,
      };
      console.log(`Participant ${userUid} details updated.`);
    }
  } else if (actionType === "leave") {
    // Remove the participant if they are leaving
    participantList = participantList.filter((p) => p.uid !== userUidNumber);
    config.participantList = participantList; // Update the participantList in config
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

  // Initialize userJoinPromises in config if it doesn't exist
  config.userJoinPromises = config.userJoinPromises || {};

  // Handle specific UIDs (2 triggers a special Bubble function)
  if (userUid === "2") {
    console.log("UID is 2. Triggering bubble_fn_waitingForAcceptance.");
    bubble_fn_isVideoRecording("yes");
    bubble_fn_waitingForAcceptance();
  }

  // Skip handling for special UIDs (UIDs > 999999999 or UID 2)
  if (parseInt(userUid) > 999999999 || userUid === "2") {
    console.log(`Skipping handling for special UID (${userUid}).`);
    config.userJoinPromises[userUid] = Promise.resolve(); // Ensure a resolved promise is set
    console.log(`Promise for UID ${userUid} resolved and skipped.`);
    return config.userJoinPromises[userUid];
  }

  // If a promise for this user already exists, return it
  if (config.userJoinPromises[userUid]) {
    console.log(`User join already in progress for UID: ${userUid}`);
    return config.userJoinPromises[userUid];
  }

  // Create a new promise for this user
  config.userJoinPromises[userUid] = new Promise(async (resolve, reject) => {
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

      // Initialize remoteTracks if needed
      config.remoteTracks = config.remoteTracks || {};
      config.remoteTracks[userUid] = config.remoteTracks[userUid] || {};
      config.remoteTracks[userUid].wrapperReady = false;

      // Only proceed with wrapper if the user is a host and not in the "waiting" state
      if (role === "host" && roleInTheCall !== "waiting") {
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

        // Mark the wrapper as ready
        config.remoteTracks[userUid].wrapperReady = true;
        console.log(`Wrapper marked as ready for user ${userUid}.`);
      } else {
        console.log(
          `User ${userUid} does not meet criteria (host and not waiting). Skipping wrapper creation.`
        );
      }

      console.log(
        `Invoking manageParticipants for user ${userUid} with action "join".`
      );
      // Ensure userUid is a number when calling manageParticipants
      manageParticipants(config, parseInt(userUid), userAttr, "join");

      console.log(`Promise resolved for user ${userUid}.`);
      resolve();
    } catch (error) {
      console.error(`Error in handleUserJoined for user ${userUid}:`, error);
      try {
        console.log(
          `Calling manageParticipants with action "error" for user ${userUid}.`
        );
        manageParticipants(config, parseInt(userUid), userAttr, "error");
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
  return config.userJoinPromises[userUid];
};


// Handles user left event
export const handleUserLeft = async (user, config) => {
  console.log("Entered handleUserLeft:", user);

  // Initialize userJoinPromises in config if it doesn't exist
  config.userJoinPromises = config.userJoinPromises || {};

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
    if (config.remoteTracks && config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid];
      console.log(`Removed tracks for user ${user.uid}`);
    } else {
      console.log(`No tracks found for user ${user.uid}`);
    }

    // Call manageParticipants with the user's UID and action "leave"
    manageParticipants(config, user.uid, {}, "leave");

    // Clear userJoinPromises when the user leaves
    if (config.userJoinPromises && config.userJoinPromises[user.uid]) {
      delete config.userJoinPromises[user.uid];
      console.log(`Cleared userJoinPromises for user ${user.uid}`);
    }

    console.log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
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
      console.log(`UID: ${userUID}, Audio Level: ${audioLevel}`);

      // Determine the current status based on audio level
      const currentStatus = audioLevel < 3 ? "yes" : "no";
   

      // Apply audio level indicator styles if the wrapper is available
      if (wrapper) {
        if (audioLevel > 60) {
          wrapper.style.borderColor = "#00ff00"; // Green when the user is speaking
        } else {
          wrapper.style.borderColor = "transparent"; // Transparent when not speaking
        }
      }

      // Only process and send notifications for the local user (currentUserUid)
      if (userUID === currentUserUid) {


        // Notify Bubble only when the status changes
        if (currentStatus !== config.lastMutedStatuses[userUID]) {
          console.log(
            `Sending to bubble: bubble_fn_systemmuted("${currentStatus}") for UID ${userUID}`
          );
          bubble_fn_systemmuted(currentStatus);
          config.lastMutedStatuses[userUID] = currentStatus; // Update the last status for this UID
        } else {
          console.log(
            `Status for UID ${userUID} remains unchanged (${currentStatus}), no notification sent.`
          );
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

