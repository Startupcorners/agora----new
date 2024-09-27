// eventHandlers.js
import { toggleMic, toggleCamera } from "./uiHandlers.js";
import {
  log,
  debounce,
  fetchTokens,
  sendMessageToPeer,
  sendBroadcast,
} from "./helperFunctions.js";

// Handles user published event
export const handleUserPublished = async (user, mediaType, config, client) => {
  log("handleUserPublished Here");

  // Store the user's remote tracks
  config.remoteTracks[user.uid] = user;

  // If the published media is audio, update the mic icon to "unmuted"
  if (mediaType === "audio") {
    log(`User ${user.uid} has unmuted their mic`);
    updateMicIcon(user.uid, false); // Mic is unmuted
  }

  // Subscribe to the track
  subscribe(user, mediaType, config, client);
};

// Handles user joined event
export const handleUserJoined = async (user, config, clientRTM) => {
  log("handleUserJoined Here");
  config.remoteTracks[user.uid] = user;

  const rtmUid = user.uid.toString(); // Convert UID to string for RTM operations

  try {
    // Fetch user attributes from RTM using the stringified UID
    const userAttr = await clientRTM.getUserAttributes(rtmUid);

    // Create the player HTML
    let playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.uid)
      .replace(/{{name}}/g, userAttr.name || "Unknown")
      .replace(/{{avatar}}/g, userAttr.avatar || "default-avatar-url");

    // Insert the player HTML into the DOM
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    // Hide the video player and show the avatar initially
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none";
      avatarDiv.style.display = "block";
    }
  } catch (error) {
    log("Failed to fetch user attributes:", error);
  }
};

// Handles user left event
export const handleUserLeft = async (user, config) => {
  delete config.remoteTracks[user.uid];
  const player = document.querySelector(`#video-wrapper-${user.uid}`);
  if (player) {
    player.remove();
  }

  config.onParticipantLeft(user);
};

// Handles volume indicator change
export const handleVolumeIndicator = (result, config) => {
  result.forEach((volume) => {
    config.onVolumeIndicatorChanged(volume);
  });
};

// Handles screen sharing ended event
export const handleScreenShareEnded = async (config, client) => {
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

// Handles token renewal
export const handleRenewToken = async (config, client) => {
  config.token = await fetchTokens();
  await client.renewToken(config.token);
};

// Handles message received from peer
export const handleMessageFromPeer = async (message, peerId, config) => {
  console.log("Message from peer:", peerId);
  const data = JSON.parse(message.text);
  console.log(data);

  if (data.event === "mic_off") {
    await toggleMic(true);
  } else if (data.event === "cam_off") {
    await toggleCamera(true);
  } else if (data.event === "remove_participant") {
    await leave(config, client, clientRTM);
  }
};

// Handles message from RTM channel
export const handleChannelMessage = async (message, memberId, config) => {
  console.log("Received Channel Message:", memberId);
  const messageObj = JSON.parse(message.text);

  if (
    messageObj.type === "broadcast" &&
    messageObj.event === "change_user_role"
  ) {
    if (config.uid === messageObj.targetUid) {
      await handleRoleChange(messageObj, config, clientRTM, client);
    }
    await handleOnUpdateParticipants(config, clientRTM);
    config.onRoleChanged(messageObj.targetUid, messageObj.role);
  } else {
    config.onMessageReceived(messageObj);
  }
};

// Handles role change
export const handleRoleChange = async (
  messageObj,
  config,
  clientRTM,
  client
) => {
  config.user.role = messageObj.role;
  console.log("User role changed:", config.user.role);

  await clientRTM.addOrUpdateLocalUserAttributes({ role: config.user.role });
  console.log("Updated user attributes after role change");

  await client.leave();
  await leaveFromVideoStage(config.user, config, client);
  await join(config, client, clientRTM); // Re-join the RTC
};

// Joins user to the video stage
export const joinToVideoStage = async (user, config, client) => {
  try {
    // Initialize only the audio track for now
    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    // Do not create or initialize the video track until it is explicitly turned on
    config.localVideoTrackMuted = true;

    let player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player) player.remove();

    let localPlayerContainer = config.participantPlayerContainer
      .replaceAll("{{uid}}", user.id)
      .replaceAll("{{name}}", user.name)
      .replaceAll("{{avatar}}", user.avatar);

    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", localPlayerContainer);

    if (user.id === config.uid) {
      // Publish only the audio track initially
      await client.publish([config.localAudioTrack]);

      const videoPlayer = document.querySelector(`#stream-${user.id}`);
      const avatarDiv = document.querySelector(`#avatar-${user.id}`);
      if (videoPlayer && avatarDiv) {
        videoPlayer.style.display = "none"; // Hide video player initially
        avatarDiv.style.display = "block"; // Show avatar instead
      }
    }

    // Notify the app that the camera is off
    config.onCamMuted(config.uid, config.localVideoTrackMuted);
  } catch (error) {
    config.onError(error);
  }
};



// Leaves user from the video stage
export const leaveFromVideoStage = async (user, config, client) => {
  const player = document.querySelector(`#video-wrapper-${user.id}`);
  if (player) player.remove();

  if (user.id === config.uid) {
    try {
      config.localAudioTrack.stop();
      config.localVideoTrack.stop();
      config.localAudioTrack.close();
      config.localVideoTrack.close();

      await client.unpublish([config.localAudioTrack, config.localVideoTrack]);
    } catch (error) {
      // Handle any errors
    }
  }
};

