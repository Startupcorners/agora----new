// rtcEventHandlers.js
import { newMainApp } from "./main.js";
import { fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import {
  toggleStages,
} from "./videoHandlers.js";
import { updatePublishingList} from "./uiHandlers.js"; 
import { playStreamInDiv } from "./videoHandlers.js"; 

const userJoinPromises = {};


// Handles user published event
export const handleUserPublished = async (user, mediaType, client) => {
  const app = newMainApp();
const config = app.getConfig();

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
    await handleVideoPublished(user, userUid, client);
  } else if (mediaType === "audio") {
    await handleAudioPublished(user, userUid, client);
  } else {
    console.warn(`Unsupported mediaType: ${mediaType}`);
  }
};

const handleVideoPublished = async (user, userUid, client) => {
  const app = newMainApp();
const config = app.getConfig();
 // Retrieve the current config

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
        `Current user config.sharingScreenUid: ${config.sharingScreenUid}`
      );

      // Skip if the current screen share is from the local user
      if (config.sharingScreenUid === sharingUserUid) {
        console.log("Local user is currently sharing. Skipping processing.");
        return;
      }

      // Update sharingScreenUid using updateConfig
      app.updateConfig({ sharingScreenUid: sharingUserUid });
      bubble_fn_userSharingScreen(sharingUserUid);

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

      // Update userTracks using updateConfig
      app.updateConfig({
        userTracks: {
          ...config.userTracks,
          [userUid]: { videoTrack: user.videoTrack },
        },
      });

      // Toggle stage to screen share
      toggleStages(true);

      // Play screen share track
      playStreamInDiv(userUid, "#screen-share-content");
    } catch (error) {
      console.error("Error processing screen share:", error);
    }

    return;
  }

  // General video handling for other users
  try {
    await client.subscribe(user, "video");

    // Update userTracks using updateConfig
    app.updateConfig({
      userTracks: {
        ...config.userTracks,
        [userUid]: { videoTrack: user.videoTrack },
      },
    });
    console.log(`Subscribed to video track for user: ${userUid}`);

    updatePublishingList(userUid.toString(), "video", "add");

    if (config.sharingScreenUid) {
      playStreamInDiv(userUid, "#pip-video-track");
    } else {
      playStreamInDiv(userUid, `#stream-${userUid}`);
    }
  } catch (error) {
    console.error(`Error subscribing to video for user ${userUid}:`, error);
  }
};



const handleAudioPublished = async (user, userUid, client) => {
  const app = newMainApp();
const config = app.getConfig();
 // Use the shared singleton instance's config
  console.log(`Handling audio published for user: ${userUid}`);

  try {
    // Ensure the userTracks object exists and update the audio track
    app.updateConfig({
      userTracks: {
        ...config.userTracks,
        [userUid]: {
          ...config.userTracks[userUid],
          audioTrack: user.audioTrack, // Always update the audio track
        },
      },
    });
    console.log(`Updated audio track for user ${userUid}`);

    // Fetch roleInTheCall attribute dynamically
    let userRole = null;
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        const attributes = await config.clientRTM.getUserAttributes(
          config.user.rtmUid.toString()
        );
        userRole = attributes.roleInTheCall || null;
        console.log(
          `Fetched roleInTheCall for user ${config.user.rtmUid}:`,
          userRole
        );
      } catch (error) {
        console.error(
          `Failed to fetch roleInTheCall for user ${userUid}:`,
          error
        );
      }
    }

    // Check if the user's role is "waiting" before subscribing
    if (userRole === "waiting") {
      console.warn(
        `User ${userUid} is in 'waiting' role. Skipping subscription.`
      );
      return;
    }

    // Subscribe to the audio track
    await client.subscribe(user, "audio");
    console.log(`Subscribed to audio track for user ${userUid}`);

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

    // Update the publishing list
    updatePublishingList(userUid.toString(), "audio", "add");
  } catch (error) {
    console.error(`Error subscribing to audio for user ${userUid}:`, error);
  }
};





export const handleUserUnpublished = async (user, mediaType) => {
  const app = newMainApp();
const config = app.getConfig();

  console.log("Entered handleuserUnpublished:", user);
  console.log("User :",user);
  const userUid = user.uid.toString();
  console.log(
    `handleUserUnpublished called for user: ${userUid}, mediaType: ${mediaType}`
  );

  if (mediaType === "video") {
    await handleVideoUnpublished(user, userUid);
  } else if (mediaType === "audio") {
    await handleAudioUnpublished(user, userUid);
  } else {
    console.warn(`Unsupported mediaType: ${mediaType}`);
  }
};


