// eventHandlers.js
import { log, debounce } from "./utils.js";

export const handleUserPublished =
  (config, client) => async (user, mediaType) => {
    console.log("User published:", user.uid, "Media Type:", mediaType);

    await client.subscribe(user, mediaType);
    console.log("Subscribed to user:", user.uid, "Media Type:", mediaType);

    if (mediaType === "video" || mediaType === "screen") {
      let playerId = `stream-${user.uid}`;
      let player = document.querySelector(`#video-wrapper-${user.uid}`);
      if (!player) {
        // Create the player if it doesn't exist
        const userAttr = await config.clientRTM.getUserAttributes(
          user.uid.toString()
        );

        // Replace placeholders in the template
        let playerHTML = config.participantPlayerContainer
          .replace(/{{uid}}/g, user.uid)
          .replace(/{{name}}/g, userAttr.name || "Unknown")
          .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

        document
          .querySelector(config.callContainerSelector)
          .insertAdjacentHTML("beforeend", playerHTML);

        player = document.querySelector(`#video-wrapper-${user.uid}`);
      }

      // Hide avatar and show video player
      const videoPlayer = player.querySelector(`#stream-${user.uid}`);
      const avatarDiv = player.querySelector(`#avatar-${user.uid}`);

      videoPlayer.style.display = "block"; // Show the video player
      avatarDiv.style.display = "none"; // Hide the avatar

      // Play the video track for the user
      user.videoTrack.play(playerId);
    }

    if (mediaType === "audio") {
      user.audioTrack.play();
    }
  };

export const handleUserUnpublished = (config) => async (user, mediaType) => {
  if (mediaType === "video") {
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
      const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);

      videoPlayer.style.display = "none"; // Hide the video player
      avatarDiv.style.display = "block"; // Show the avatar
    }
  }
};

export const handleUserJoined = (config) => async (user) => {
  log("handleUserJoined Here", config);
  config.remoteTracks[user.uid] = user;

  const rtmUid = user.uid.toString(); // Convert UID to string for RTM operations

  try {
    // Fetch user attributes from RTM using the stringified UID
    const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

    // Use the integer UID for the wrapper and player
    let playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.uid) // Integer UID for the video wrapper
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    const player = document.querySelector(`#video-wrapper-${user.uid}`); // Integer UID

    // Hide the video player and show the avatar since the user hasn't published video
    const videoPlayer = document.querySelector(`#stream-${user.uid}`); // Integer UID
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`); // Integer UID
    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none"; // Hide the video player
      avatarDiv.style.display = "block"; // Show the avatar
    }
  } catch (error) {
    log("Failed to fetch user attributes:", config);
    log(error, config);
  }
};

export const handleUserLeft = (config) => async (user, reason) => {
  delete config.remoteTracks[user.uid];
  if (document.querySelector(`#video-wrapper-${user.uid}`)) {
    document.querySelector(`#video-wrapper-${user.uid}`).remove();
  }
  config.onParticipantLeft(user);
};

export const handleVolumeIndicator = (config) => (result) => {
  result.forEach((volume, index) => {
    config.onVolumeIndicatorChanged(volume);
  });
};

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

  // Debounce the function to avoid too many calls
  const debouncedUpdateParticipants = debounce(updateParticipants, 1000);

  return debouncedUpdateParticipants;
};

export const handleRenewToken = (config, client) => async () => {
  config.token = await fetchToken(config);
  await client.renewToken(config.token);
};