// Handles user unpublished event
export const handleUserUnpublished = async (user, mediaType, config) => {
  if (mediaType === "video") {
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
      const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);

      videoPlayer.style.display = "none";
      avatarDiv.style.display = "block";
    }
  }

  if (mediaType === "audio") {
    log(`User ${user.uid} has muted their mic`);
    updateMicIcon(user.uid, true); // Mic is muted
  }
};

// Subscribes to user's media
export const subscribe = async (user, mediaType, config, client) => {
  try {
    log(`Subscribing to user ${user.uid} for media type: ${mediaType}`);
    const rtmUid = user.uid.toString();

    let userAttr = { name: "Unknown", avatar: "default-avatar-url" };
    try {
      userAttr = await clientRTM.getUserAttributes(rtmUid);
      userAttr.name = userAttr.name || "Unknown";
      userAttr.avatar = userAttr.avatar || "default-avatar-url";
      log(
        `Fetched attributes for user ${user.uid}: ${userAttr.name}, ${userAttr.avatar}`
      );
    } catch (err) {
      log(
        `Failed to fetch attributes for user ${user.uid}, using defaults:`,
        err
      );
    }

    let player = document.querySelector(`#video-wrapper-${user.uid}`);
    if (!player) {
      let playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, user.uid)
        .replace(/{{name}}/g, userAttr.name)
        .replace(/{{avatar}}/g, userAttr.avatar);

      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", playerHTML);

      player = document.querySelector(`#video-wrapper-${user.uid}`);
    }

    const videoPlayer = player.querySelector(`#stream-${user.uid}`);
    const avatarDiv = player.querySelector(`#avatar-${user.uid}`);

    if (mediaType === "video") {
      if (user.videoTrack) {
        videoPlayer.style.display = "block";
        avatarDiv.style.display = "none";
        user.videoTrack.play(`stream-${user.uid}`);
      } else {
        videoPlayer.style.display = "none";
        avatarDiv.style.display = "block";
      }
    }

    if (mediaType === "audio") {
      if (user.audioTrack) {
        user.audioTrack.play();
      }
    }

    player.style.display = "flex";
    checkAndAddMissingWrappers(config, client);
  } catch (error) {
    log(`Error subscribing to user ${user.uid}:`, error);
  }
};

// Checks and adds missing video wrappers for participants
export const checkAndAddMissingWrappers = (config, client) => {
  const participants = client.remoteUsers || [];
  const existingWrappers = document.querySelectorAll('[id^="video-wrapper-"]');

  participants.forEach((user) => {
    const player = document.querySelector(`#video-wrapper-${user.uid}`);
    if (!player) {
      subscribe(user, "video", config, client);
    }
  });
};

// Handles RTM event listeners
export const setupRTMEventListeners = (
  clientRTM,
  channelRTM,
  config,
  client
) => {
  clientRTM.on("MessageFromPeer", (message, peerId) =>
    handleMessageFromPeer(message, peerId, config)
  );
  channelRTM.on("MemberJoined", (memberId) =>
    handleMemberJoined(memberId, config, clientRTM)
  );
  channelRTM.on("MemberLeft", (memberId) =>
    handleMemberLeft(memberId, config, clientRTM)
  );
  channelRTM.on("ChannelMessage", (message, memberId) =>
    handleChannelMessage(message, memberId, config, clientRTM, client)
  );
};

// Handles participants updates
export const handleOnUpdateParticipants = (config, clientRTM) => {
  debounce(async () => {
    try {
      const uids = await channelRTM.getMembers();
      const participants = await Promise.all(
        uids.map(async (uid) => {
          const userAttr = await clientRTM.getUserAttributes(uid);
          return { id: uid, ...userAttr };
        })
      );
      config.onParticipantsChanged(participants);
    } catch (error) {
      log(error);
    }
  }, 1000);
};


export const setupEventListeners = (client, config) => {
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // Modify the user-joined handler to trigger both immediate and full updates
  client.on("user-joined", async (user) => {
    // Call the immediate join handler
    await config.onParticipantJoined(user);

    // Continue with the existing handleUserJoined to fully update the participant list
    await handleUserJoined(user);
  });

  client.on("user-left", handleUserLeft);
  client.enableAudioVolumeIndicator();

  // Use the callback from config
  client.on("volume-indicator", (volume) => {
    if (config.onVolumeIndicatorChanged) {
      config.onVolumeIndicatorChanged(volume);
    } else {
      console.error("onVolumeIndicatorChanged is not defined in config");
    }
  });
};


export const handleMemberJoined = async (memberId) => {
  console.log(`Member joined: ${memberId}`);
  await handleOnUpdateParticipants();
};

export const handleMemberLeft = async (memberId) => {
  console.log(`Member left: ${memberId}`);
  await handleOnUpdateParticipants();
};


export const leave = async (config, client, clientRTM) => {
  document.querySelector(config.callContainerSelector).innerHTML = "";

  await Promise.all([client.leave(), clientRTM.logout()]);

  config.onUserLeave();
};

export const changeRole = (uid, role, config) => {
  const messageObj = {
    event: "change_user_role",
    targetUid: uid,
    role: role,
  };

  // Broadcast the role change to all participants
  sendBroadcast(config, messageObj);

  // Update the participant list to reflect the new role
  handleOnUpdateParticipants();

  // Call the callback to update the UI or handle role change logic
  config.onRoleChanged(uid, role);
};


export const removeParticipant = (clientRTM, ...uids) => {
  uids.forEach((uid) => {
    sendMessageToPeer(
      clientRTM, // Pass the correct clientRTM instance here
      {
        content: "",
        event: "remove_participant",
      },
      `${uid}` // Corrected to use backticks for string interpolation
    );
  });
};
