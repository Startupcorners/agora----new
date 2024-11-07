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




export const manageParticipants = (userUid, userAttr, config, action) => {
  console.log(`Processing ${action} action for user ${userUid}`);

  // Prepare data to send to the API
  const dataToSend = {
    event: config.channelName || "",
    id: config.user.bubbleid || "",
    name: userAttr.name || "Unknown",
    profile: config.user.avatar || "",
    role: userAttr.role || "audience",
    designation: userAttr.designation || "",
    company: userAttr.company || "",
    action: action, // Specify 'join' or 'leave'
  };

  const endpoint = `https://startupcorners.com/api/1.1/wf/participant${action}`;
  // Make API call to the endpoint
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Include any required authentication headers here
    },
    body: JSON.stringify(dataToSend),
  })
    .then((response) => response.json())
    .then((responseData) => {
      console.log("API call successful:", responseData);
    })
    .catch((error) => {
      console.error("API call failed:", error);
    });

  console.log(`${action} action processed for user ${userUid}`);
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
        resolve();
        return;
      }

      // **Skip processing if user is in the waiting room**
      if (userAttr.waiting === "yes") {
        console.log(
          `User ${userUid} is in the waiting room. Skipping join processing.`
        );
        resolve();
        return;
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
        resolve();
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
      resolve();
    } catch (error) {
      console.error(`Error in handleUserJoined for user ${userUid}:`, error);
      reject(error);
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

    // Use manageParticipants to update the participant list
    manageParticipants(user.uid, null, config, "leave");

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

