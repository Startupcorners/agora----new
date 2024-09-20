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
  result.forEach((volume, index) => {
    config.onVolumeIndicatorChanged(volume);
  });
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
      const uids = await config.channelRTM.getMembers();
      const participants = await Promise.all(
        uids.map(async (uid) => {
          const userAttr = await config.clientRTM.getUserAttributes(uid);
          return {
            id: uid,
            ...userAttr,
          };
        })
      );
      config.onParticipantsChanged(participants);
    } catch (error) {
      log(error, config);
    }
  };

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