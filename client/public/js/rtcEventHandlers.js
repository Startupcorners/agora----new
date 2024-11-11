// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";
import {
  startScreenShare,
  stopScreenShare,
  manageCameraState,
  playCameraVideo,
  showAvatar,
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

  // Handle screen share client (UID 1)
  if (userUid === "1") {
    console.log(`User with UID 1 (screen share client) published.`);

    try {
      // Fetch RTM attributes for UID 1 to get 'sharingUser'
      const attributes = await config.clientRTM.getUserAttributes("1");
      const sharingUser = attributes.sharingUser;

      if (sharingUser) {
        console.log(`Screen share is from user: ${sharingUser}`);

        // Set currentScreenSharingUserUid regardless of who is sharing
        config.currentScreenSharingUserUid = parseInt(sharingUser, 10);

        // If the screen share is from the local user, do not subscribe
        if (sharingUser === config.uid.toString()) {
          console.log("Screen share is from local user. Not subscribing.");

          // Update the UI using manageCameraState and toggleStages
          manageCameraState(config.uid, config);
          toggleStages(true, config.uid); // Show screen share stage

          return;
        } else {
          console.log("Screen share is from remote user. Subscribing.");

          // Subscribe to the screen share track
          await client.subscribe(user, mediaType);

          // Store the screen share track
          if (!userTracks[1]) {
            userTracks[1] = {};
          }
          userTracks[1].screenShareTrack = user.videoTrack;

          // Update UI accordingly using manageCameraState and toggleStages
          manageCameraState(config.currentScreenSharingUserUid, config);
          toggleStages(true, config.currentScreenSharingUserUid); // Show screen share stage

          return;
        }
      } else {
        console.error(
          "Could not determine who is sharing the screen. 'sharingUser' attribute is missing."
        );
        return;
      }
    } catch (error) {
      console.error(`Error fetching RTM attributes for user 1:`, error);
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

      // Update UI using manageCameraState
      manageCameraState(userUid, config);
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
  }
};




export const manageParticipants = async (config) => {
  console.log("Synchronizing the full participant list with RTC...");

  try {
    // Step 1: Fetch current RTC participants and convert their UIDs to strings
    const rtcUsers = await config.client.getUsers();
    const rtmUIDs = rtcUsers.map((user) => user.uid.toString()); // Convert RTC UIDs to strings for RTM compatibility

    // Step 2: Fetch attributes for each RTC (RTM) participant and build a fresh list
    const updatedParticipantList = await Promise.all(
      rtmUIDs.map(async (uid) => {
        const userAttr = await config.clientRTM.getUserAttributes(uid);
        return {
          uid,
          rtmUid: uid,
          role: userAttr.role || "audience",
          isRaisingHand: userAttr.isRaisingHand || false,
          roleInTheCall: userAttr.roleInTheCall || "audience",
        };
      })
    );

    // Step 3: Synchronize `participantList`
    const localUIDs = participantList.map((p) => p.uid);
    const newUIDs = rtmUIDs.filter((uid) => !localUIDs.includes(uid));
    const removedUIDs = localUIDs.filter((uid) => !rtmUIDs.includes(uid));
    const commonUIDs = rtmUIDs.filter((uid) => localUIDs.includes(uid));

    // Add new participants
    for (const uid of newUIDs) {
      const newParticipant = updatedParticipantList.find((p) => p.uid === uid);
      participantList.push(newParticipant);
      console.log(`Added participant: ${uid}`);
    }

    // Update only the fields that might change (role, isRaisingHand, roleInTheCall) for existing participants
    for (const uid of commonUIDs) {
      const updatedData = updatedParticipantList.find((p) => p.uid === uid);
      const participantIndex = participantList.findIndex((p) => p.uid === uid);

      if (participantIndex !== -1) {
        const existingParticipant = participantList[participantIndex];

        // Update only if these fields have changed
        if (
          existingParticipant.role !== updatedData.role ||
          existingParticipant.isRaisingHand !== updatedData.isRaisingHand ||
          existingParticipant.roleInTheCall !== updatedData.roleInTheCall
        ) {
          participantList[participantIndex] = {
            ...existingParticipant,
            role: updatedData.role,
            isRaisingHand: updatedData.isRaisingHand,
            roleInTheCall: updatedData.roleInTheCall,
          };
          console.log(`Updated participant: ${uid}`);
        }
      }
    }

    // Remove participants not in RTC
    participantList = participantList.filter(
      (p) => !removedUIDs.includes(p.uid)
    );
    removedUIDs.forEach((uid) => console.log(`Removed participant: ${uid}`));

    // Log the updated participant list
    console.log(
      "Updated participant list:",
      JSON.stringify(participantList, null, 2)
    );

    // Step 4: Format and send the updated data to Bubble
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
      bubble_fn_speaker(
        formatForBubble(
          participantList.filter((p) => p.roleInTheCall === "speaker")
        )
      );
    }

    if (typeof bubble_fn_audience === "function") {
      bubble_fn_audience(
        formatForBubble(
          participantList.filter((p) => p.roleInTheCall === "audience")
        )
      );
    }

    if (typeof bubble_fn_host === "function") {
      bubble_fn_host(
        formatForBubble(
          participantList.filter((p) => p.roleInTheCall === "host")
        )
      );
    }

    if (typeof bubble_fn_waiting === "function") {
      bubble_fn_waiting(
        formatForBubble(
          participantList.filter((p) => p.roleInTheCall === "waiting")
        )
      );
    }

    if (typeof bubble_fn_audienceOnStage === "function") {
      bubble_fn_audienceOnStage(
        formatForBubble(
          participantList.filter((p) => p.roleInTheCall === "audienceOnStage")
        )
      );
    }

    if (typeof bubble_fn_meetingParticipant === "function") {
      bubble_fn_meetingParticipant(
        formatForBubble(
          participantList.filter(
            (p) => p.roleInTheCall === "meetingParticipant"
          )
        )
      );
    }

    console.log("Participant list synchronized with Bubble.");
  } catch (error) {
    console.error("Error synchronizing participant list:", error);
  }
};



