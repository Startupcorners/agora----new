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
} from "./videoHandlers.js";
import { userTracks } from "./state.js"; 
const userJoinPromises = {};



// Handles user published event
export const handleUserPublished = async (user, mediaType, config, client) => {
  const userUid = user.uid;
  console.log(
    `handleUserPublished for user: ${userUid}, mediaType: ${mediaType}`
  );

  // Log the entire user object for debugging
  console.log("User object:", user);
  console.log("config.clientRTM", config.clientRTM);
  console.log("Remote users:", client.remoteUsers);

  // Check if the UID is 1 (indicating screen share)
  if (userUid === 1) {
    console.log(`UID 1 (screen sharing user) detected.`);

    // Fetch the RTM attributes of the screen-share client (uid = 1)
    try {
      const attributes = await config.clientRTM.getUserAttributes(1); // Fetch attributes for uid 1
      const sharingUser = attributes.sharingUser; // The actual user UID who is sharing their screen

      if (sharingUser && sharingUser !== "0") {
        console.log(`User ${sharingUser} is currently sharing their screen.`);

        // Check if the sharing user is the current user, skip subscription
        if (sharingUser === config.uid.toString()) {
          console.log(`Skipping subscription to own screen sharing media.`);
          return;
        }

        // Manage camera state for the user who is sharing their screen
        manageCameraState(sharingUser, config);

        // Switch to screen share stage
        console.log(`Toggling stages: switching to screen-share stage...`);
        toggleStages(true, sharingUser); // Show screen-share stage and hide video stage
      } else {
        console.log("No active screen sharing.");
      }
    } catch (error) {
      console.error(
        "Error fetching RTM attributes for screen-share client:",
        error
      );
    }

    return; // Stop further execution for UID 1 (screen sharing)
  }

  // Skip subscribing to your own media
  if (userUid === config.uid) {
    console.log("Skipping subscription to local user's own media.");
    return;
  }

  if (!userTracks[userUid]) {
    userTracks[userUid] = {}; // Initialize track object for the user
  }

  try {
    // Ensure handleUserJoined is completed before proceeding
    if (userJoinPromises[userUid]) {
      console.log(`Waiting for handleUserJoined to finish for user ${userUid}`);
      await userJoinPromises[userUid]; // Wait for user wrapper and elements to be ready
    }

    // Subscribe to the media type
    await client.subscribe(user, mediaType);
    console.log(
      `Successfully subscribed to ${mediaType} track for user ${userUid}`
    );

    if (mediaType === "video") {
      if (user.videoTrack) {
        userTracks[userUid].videoTrack = user.videoTrack;

        // Manage the camera state for the user (handles playing video and showing avatars)
        manageCameraState(userUid, config);
      } else {
        console.warn(
          `Subscribed to video track for user ${userUid}, but videoTrack is still undefined.`
        );
      }
    }

    if (mediaType === "audio") {
      if (user.audioTrack) {
        user.audioTrack.play();
        userTracks[userUid].audioTrack = user.audioTrack;
        console.log(`Audio track played and stored for user ${userUid}`);
      } else {
        console.warn(
          `Subscribed to audio track for user ${userUid}, but audioTrack is still undefined.`
        );
      }
    }
  } catch (error) {
    console.error(
      `Error subscribing to ${mediaType} track for user ${userUid}:`,
      error
    );
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

  // Handle video unpublishing (including screen share)
  if (mediaType === "video") {
    console.log(`User ${user.uid} has unpublished their video track.`);

    // If the unpublished video is the screen share
    if (user.uid === config.screenShareUid) {
      console.log(`Screen share track unpublished for user ${user.uid}.`);

      // Hide the screen share stage and show the main video stage again
      document.querySelector("#screen-share-stage").style.display = "none";
      document.querySelector("#video-stage").style.display = "block";

      // Remove the screen share video and PiP from the UI
      const screenShareElement = document.querySelector(
        "#screen-share-content"
      );
      const screenShareVideoElement = document.querySelector(
        "#screen-share-video"
      );

      if (screenShareElement) {
        screenShareElement.innerHTML = ""; // Clear screen share content
      }

      if (screenShareVideoElement) {
        screenShareVideoElement.innerHTML = ""; // Clear PiP content
      }

      console.log(`Removed screen share video for user ${user.uid}.`);

      // Reset screen share status
      config.screenShareUid = null;
    } else {
      // For regular video streams, remove the video tracks from the UI
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
  }

  // Handle audio unpublishing
  if (mediaType === "audio") {
    console.log(`User ${user.uid} has unpublished their audio track.`);
    toggleMicIcon(user.uid, true); // Show muted mic icon

    if (user.audioTrack) {
      user.audioTrack.stop();
    }

    // Remove audio track from remoteTracks
    if (config.remoteTracks[user.uid]) {
      delete config.remoteTracks[user.uid].audioTrack;
    }
  }
};




// Handles user joined event
export const handleUserJoined = async (user, config, userAttr = {}) => {
  const userUid = user.uid.toString();
  console.log("Entering handleUserJoined function for user:", userUid);

  // If UID is 1 (screen share UID), skip processing
  if (userUid === "1") {
    console.log("Skipping handling for screen share UID (1).");
    return;
  }

  // If the user join is already in progress or completed, return the existing promise
  if (userJoinPromises[userUid]) {
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

      // Initialize or update participant list
      if (!config.participantList) {
        config.participantList = [];
      }

      let participant = config.participantList.find((p) => p.uid === userUid);
      if (!participant) {
        participant = {
          uid: userUid,
          uids: [userUid],
          name: userAttr.name || "Unknown",
          company: userAttr.company || "",
          designation: userAttr.designation || "",
          role: user.role, // Include role
        };
        config.participantList.push(participant);
      } else if (!participant.uids.includes(userUid)) {
        participant.uids.push(userUid);
      }

      // Call bubble_fn_participantList with the updated list
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
