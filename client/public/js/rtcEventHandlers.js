// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";



// Handles user published event
export const handleUserPublished = async (user, mediaType, config) => {
  console.log(
    `handleUserPublished for user: ${user.uid}, mediaType: ${mediaType}`
  );

  // Skip subscribing to the local user's own media (camera and screen share)
  if (user.uid === config.uid || user.uid === config.screenShareUid) {
    console.log("Skipping subscription to local user's own media.");
    return;
  }

  // Ensure remoteTracks is initialized
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Store the user's remote tracks
  config.remoteTracks[user.uid] = user;

  // Check if the participant wrapper exists; if not, create it
  let participantWrapper = document.querySelector(`#participant-${user.uid}`);
  if (!participantWrapper) {
    // Retrieve user attributes via RTM or another method
    let attributes = {};
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        attributes = await config.clientRTM.getUserAttributes(
          user.uid.toString()
        );
      } catch (e) {
        console.error(`Failed to get attributes for user ${user.uid}`, e);
      }
    }
    const name = attributes.name || "Unknown";
    const avatar = attributes.avatar || "default-avatar-url";

    // Add user wrapper for the new UID
    await addUserWrapper({ uid: user.uid, name, avatar }, config);
  }

  // Wait for the wrapper to exist before proceeding
  let videoPlayer = null;
  let avatarDiv = null;
  for (let i = 0; i < 10; i++) {
    videoPlayer = document.querySelector(`#stream-${user.uid}`);
    avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    if (videoPlayer && avatarDiv) {
      break;
    }
    console.log(`Waiting for wrapper to be added for user ${user.uid}...`);
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
  }

  if (!videoPlayer || !avatarDiv) {
    console.error(
      `Video player or avatar div element not found for user ${user.uid}`
    );
    return;
  }

  console.log(`Wrapper found for user ${user.uid}, proceeding with media.`);

  if (mediaType === "video") {
    console.log(`Attempting to subscribe to video track for user ${user.uid}`);

    try {
      await config.client.subscribe(user, mediaType);

      if (user.videoTrack && typeof user.videoTrack.play === "function") {
        console.log(`Playing video track for user ${user.uid}`);
        user.videoTrack.play(`stream-${user.uid}`);
        avatarDiv.style.display = "none";
        videoPlayer.style.display = "block";
      } else {
        console.log(
          `User ${user.uid} does not have a valid video track. Showing avatar.`
        );
        avatarDiv.style.display = "block";
        videoPlayer.style.display = "none";
      }
    } catch (error) {
      console.error(
        `Error subscribing to video track for user ${user.uid}:`,
        error
      );
    }
  }

  if (mediaType === "audio") {
    console.log(`User ${user.uid} has published an audio track.`);

    try {
      await config.client.subscribe(user, mediaType);

      if (user.audioTrack && typeof user.audioTrack.play === "function") {
        console.log(`Playing audio track for user ${user.uid}`);
        user.audioTrack.play();
        toggleMicIcon(user.uid, false);
      } else {
        console.error(
          `Audio track for user ${user.uid} is invalid or missing.`
        );
        toggleMicIcon(user.uid, true);
      }
    } catch (error) {
      console.error(`Error playing audio track for user ${user.uid}:`, error);
    }
  }
};






export const handleUserUnpublished = async (user, mediaType, config) => {
  console.log(
    `handleUserUnpublished called for user: ${user.uid}, mediaType: ${mediaType}`
  );

  // Skip handling for local user's own media
  if (user.uid === config.uid || user.uid === config.screenShareUid) {
    console.log("Skipping handling of local user's own media.");
    return;
  }

  if (mediaType === "audio") {
    console.log(`User ${user.uid} has unpublished their audio track.`);
    toggleMicIcon(user.uid, true);

    if (config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid].audioTrack;
    }
  }

  if (mediaType === "video") {
    console.log(`User ${user.uid} has unpublished their video track.`);
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);

    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none";
      avatarDiv.style.display = "block";
    } else {
      console.warn(`Video player or avatar div not found for user ${user.uid}`);
    }

    if (config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid].videoTrack;
    }
  }
};




// Handles user joined event
export const handleUserJoined = async (user, config) => {
  console.log("Entering handleUserJoined function for user:", user.uid);

  try {
    // Convert UID to string for RTM operations
    const rtmUid = user.uid.toString();

    // Fetch user attributes (including role) from RTM
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

    // Ensure user has a role assigned in RTM
    if (!userAttr.role) {
      console.error(`Error: User ${user.uid} does not have a role assigned.`);
      throw new Error(`User ${user.uid} does not have a role assigned.`);
    }

    // Add the role from RTM to the user object
    user.role = userAttr.role;

    // Only proceed if the user is a host
    if (user.role !== "host") {
      console.warn(
        `User ${user.uid} does not have the 'host' role. Skipping wrapper.`
      );
      return; // Exit if the user is not a host
    }

    // Initialize remoteTracks if it's undefined
    if (!config.remoteTracks) {
      config.remoteTracks = {};
    }

    // Store user in remoteTracks (no media yet)
    config.remoteTracks[user.uid] = user;

    // Add the wrapper for the user if the role is host
    await addUserWrapper(user, config);

    console.log(
      `Host user ${user.uid} joined, waiting for media to be published.`
    );

    // Initialize participantList if it doesn't exist
    if (!config.participantList) {
      config.participantList = [
        {
          uid: config.uid,
          name: config.user.name || "Unknown",
          company: config.user.company || "",
          designation: config.user.designation || "",
        },
      ];
    }

    // Check if user is already in participantList to avoid duplicates
    const userExists = config.participantList.some(
      (participant) => participant.uid === user.uid
    );

    if (!userExists) {
      // Add the new user's info to participantList
      config.participantList.push({
        uid: user.uid,
        name: userAttr.name || "Unknown",
        company: userAttr.comp || "",
        designation: userAttr.desg || "",
      });

      // Call bubble_fn_participantList with the updated lists
      if (typeof bubble_fn_participantList === "function") {
        // Extract lists from participantList
       const participantUIDs = config.participantList.map((p) =>
         p.uid.toString()
       );
       const participantNames = config.participantList.map((p) => p.name);
       const participantCompanies = config.participantList.map(
         (p) => p.company
       );
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
      }
    }
  } catch (error) {
    console.error(`Error in handleUserJoined for user ${user.uid}:`, error);
  }
};




// Handles user left event
export const handleUserLeft = async (user, config) => {
  try {
    console.log(`User ${user.uid} left`);

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

    console.log(`User ${user.uid} successfully removed`);
  } catch (error) {
    console.error(`Error removing user ${user.uid}:`, error);
  }
};




// Handles volume indicator change
export const handleVolumeIndicator = (result, config) => {
  result.forEach((volume) => {
    const userUID = volume.uid;
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
