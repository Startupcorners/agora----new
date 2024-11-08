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




export const manageParticipants = (userUid, userAttr, actionType) => {
  console.log(
    `Managing participant list for user ${userUid} with action ${actionType}`
  );

  // Log the participant list before update
  console.log(
    "Participant list before update:",
    JSON.stringify(participantList, null, 2)
  );

  if (actionType === "join") {
    // Check if the participant already exists
    let participantIndex = participantList.findIndex((p) => p.uid === userUid);

    if (participantIndex === -1) {
      // Add new participant if they don't exist in the list
      const newParticipant = {
        uid: userUid,
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

  // Helper to format data for Bubble
  const formatForBubble = (participants) => ({
    outputlist1: participants.map((p) => p.name),
    outputlist2: participants.map((p) => p.company),
    outputlist3: participants.map((p) => p.designation),
    outputlist4: participants.map((p) => p.avatar),
    outputlist5: participants.map((p) => p.bubbleid),
    outputlist6: participants.map((p) => p.isRaisingHand),
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

  // Send meetingParticipant data to Bubble if the function exists
  if (typeof bubble_fn_meetingParticipant === "function") {
    console.log(
      "Sending meetingParticipant data to Bubble:",
      formatForBubble(meetingParticipants)
    );
    bubble_fn_meetingParticipant(formatForBubble(meetingParticipants));
  }

  console.log("Participant list updated.");
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
      manageParticipants(userUid, userAttr, config);

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
export const handleUserLeft = async (user) => {
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
    manageParticipants(user.uid, {}, "leave");

    // Clear user join promise when the user leaves
    if (userJoinPromises[user.uid]) {
      delete userJoinPromises[user.uid];
      console.log(`Cleared userJoinPromises for user ${user.uid}`);
    }

    console.log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
};


// Handles volume indicator change
export const handleVolumeIndicator = (result, config) => {
  result.forEach((volume) => {
    const userUID = volume.uid;

    // Ignore UID 1 (screen share client or any other special case)
    if (userUID === 1) {
      return; // Skip this iteration
    }

    const audioLevel = volume.level; // The audio level, can be used to determine when the user is speaking
    const wrapper = document.querySelector(`#video-wrapper-${userUID}`);
    console.log(userUID, audioLevel);

    if (wrapper) {
      if (audioLevel > 60) {
        // Adjust the threshold based on your needs
        wrapper.style.borderColor = "#00ff00"; // Green when the user is speaking
      } else {
        wrapper.style.borderColor = "transparent"; // Transparent when not speaking
      }
    } else {
      console.warn(`Wrapper for user ${userUID} not found`);
    }
  });
};


// Handles token renewal
export const handleRenewToken = async (config, client) => {
  config.token = await fetchTokens();
  await client.renewToken(config.token);
};

