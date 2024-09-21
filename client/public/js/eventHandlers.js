import { log, debounce } from "./utils.js";

// Function to handle when a user publishes their media
export const handleUserPublished =
  (config, client) => async (user, mediaType) => {
    console.log("User published:", user.uid, "Media Type:", mediaType);
    await client.subscribe(user, mediaType);
    console.log("Subscribed to user:", user.uid, "Media Type:", mediaType);

    if (mediaType === "video" || mediaType === "screen") {
      let playerId = `stream-${user.uid}`;
      let player = document.querySelector(`#video-wrapper-${user.uid}`);
      if (!player) {
        const userAttr = await config.clientRTM.getUserAttributes(
          user.uid.toString()
        );
        let playerHTML = config.participantPlayerContainer
          .replace(/{{uid}}/g, user.uid)
          .replace(/{{name}}/g, userAttr.name || "Unknown")
          .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

        document
          .querySelector(config.callContainerSelector)
          .insertAdjacentHTML("beforeend", playerHTML);
        player = document.querySelector(`#video-wrapper-${user.uid}`);
      }

      const videoPlayer = player.querySelector(`#stream-${user.uid}`);
      const avatarDiv = player.querySelector(`#avatar-${user.uid}`);
      videoPlayer.style.display = "block";
      avatarDiv.style.display = "none";

      user.videoTrack.play(playerId);
    }

    if (mediaType === "audio") {
      user.audioTrack.play();
    }
  };

// Function to handle when a user unpublishes their media
export const handleUserUnpublished = (config) => async (user, mediaType) => {
  if (mediaType === "video") {
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
      const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);
      videoPlayer.style.display = "none";
      avatarDiv.style.display = "block";
    }
  }
};

// Function to handle when a user joins
export const handleUserJoined = (config) => async (user) => {
  log("handleUserJoined Here", config);
  config.remoteTracks[user.uid] = user;

  const rtmUid = user.uid.toString();
  try {
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);
    let playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.uid)
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    const player = document.querySelector(`#video-wrapper-${user.uid}`);
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    videoPlayer.style.display = "none";
    avatarDiv.style.display = "block";
  } catch (error) {
    log("Failed to fetch user attributes:", config);
    log(error, config);
  }
};

// Function to handle when a user leaves
export const handleUserLeft = (config) => async (user, reason) => {
  delete config.remoteTracks[user.uid];
  if (document.querySelector(`#video-wrapper-${user.uid}`)) {
    document.querySelector(`#video-wrapper-${user.uid}`).remove();
  }
  config.onParticipantLeft(user);
};

// Function to handle volume indicators
export const handleVolumeIndicator = (config) => (result) => {
  console.log("Volume Indicator Result:", result);
};

// Function to handle when screen sharing ends
export const handleScreenShareEnded = (config, client) => async () => {
  config.localScreenShareTrack.stop();
  config.localScreenShareTrack.close();
  client.unpublish([config.localScreenShareTrack]);
  config.localScreenShareTrack = null;

  config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
  client.publish([config.localVideoTrack]);
  config.localVideoTrack.play(`stream-${config.uid}`);

  config.localScreenShareEnabled = false;
  config.onScreenShareEnabled(config.localScreenShareEnabled);
};

// Function to update participants
export const handleOnUpdateParticipants = (config) => {
  const updateParticipants = async () => {
    try {
      // Ensure the RTM channel is initialized before trying to get members
      if (!config.channelRTM) {
        throw new Error("RTM Channel is not initialized.");
      }

      // Ensure the channel has been joined before fetching members
      const channelMembers = await config.channelRTM.getMembers();
      const participants = await Promise.all(
        channelMembers.map(async (uid) => {
          const userAttr = await config.clientRTM.getUserAttributes(uid);
          return {
            id: uid,
            ...userAttr,
          };
        })
      );

      // Call the callback that updates the participants list in the app
      config.onParticipantsChanged(participants);
    } catch (error) {
      console.error("Error in updating participants:", error);
    }
  };

  // Debounced update
  const debouncedUpdateParticipants = debounce(updateParticipants, 1000);
  return debouncedUpdateParticipants;
};




// Function to handle microphone muting
export const handleMicMuted = (config) => (isMuted) => {
  console.log(
    `Microphone muted for UID ${config.uid}: ${isMuted ? "Mic Off" : "Mic On"}`
  );
  const micStatusIcon = document.querySelector(`#mic-status-${config.uid}`);
  if (micStatusIcon) {
    micStatusIcon.style.display = isMuted ? "block" : "none";
  }
  bubble_fn_isMicOff(isMuted);
};

// Function to handle camera muting
export const handleCamMuted = (config) => (uid, isMuted) => {
  console.log(
    `Camera muted for UID ${uid}: ${isMuted ? "Camera Off" : "Camera On"}`
  );
  const videoWrapper = document.querySelector(`#video-wrapper-${uid}`);
  if (videoWrapper) {
    const videoPlayer = videoWrapper.querySelector(`#stream-${uid}`);
    const avatarDiv = videoWrapper.querySelector(`#avatar-${uid}`);
    if (isMuted) {
      videoPlayer.style.display = "none";
      avatarDiv.style.display = "block";
    } else {
      videoPlayer.style.display = "block";
      avatarDiv.style.display = "none";
    }
  }
  bubble_fn_isCamOff(isMuted);
};

