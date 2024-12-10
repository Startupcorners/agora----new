import { updateMicStatusElement } from "./uiHandlers.js";

// Track running state for each user
let addUserWrapperRunning = {};

export const addUserWrapper = async (uid, config, isScreenSharing) => {
  const client = config.client; // Retrieve the client from config
  const rtmUid = uid.toString();

  // Check if the function is already running for the same user
  if (addUserWrapperRunning[rtmUid]) {
    console.log(`addUserWrapper is already running for user: ${uid}`);
    return;
  }

  // Set running state for the user
  addUserWrapperRunning[rtmUid] = true;

  try {
    // Check if the wrapper already exists
    if (document.querySelector(`#video-wrapper-${uid}`)) {
      console.log(`Wrapper already exists for user: ${uid}`);
      return;
    }

    // Fetch user attributes from RTM (name, avatar)
    let userAttr = {};
    if (config.clientRTM && config.clientRTM.getUserAttributes) {
      try {
        userAttr = await config.clientRTM.getUserAttributes(rtmUid);
      } catch (error) {
        console.error(`Failed to fetch user attributes for ${uid}:`, error);
        userAttr = {
          name: "Unknown",
          avatar: "default-avatar-url",
        };
      }
    }

    // Select the appropriate player container and call container based on isScreenSharing
    const participantPlayerContainer = isScreenSharing
      ? config.participantPlayerContainerScreenshare
      : config.participantPlayerContainer;

    const callContainerSelector = isScreenSharing
      ? config.callContainerSelectorScreenshare
      : config.callContainerSelector;

    // Create player HTML with user attributes (name, avatar)
    let playerHTML = participantPlayerContainer
      .replace(/{{uid}}/g, uid)
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    // Insert the player into the DOM
    document
      .querySelector(callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    console.log(`Added wrapper for user: ${uid}`);

    // Determine if the track is local or remote
    let audioTrack;
    let isActiveMic = false;

    if (uid === config.uid) {
      // Use local tracks array for the current user
      audioTrack = client.localTracks?.find(
        (track) => track.trackMediaType === "audio"
      );
      isActiveMic = audioTrack?.enabled || false; // Check if enabled for local user
    } else {
      // Use remote tracks for other users
      console.log("client.remoteUsers", client.remoteUsers);
      const remoteUser = client.remoteUsers.find(
        (user) => user.uid.toString() === uid.toString()
      );
      audioTrack = remoteUser?.audioTrack;
      isActiveMic = audioTrack?.isPlaying || false; // Check if playing for remote user
    }

    console.log(`Audio track for user ${uid}:`, audioTrack);

    // Update mic status based on the audio track
    if (isActiveMic) {
      updateMicStatusElement(uid, false); // Mic is active
      console.log(`User ${uid}'s microphone is active.`);
    } else {
      updateMicStatusElement(uid, true); // Mic is inactive
      console.log(`User ${uid}'s microphone is inactive.`);
    }

    // Update the layout based on isScreenSharing
    if (isScreenSharing) {
      updateLayout("video-stage-screenshare");
    } else {
      updateLayout("video-stage");
    }
  } catch (error) {
    console.error("Error in addUserWrapper:", error);
  } finally {
    // Reset running state for the user
    addUserWrapperRunning[rtmUid] = false;
  }
};




// Wrapper for removing users from the video stage
export const removeUserWrapper = (uid, isScreenSharing) => {
  try {
    const player = document.querySelector(`#video-wrapper-${uid}`);
    if (player) {
      player.remove(); // Remove the user's video/audio wrapper from the DOM
      console.log(`Removed player for user: ${uid}`);
    } else {
      console.log(`Player not found for user: ${uid}`);
    }
    if (isScreenSharing){
      updateLayout("video-stage-screenshare");
    } else {
      updateLayout("video-stage");
    }
  } catch (error) {
    console.log("Failed to remove user wrapper:", error);
  }
};


export const updateLayout = (videoStage) => {
  const videoStage = document.querySelector(`.${videoStageClass}`);
  if (!videoStage) {
    console.log(
      `updateLayout skipped: no element with class ${videoStageClass} found.`
    );
    return;
  }

  const participants = Array.from(videoStage.children);
  const participantCount = participants.length;
  console.log(`updateLayout called with ${participantCount} participant(s).`);

  // Remove any existing child-count-X class
  videoStage.className = videoStage.className
    .replace(/\bchild-count-\d+\b/g, "")
    .trim();
  videoStage.classList.add(`child-count-${Math.min(participantCount, 9)}`);
}
