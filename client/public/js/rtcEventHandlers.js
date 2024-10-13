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

  // Wait for the wrapper to exist before proceeding
  let videoPlayer = document.querySelector(`#stream-${user.uid}`);
  if (!videoPlayer) {
    console.log(`Video player not found for user ${user.uid}.`);
    return; // If the wrapper is not found, skip further actions.
  }

  if (mediaType === "video") {
    console.log(`Attempting to subscribe to video track for user ${user.uid}`);

    try {
      await config.client.subscribe(user, mediaType);

      if (user.videoTrack && typeof user.videoTrack.play === "function") {
        console.log(`Playing video track for user ${user.uid}`);
        user.videoTrack.play(videoPlayer);

        // Ensure videoPlayer is visible
        videoPlayer.style.display = "block";

        // Hide avatar when video is available
        const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
        if (avatarDiv) {
          avatarDiv.style.display = "none";
        }
      } else {
        console.log(
          `User ${user.uid} does not have a valid video track. Showing avatar.`
        );

        // Show avatar if video track is not available
        const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
        if (avatarDiv) {
          avatarDiv.style.display = "block";
        }

        // Hide videoPlayer since no valid video track
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
        toggleMicIcon(user.uid, true);
      } else {
        console.error(
          `Audio track for user ${user.uid} is invalid or missing.`
        );
        toggleMicIcon(user.uid, false);
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
  if (user.uid === config.uid) {
    console.log("Skipping handling of local user's own media.");
    return;
  }

  if (mediaType === "video") {
    console.log(`User ${user.uid} has unpublished their video track.`);

    // Remove video tracks from UI
    const videoTracks = user.videoTracks || [user.videoTrack];
    videoTracks.forEach((track, index) => {
      const streamId = `stream-${user.uid}-${index}`;
      const videoPlayer = document.querySelector(`#${streamId}`);
      if (videoPlayer) {
        track.stop();
        videoPlayer.parentNode.removeChild(videoPlayer);
        console.log(`Removed video track ${index} for user ${user.uid}`);
      }
    });

    // Show avatar when video is unavailable
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    if (avatarDiv) {
      avatarDiv.style.display = "block";
    }

    // Remove video tracks from remoteTracks
    if (config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid].videoTracks;
    }
  }

  if (mediaType === "audio") {
    console.log(`User ${user.uid} has unpublished their audio track.`);
    toggleMicIcon(user.uid, true);

    if (user.audioTrack) {
      user.audioTrack.stop();
    }

    if (config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid].audioTrack;
    }
  }
};




// Handles user joined event
export const handleUserJoined = async (user, config, userAttr = {}) => {
  console.log("Entering handleUserJoined function for user:", user.uid);

  try {
    // Prevent handling your own stream or screen share
    if (
      user.uid === config.uid ||
      user.uid === config.screenShareUid ||
      user.uid === config.uid + 100000 // For numeric screen share UID
    ) {
      console.log(
        `Skipping wrapper for own user or screen share UID: ${user.uid}`
      );
      return; // Exit early for own stream or screen share
    }

    // Convert UID to string
    const userUid = user.uid.toString();

    // If userAttr is empty, attempt to fetch attributes
    if (!userAttr || Object.keys(userAttr).length === 0) {
      if (config.clientRTM) {
        try {
          userAttr = await config.clientRTM.getUserAttributes(userUid);
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

    // Assign the role to the user object
    user.role = userAttr.role || "audience";

    // Only proceed if the user is a host
    if (user.role !== "host") {
      console.warn(
        `User ${userUid} does not have the 'host' role. Skipping wrapper.`
      );
      return; // Exit if the user is not a host
    }

    // Initialize remoteTracks if it's undefined
    if (!config.remoteTracks) {
      config.remoteTracks = {};
    }

    // Store user in remoteTracks (no media yet)
    config.remoteTracks[userUid] = user;

    // Check if the video-wrapper exists; if not, create it
    let participantWrapper = document.querySelector(
      `#video-wrapper-${userUid}`
    );
    if (!participantWrapper) {
      // Add the wrapper for the user (if not screen share UID)
      await addUserWrapper({ uid: userUid, ...userAttr }, config);
      console.log(`Wrapper added for user: ${userUid}`);
    } else {
      console.log(`Wrapper already exists for user: ${userUid}`);
    }

    console.log(
      `Host user ${userUid} joined, waiting for media to be published.`
    );

    // Initialize participantList if it doesn't exist
    if (!config.participantList) {
      config.participantList = [];
    }

    // Check if participant already exists in participantList
    let participant = config.participantList.find((p) => p.uid === userUid);

    if (!participant) {
      // Add the new user's info to participantList
      participant = {
        uid: userUid,
        uids: [userUid],
        name: userAttr.name || "Unknown",
        company: userAttr.company || "",
        designation: userAttr.designation || "",
        role: user.role, // Include role
      };
      config.participantList.push(participant);
    } else {
      // Add the new UID to the participant's uids array if not already present
      if (!participant.uids.includes(userUid)) {
        participant.uids.push(userUid);
      }
    }

    // Call bubble_fn_participantList with the updated participant list
    if (typeof bubble_fn_participantList === "function") {
      const participantData = config.participantList.map((p) => ({
        uid: p.uid,
        uids: p.uids,
        name: p.name,
        company: p.company,
        designation: p.designation,
        role: p.role,
      }));

      bubble_fn_participantList({ participants: participantData });
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