// Function to handle screen sharing state
export const handleScreenShareEnabled = (config) => (enabled) => {
  console.log(`Screen share status: ${enabled ? "Sharing" : "Not sharing"}`);
  bubble_fn_isScreenOff(enabled);
};

// Function to handle camera changes
export const handleCameraChanged = (config) => (info) => {
  console.log("Camera changed!", info.state, info.device);
};

// Function to handle microphone changes
export const handleMicrophoneChanged = (config) => (info) => {
  console.log("Microphone changed!", info.state, info.device);
};

// Function to handle speaker changes
export const handleSpeakerChanged = (config) => (info) => {
  console.log("Speaker changed!", info.state, info.device);
};

// Function to handle when the role changes
export const handleRoleChanged = (config) => async (targetUid, role) => {
  console.log(`Role changed for UID ${targetUid}, new role: ${role}`);
};

// Function to handle joining the video stage
export const handleNeedJoinToVideoStage = (config) => (user) => {
  console.log(`onNeedJoinToVideoStage: ${user}`);
  return user.role !== "audience";
};

// Function to handle muting camera and mic
export const handleNeedMuteCameraAndMic = (config) => (user) => {
  console.log(`Default onNeedMuteCameraAndMic for user: ${user.id}`);
  return false; // Default behavior, not muting mic or camera
};

// Function to handle errors
export const handleError = (config) => (error) => {
  console.error("Error occurred:", error);
};

export const handleRenewToken = (config, client) => async () => {
  try {
    config.token = await fetchToken(config);
    await client.renewToken(config.token);
    console.log("Token renewed successfully");
  } catch (error) {
    console.error("Failed to renew token:", error);
  }
};

export const handleMessageReceived = (config) => (message) => {
  console.log("Message received:", message);
  // You can add more logic here based on your app's needs
};

export const handleUserLeave = (config) => async (user, reason) => {
  delete config.remoteTracks[user.uid];
  if (document.querySelector(`#video-wrapper-${user.uid}`)) {
    document.querySelector(`#video-wrapper-${user.uid}`).remove();
  }
  config.onParticipantLeft(user); // Call the `onParticipantLeft` handler in the config if needed
};

export const handleMuteCameraAndMic = (config) => async (user, isMuted) => {
  console.log(
    `handleMuteCameraAndMic called for user: ${user.id}, isMuted: ${isMuted}`
  );

  if (!user.id) {
    console.error("User ID is undefined, cannot mute/unmute camera and mic.");
    return;
  }

  const videoWrapper = document.querySelector(`#video-wrapper-${user.id}`);
  if (!videoWrapper) {
    console.error(`No video wrapper found for UID: ${user.id}`);
    return;
  }

  const videoPlayer = videoWrapper.querySelector(`#stream-${user.id}`);
  const avatarDiv = videoWrapper.querySelector(`#avatar-${user.id}`);

  // If camera and mic are muted, hide video and show avatar
  if (isMuted) {
    if (videoPlayer) {
      videoPlayer.style.display = "none"; // Hide the video player
    }
    if (avatarDiv) {
      avatarDiv.style.display = "block"; // Show the avatar
    }
  } else {
    // If unmuted, show video and hide avatar
    if (videoPlayer) {
      videoPlayer.style.display = "block"; // Show the video player
    }
    if (avatarDiv) {
      avatarDiv.style.display = "none"; // Hide the avatar
    }
  }

  // Optionally, you can send the mute state to another service or log it
  console.log(
    `Camera and Mic are now ${isMuted ? "muted" : "unmuted"} for user: ${
      user.id
    }`
  );
};

export const handleJoinToVideoStage = (config) => async (user) => {
  try {
    console.log("Joining video stage for user:", user.id);

    // Create local audio and video tracks
    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    // Handle muting camera and microphone if needed
    if (config.onNeedMuteCameraAndMic(user)) {
      await config.localVideoTrack.setMuted(true); // Mute camera
      await config.localAudioTrack.setMuted(true); // Mute microphone
    }

    // Remove old participant container, if it exists
    const existingWrapper = document.querySelector(`#video-wrapper-${user.id}`);
    if (existingWrapper) {
      existingWrapper.remove(); // Remove old video wrapper
    }

    // Generate the participant HTML template
    let participantHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.id)
      .replace(/{{name}}/g, user.name || "Guest User")
      .replace(/{{avatar}}/g, user.avatar || "path/to/default-avatar.png");

    // Insert the new template into the container
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", participantHTML);

    // Play the video track in the correct stream element
    const videoElement = document.querySelector(`#stream-${user.id}`);
    if (config.localVideoTrack && videoElement) {
      config.localVideoTrack.play(videoElement);
    }

    // Publish the local audio and video tracks
    await config.client.publish([
      config.localAudioTrack,
      config.localVideoTrack,
    ]);

    console.log("User joined video stage:", user.id);
  } catch (error) {
    console.error("Error in handleJoinToVideoStage:", error);
    if (config.onError) {
      config.onError(error);
    }
  }
};
