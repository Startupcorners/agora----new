// rtcEventHandlers.js
import { log, fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { toggleVideoOrAvatar, toggleMicIcon } from "./updateWrappers.js";



// Handles user published event
export const handleUserPublished = async (user, mediaType, config) => {
  const userUid = user.uid.toString();
  console.log(
    `handleUserPublished for user: ${userUid}, mediaType: ${mediaType}`
  );

  // Check if the userUid is the screen share UID (RTC) and if the current user is the one sharing
  if (
    userUid === config.screenShareUid.toString() &&
    config.uid.toString() ===
      (config.rtmAttributes?.uidSharingScreen || "").toString()
  ) {
    console.log("User is the current screen sharer. Skipping subscription.");
    return; // Skip the subscription to avoid handling the screen share twice for the same user
  }

  // Ensure remoteTracks is initialized
  if (!config.remoteTracks) {
    config.remoteTracks = {};
  }

  // Handle screen sharing for other users (if the screen share UID matches)
  if (userUid === config.screenShareUid.toString()) {
    let screenShareElement = document.querySelector("#screen-share-content");
    let screenShareVideo = document.querySelector("#screen-share-video"); // For PiP

    if (!screenShareElement) {
      console.log("Screen share element not found.");
      return;
    }

    if (mediaType === "video") {
      try {
        await config.client.subscribe(user, mediaType);
        if (user.videoTrack && typeof user.videoTrack.play === "function") {
          console.log(`Playing screen share track for user ${userUid}`);

          // Play the screen share video in the main screen share area
          user.videoTrack.play(screenShareElement);

          // Play the PiP video (person sharing their screen) in the bottom-right
          if (screenShareVideo && user.videoTrack) {
            console.log(
              `Playing PiP video for screen share of user ${userUid}`
            );
            user.videoTrack.play(screenShareVideo); // Play PiP
          }

          // Display the screen share stage, hide the main video stage
          document.querySelector("#screen-share-stage").style.display = "block";
          document.querySelector("#video-stage").style.display = "none";
        }
      } catch (error) {
        console.error(
          `Error subscribing to screen share track for user ${userUid}:`,
          error
        );
      }
    }
    return; // Exit early after handling screen share
  }

  // Handle regular media publishing (non-screen share)
  let videoPlayer = document.querySelector(`#stream-${userUid}`);
  if (!videoPlayer) {
    console.log(`Video player not found for user ${userUid}.`);
    return;
  }

  if (mediaType === "video") {
    try {
      await config.client.subscribe(user, mediaType);
      if (user.videoTrack && typeof user.videoTrack.play === "function") {
        console.log(`Playing video track for user ${userUid}`);
        user.videoTrack.play(videoPlayer);

        videoPlayer.style.display = "block"; // Show video player

        const avatarDiv = document.querySelector(`#avatar-${userUid}`);
        if (avatarDiv) {
          avatarDiv.style.display = "none"; // Hide avatar when video is available
        }
      } else {
        console.log(
          `User ${userUid} does not have a valid video track. Showing avatar.`
        );
        const avatarDiv = document.querySelector(`#avatar-${userUid}`);
        if (avatarDiv) {
          avatarDiv.style.display = "block"; // Show avatar if no valid video track
        }
        videoPlayer.style.display = "none"; // Hide video player
      }
    } catch (error) {
      console.error(
        `Error subscribing to video track for user ${userUid}:`,
        error
      );
    }
  }

  if (mediaType === "audio") {
    try {
      await config.client.subscribe(user, mediaType);
      if (user.audioTrack && typeof user.audioTrack.play === "function") {
        console.log(`Playing audio track for user ${userUid}`);
        user.audioTrack.play();
        toggleMicIcon(userUid, false); // Mic is on
      } else {
        console.error(`Audio track for user ${userUid} is invalid or missing.`);
        toggleMicIcon(userUid, true); // Mic is off
      }
    } catch (error) {
      console.error(`Error playing audio track for user ${userUid}:`, error);
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
    const userUid = user.uid.toString();

    // Prevent handling your own stream or screen share
    if (
      userUid === config.uid.toString() ||
      userUid === config.screenShareUid ||
      userUid === (config.uid + 100000).toString() // For numeric screen share UID
    ) {
      console.log(
        `Skipping wrapper for own user or screen share UID: ${userUid}`
      );
      return; // Exit early for own stream or screen share
    }

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