// Handles user joined event
export const handleUserJoined = async (user, config, userAttr = {}) => {
  const userUid = user.uid.toString();
  console.log("Entering handleUserJoined function for user:", userUid);

  // If UID is 1 (screen share UID), skip processing
  if (userUid === "1") {
    console.log("Skipping handling for screen share UID (1).");
    userJoinPromises[userUid] = Promise.resolve(); // Ensure a resolved promise is set
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
      // Prevent handling your own stream
      if (userUid === config.uid.toString()) {
        console.log(`Skipping wrapper for own user UID: ${userUid}`);
        resolve(); // Resolve the promise even if it's skipped
        return; // Exit early
      }

      // Fetch user attributes if not provided
      if (!userAttr || Object.keys(userAttr).length === 0) {
        if (config.clientRTM) {
          try {
            userAttr = await config.clientRTM.getUserAttributes(userUid.toString());
          } catch (error) {
            console.error(
              `Failed to get RTM attributes for user ${userUid}:`,
              error
            );
            userAttr = {
              name: "Unknown",
              company: "",
              designation: "",
              role: "audience", // Default role
            };
          }
        } else {
          console.log(
            `clientRTM is not initialized. Skipping attribute fetch for user ${userUid}.`
          );
          userAttr = {
            name: "Unknown",
            company: "",
            designation: "",
            role: "audience", // Default role
          };
        }
      }

      // Assign role and initialize remoteTracks if needed
      user.role = userAttr.role || "audience";
      if (!config.remoteTracks) {
        config.remoteTracks = {};
      }
      config.remoteTracks[userUid] = { wrapperReady: false }; // Set wrapperReady flag to false initially

      // Only proceed with wrapper if the user is a host
      if (user.role !== "host") {
        console.warn(
          `User ${userUid} does not have the 'host' role. Skipping wrapper.`
        );
        resolve(); // Resolve the promise early if not a host
        return;
      }

      // Check if the video-wrapper exists; if not, create it
      let participantWrapper = document.querySelector(
        `#video-wrapper-${userUid}`
      );
      if (!participantWrapper) {
        await addUserWrapper({ uid: userUid, ...userAttr }, config); // Add the wrapper
        console.log(`Wrapper added for user: ${userUid}`);
      } else {
        console.log(`Wrapper already exists for user: ${userUid}`);
      }

      // Mark the wrapper as ready
      config.remoteTracks[userUid].wrapperReady = true;

      console.log(
        `Host user ${userUid} joined, waiting for media to be published.`
      );

      // ** Call the separate participant management function **
      manageParticipants(config);

      resolve(); // Resolve the promise when everything is done
    } catch (error) {
      console.error(`Error in handleUserJoined for user ${userUid}:`, error);
      reject(error); // Reject the promise on error
    }
  });

  // Return the promise
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

    // Remove the user's wrapper (video element and UI components)
    await removeUserWrapper(user.uid);

    // Remove the user's tracks from the config
    if (config.remoteTracks && config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid];
      console.log(`Removed tracks for user ${user.uid}`);
    } else {
      console.log(`No tracks found for user ${user.uid}`);
    }

    // Call manageParticipants without the config parameter to remove the user from participantList
    manageParticipants(config);

    // Clear user join promise when the user leaves
    if (config.userJoinPromises && config.userJoinPromises[user.uid]) {
      delete config.userJoinPromises[user.uid];
      console.log(`Cleared userJoinPromises for user ${user.uid}`);
    }

    console.log(`User ${user.uid} successfully removed`);
    bubble_fn_updateLayout();
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
};


// Handles volume indicator change
export const handleVolumeIndicator = async (result, config) => {
  for (const volume of result) {
    const userUID = volume.uid;

    // Ignore UID 1 (screen share client or any other special case)
    if (userUID === 1) {
      continue; // Skip this iteration
    }

    const audioLevel = volume.level; // The audio level, used to determine when the user is speaking
    let wrapper = document.querySelector(`#video-wrapper-${userUID}`);
    console.log(userUID, audioLevel);

    if (!wrapper) {
      // Wrapper not found, create it
      console.warn(`Wrapper for user ${userUID} not found, creating wrapper.`);
      
      // Assuming addUserWrapper is an async function
      await addUserWrapper({ uid: userUID, ...config.userAttr }, config); // Add the wrapper
      
      // Re-select the wrapper after adding it
      wrapper = document.querySelector(`#video-wrapper-${userUID}`);
      
      // Update the layout
      console.log(`Wrapper added for user: ${userUID}`);
    }

    // Apply audio level indicator styles if the wrapper is now available
    if (wrapper) {
      if (audioLevel > 60) { // Adjust the threshold based on your needs
        wrapper.style.borderColor = "#00ff00"; // Green when the user is speaking
      } else {
        wrapper.style.borderColor = "transparent"; // Transparent when not speaking
      }
    }
  }
};



// Handles token renewal
export const handleRenewToken = async (config, client) => {
  config.token = await fetchTokens();
  await client.renewToken(config.token);
};

