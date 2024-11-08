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




export const manageParticipants = (userUid, userAttr, config) => {
  console.log(`Managing participant list for user ${userUid}`);

  // Initialize or update participant list
  if (!config.participantList) {
    config.participantList = [];
  }

  let participant = config.participantList.find((p) => p.uid === userUid);
  if (!participant) {
    // If the participant doesn't exist, add them
    participant = {
      uid: userUid,
      uids: [userUid],
      name: userAttr.name || "Unknown",
      company: userAttr.company || "",
      designation: userAttr.designation || "",
      avatar: userAttr.avatar,
      role: userAttr.role || "audience",
      bubbleid: userAttr.bubbleid,
      isRaisingHand: userAttr.isRaisingHand,
      roleInTheCall: userAttr.roleInTheCall || "audience",
    };
    config.participantList.push(participant);
  } else if (!participant.uids.includes(userUid)) {
    // If the participant exists, update their details
    participant.uids.push(userUid);
  }

  // Separate lists for each role
  const speakers = config.participantList.filter(
    (p) => p.roleInTheCall === "speaker"
  );
  const audiences = config.participantList.filter(
    (p) => p.roleInTheCall === "audience"
  );
  const hosts = config.participantList.filter(
    (p) => p.roleInTheCall === "host"
  );

  // Function to map participant data
  const mapParticipantData = (participants) => ({
    uids: participants.map((p) => p.uid),
    names: participants.map((p) => p.name),
    companies: participants.map((p) => p.company),
    designations: participants.map((p) => p.designation),
    avatars: participants.map((p) => p.avatar),
    bubbleids: participants.map((p) => p.bubbleid),
    isRaisingHand: participants.map((p) => p.isRaisingHand),
  });

  // Prepare data for each role group
  const speakerData = mapParticipantData(speakers);
  const audienceData = mapParticipantData(audiences);
  const hostData = mapParticipantData(hosts);

  // Log data and send to respective Bubble functions
  if (typeof bubble_fn_speaker === "function") {
    console.log("Sending speaker data to Bubble:", speakerData);
    bubble_fn_speaker({
      outputlist1: speakerData.uids,
      outputlist2: speakerData.names,
      outputlist3: speakerData.companies,
      outputlist4: speakerData.designations,
      outputlist5: speakerData.avatars,
      outputlist6: speakerData.bubbleids,
      outputlist7: speakerData.isRaisingHand,
    });
  }

  if (typeof bubble_fn_audience === "function") {
    console.log("Sending audience data to Bubble:", audienceData);
    bubble_fn_audience({
      outputlist1: audienceData.uids,
      outputlist2: audienceData.names,
      outputlist3: audienceData.companies,
      outputlist4: audienceData.designations,
      outputlist5: audienceData.avatars,
      outputlist6: audienceData.bubbleids,
      outputlist7: audienceData.isRaisingHand,
    });
  }

  if (typeof bubble_fn_host === "function") {
    console.log("Sending host data to Bubble:", hostData);
    bubble_fn_host({
      outputlist1: hostData.uids,
      outputlist2: hostData.names,
      outputlist3: hostData.companies,
      outputlist4: hostData.designations,
      outputlist5: hostData.avatars,
      outputlist6: hostData.bubbleids,
      outputlist7: hostData.isRaisingHand,
    });
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

    // Remove the user from participantList
    if (config.participantList) {
      // Filter out the user who left
      config.participantList = config.participantList.filter(
        (participant) => participant.uid !== user.uid
      );

      console.log(`User ${user.uid} removed from participantList`);

      // Extract the updated participant information
      const participantUIDs = config.participantList.map((p) =>
        p.uid.toString()
      );
      const participantNames = config.participantList.map((p) => p.name);
      const participantCompanies = config.participantList.map((p) => p.company);
      const participantDesignations = config.participantList.map(
        (p) => p.designation
      );

      // Pass the arrays directly to bubble_fn_participantList
      if (typeof bubble_fn_participantList === "function") {
        bubble_fn_participantList({
          outputlist1: participantUIDs, // Pass as array
          outputlist2: participantNames,
          outputlist3: participantCompanies,
          outputlist4: participantDesignations,
        });
      }
    } else {
      console.warn("participantList is not initialized.");
    }

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