const handleVideoUnpublished = async (user, userUid) => {
  const app = newMainApp();
const config = app.getConfig();

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

        console.log(
          `UID of the screenShareRTCClient being logged out: ${config.screenShareRTCClient?.uid}`
        );

        // Log and logout from screenShareRTMClient
        console.log(
          `Attempting to log out from screenShareRTMClient for UID: ${config.screenShareRTCClient?.uid}...`
        );
        await config.screenShareRTMClient?.logout();
        console.log(
          `Successfully logged out from screenShareRTMClient for UID: ${config.screenShareRTCClient?.uid}.`
        );

        // Log and leave screenShareRTCClient
        console.log(
          `Attempting to leave screenShareRTCClient for UID: ${config.screenShareRTCClient?.uid}...`
        );
        await config.screenShareRTCClient?.leave();
        console.log(
          `Successfully left screenShareRTCClient for UID: ${config.screenShareRTCClient?.uid}.`
        );

        // Update config using updateConfig
        app.updateConfig({
          screenShareRTMClient: null,
          screenShareRTCClient: null,
          sharingScreenUid: null,
          generatedScreenShareId: null,
        });
        bubble_fn_userSharingScreen(null);

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

          app.updateConfig({
            userTracks: {
              ...config.userTracks,
              [userUid]: {
                ...config.userTracks[userUid],
                videoTrack: null,
              },
            },
          });

          console.log(`Removed video track for user ${userUid}`);
        }

        playStreamInDiv(
          config.sharingScreenUid,
          `#stream-${config.sharingScreenUid}`
        );

        // Reset screen share tracking
        app.updateConfig({
          screenShareRTMClient: null,
          screenShareRTCClient: null,
          sharingScreenUid: null,
          generatedScreenShareId: null,
        });
        bubble_fn_userSharingScreen(null);
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

    app.updateConfig({
      userTracks: {
        ...config.userTracks,
        [userUid]: {
          ...config.userTracks[userUid],
          videoTrack: null,
        },
      },
    });

    console.log(`Removed video track for user ${userUid}`);
  }

  updatePublishingList(userUid.toString(), "video", "remove");

  // Stop displaying the user's video in the UI
  playStreamInDiv(userUid, `#stream-${userUid}`);
};






const handleAudioUnpublished = async (user, userUid) => {
  const app = newMainApp();
const config = app.getConfig();

  console.log(`Handling audio unpublishing for user: ${userUid}`);

  try {
    // Fetch roleInTheCall attribute dynamically
    let userRole = null;
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        const attributes = await config.clientRTM.getUserAttributes(
          config.user.rtmUid.toString()
        );
        userRole = attributes.roleInTheCall || null;
        console.log(
          `Fetched roleInTheCall for user ${config.user.rtmUid}:`,
          userRole
        );
      } catch (error) {
        console.error(
          `Failed to fetch roleInTheCall for user ${userUid}:`,
          error
        );
      }
    }

    // Stop and remove the audio track
    if (config.userTracks[userUid] && config.userTracks[userUid].audioTrack) {
      config.userTracks[userUid].audioTrack.stop();

      app.updateConfig({
        userTracks: {
          ...config.userTracks,
          [userUid]: {
            ...config.userTracks[userUid],
            audioTrack: null, // Set audioTrack to null
          },
        },
      });
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

    // Remove the 'animated' class from all bars
    const waveElement = document.querySelector(`#wave-${userUid}`);
    if (waveElement) {
      const audioBars = waveElement.querySelectorAll(".bar");
      if (audioBars.length > 0) {
        audioBars.forEach((bar) => bar.classList.remove("animated"));
        console.log(`Removed 'animated' class from bars for user ${userUid}`);
      } else {
        console.warn(`No bars found in wave-${userUid}`);
      }
    } else {
      console.warn(`Wave element not found for user ${userUid}`);
    }

    // Log role-specific behavior
    if (userRole === "waiting") {
      console.log(`User ${userUid} is in 'waiting' role. Audio unpublished.`);
    } else {
      console.log(
        `User ${userUid} role: ${userRole}. Proceeding with normal flow.`
      );
    }

    // Update the publishing list
    updatePublishingList(userUid.toString(), "audio", "remove");
  } catch (error) {
    console.error(
      `Error handling audio unpublishing for user ${userUid}:`,
      error
    );
  }
};





export const manageParticipants = async (userUid, userAttr, actionType) => {
  const app = newMainApp();
const config = app.getConfig();

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
    console.log(`Participant ${userUid} has left.`);
  } else {
    console.warn(`Unknown action type: ${actionType}`);
    return;
  }

  // Use app.updateConfig to update the participant list in the config
  app.updateConfig({ participantList });

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
export const handleUserJoined = async (user, userAttr = {}) => {
  const app = newMainApp();
const config = app.getConfig();

  console.log("User info:", user);
  console.log("User attributes:", userAttr);
  const userUid = user.uid.toString();
  console.log("Entering handleUserJoined function for user:", userUid);

  // Initialize userJoinPromises in config if it doesn't exist
  if (!config.userJoinPromises) {
    app.updateConfig({ userJoinPromises: {} });
  }

  // Handle specific UIDs (2 triggers a special Bubble function)
  if (userUid === "2") {
    console.log("UID is 2. Triggering bubble_fn_waitingForAcceptance.");
    bubble_fn_isVideoRecording("yes");
    bubble_fn_waitingForAcceptance();
  }

  // Skip handling for special UIDs (UIDs > 999999999 or UID 2)
  if (parseInt(userUid) > 999999999 || userUid === "2") {
    console.log(`Skipping handling for special UID (${userUid}).`);
    app.updateConfig({
      userJoinPromises: {
        ...config.userJoinPromises,
        [userUid]: Promise.resolve(),
      },
    });
    console.log(`Promise for UID ${userUid} resolved and skipped.`);
    return config.userJoinPromises[userUid];
  }

  // If a promise for this user already exists, return it
  if (config.userJoinPromises[userUid]) {
    console.log(`User join already in progress for UID: ${userUid}`);
    return config.userJoinPromises[userUid];
  }

  // Create a new promise for this user
  const newPromise = new Promise(async (resolve, reject) => {
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
      const updatedRemoteTracks = {
        ...config.remoteTracks,
        [userUid]: {
          ...(config.remoteTracks ? config.remoteTracks[userUid] : {}),
          wrapperReady: false,
        },
      };
      app.updateConfig({ remoteTracks: updatedRemoteTracks });

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
          await addUserWrapper(userUid);
          console.log(`Wrapper successfully created for user ${userUid}.`);
        } else {
          console.log(`Wrapper already exists for user ${userUid}.`);
        }

        // Mark the wrapper as ready
        const updatedRemoteTracksReady = {
          ...updatedRemoteTracks,
          [userUid]: {
            ...updatedRemoteTracks[userUid],
            wrapperReady: true,
          },
        };
        app.updateConfig({ remoteTracks: updatedRemoteTracksReady });
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

  // Update config with the new promise
  app.updateConfig({
    userJoinPromises: {
      ...config.userJoinPromises,
      [userUid]: newPromise,
    },
  });

  console.log(`Returning promise for user ${userUid}.`);
  return newPromise;
};



// Handles user left event
export const handleUserLeft = async (user) => {
  const app = newMainApp();
const config = app.getConfig();

  console.log("Entered handleUserLeft:", user);

  // Initialize userJoinPromises in config if it doesn't exist
  if (!config.userJoinPromises) {
    app.updateConfig({ userJoinPromises: {} });
  }

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
      const updatedUserTracks = { ...config.userTracks };
      delete updatedUserTracks[user.uid];
      app.updateConfig({ userTracks: updatedUserTracks });
      console.log(`Removed tracks for user ${user.uid}`);
    } else {
      console.log(`No tracks found for user ${user.uid}`);
    }

    // Call manageParticipants with the user's UID and action "leave"
    manageParticipants(user.uid, {}, "leave");

    // Clear userJoinPromises when the user leaves
    if (config.userJoinPromises && config.userJoinPromises[user.uid]) {
      const updatedUserJoinPromises = { ...config.userJoinPromises };
      delete updatedUserJoinPromises[user.uid];
      app.updateConfig({ userJoinPromises: updatedUserJoinPromises });
      console.log(`Cleared userJoinPromises for user ${user.uid}`);
    }

    console.log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
};





export const handleVolumeIndicator = (() => {
  return async (result) => {
    const app = newMainApp();
const config = app.getConfig();

    const currentUserUid = config.uid; // Extract the current user's UID from the config

    // Initialize speakingIntervals in config if it doesn't exist
    if (!config.speakingIntervals) {
      app.updateConfig({ speakingIntervals: {} });
    }

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
            if (!config.speakingIntervals[userUID]) {
              const updatedIntervals = { ...config.speakingIntervals };

              // Start interval to update bars
              updatedIntervals[userUID] = setInterval(() => {
                audioBars.forEach((bar) => {
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

              app.updateConfig({ speakingIntervals: updatedIntervals });
            }
          } else {
            // User is not speaking

            // If we have an interval for this user, clear it
            if (config.speakingIntervals[userUID]) {
              const updatedIntervals = { ...config.speakingIntervals };
              clearInterval(updatedIntervals[userUID]);
              delete updatedIntervals[userUID];

              // Reset bars to minimum height
              audioBars.forEach((bar) => {
                bar.style.height = `5px`; // Reset to minimum height
              });

              app.updateConfig({ speakingIntervals: updatedIntervals });
            }
          }
        }
      }

      // Only process and send notifications for the local user (currentUserUid)
      if (userUID === currentUserUid) {
        // Initialize lastMutedStatuses in config if it doesn't exist
        if (!config.lastMutedStatuses) {
          app.updateConfig({ lastMutedStatuses: {} });
        }

        // Notify Bubble only when the status changes
        const updatedMutedStatuses = { ...config.lastMutedStatuses };
        if (currentStatus !== updatedMutedStatuses[userUID]) {
          console.log(
            `Sending to bubble: bubble_fn_systemmuted("${currentStatus}") for UID ${userUID}`
          );
          bubble_fn_systemmuted(currentStatus);
          updatedMutedStatuses[userUID] = currentStatus; // Update the last status for this UID
          app.updateConfig({ lastMutedStatuses: updatedMutedStatuses });
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
export const handleRenewToken = async (client) => {
  const app = newMainApp();
const config = app.getConfig();

  config.token = await fetchTokens();
  await client.renewToken(config.token);
};


