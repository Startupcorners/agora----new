/**
 * Please include Agora SDK scripts in your HTML file since this code does not use Node.js import modules.
 * <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
 * <script src="https://cdn.jsdelivr.net/npm/agora-rtm-sdk@1.3.1/index.js"></script>
 * <script src="https://unpkg.com/agora-extension-virtual-background@1.2.0/agora-extension-virtual-background.js"></script>
 */

const MainApp = function (initConfig) {
  // Default Configuration
  const defaultConfig = {
    debugEnabled: true,
    callContainerSelector: null,
    participantPlayerContainer: null,
    appId: null,
    uid: null,
    user: {
      uid: null,
      name: "guest",
      avatar:
        "https://ui-avatars.com/api/?background=random&color=fff&name=loading",
      role: "", // host, speaker, audience
      company: "",
      profileLink: "",
    },
    serverUrl: null,
    token: null,
    channelName: null,
    localAudioTrack: null,
    localVideoTrack: null,
    localScreenShareTrack: null,
    localScreenShareEnabled: false,
    localAudioTrackMuted: false,
    localVideoTrackMuted: false,
    isVirtualBackgroundEnabled: false,
    remoteTracks: {},
    onParticipantsChanged: (participants) => {
      log("onParticipantsChanged");
      log(participants);
    },
    onParticipantLeft: (user) => {
      log("onParticipantLeft");
      log(user);
    },
    onVolumeIndicatorChanged: (volume) => {
      log("onVolumeIndicatorChanged");
      log(volume);
    },
    onMessageReceived: (messageObj) => {
      log("onMessageReceived");
      log(messageObj.sender);
      log(messageObj.content);
    },
    onMicMuted: (isMuted) => {
      log("onMicMuted");
      log(isMuted);
    },
    onCamMuted: (isMuted) => {
      log("onCamMuted");
      log(isMuted);
    },
    onScreenShareEnabled: (enabled) => {
      log("onScreenShareEnabled");
      log(enabled);
    },
    onUserLeave: () => {
      log("onUserLeave");
    },
    onCameraChanged: (info) => {
      log("camera changed!", info.state, info.device);
    },
    onMicrophoneChanged: (info) => {
      log("microphone changed!", info.state, info.device);
    },
    onSpeakerChanged: (info) => {
      log("speaker changed!", info.state, info.device);
    },
    onRoleChanged: (uid, role) => {
      log(`current uid: ${uid} role: ${role}`);
    },
    onNeedJoinToVideoStage: (user) => {
      log(`onNeedJoinToVideoStage: ${user}`);
      return true;
    },
    onNeedMuteCameraAndMic: (user) => {
      log(`onNeedMuteCameraAndMic: ${user}`);
      return false;
    },
    onError: (error) => {
      log(`onError: ${error}`);
    },
  };

  // Merge Initial Config with Default Config
  const config = { ...defaultConfig, ...initConfig };

  // Validate Required Configurations
  if (typeof config.appId !== "string" || !config.appId.trim()) {
    throw new Error("Invalid appId provided.");
  }
  if (
    typeof config.callContainerSelector !== "string" ||
    !config.callContainerSelector.trim()
  ) {
    throw new Error("Invalid callContainerSelector provided.");
  }
  if (typeof config.serverUrl !== "string" || !config.serverUrl.trim()) {
    throw new Error("Invalid serverUrl provided.");
  }
  if (
    typeof config.participantPlayerContainer !== "string" ||
    !config.participantPlayerContainer.trim()
  ) {
    throw new Error("Invalid participantPlayerContainer provided.");
  }
  if (typeof config.channelName !== "string" || !config.channelName.trim()) {
    throw new Error("Invalid channelName provided.");
  }
  if (typeof config.uid !== "string" || !config.uid.trim()) {
    throw new Error("Invalid uid provided.");
  }

  // Agora Initialization
  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
  const clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });
  const channelRTM = clientRTM.createChannel(config.channelName);

  AgoraRTC.setLogLevel(
    config.debugEnabled ? AgoraRTC.LOG_LEVEL.DEBUG : AgoraRTC.LOG_LEVEL.NONE
  );

  // Virtual Background Extension
  const extensionVirtualBackground = new VirtualBackgroundExtension();
  if (!extensionVirtualBackground.checkCompatibility()) {
    log("Does not support Virtual Background!");
  }
  AgoraRTC.registerExtensions([extensionVirtualBackground]);
  let processor = null;

  // Utility Functions
  const log = (arg) => {
    if (config.debugEnabled) {
      console.log(arg);
    }
  };

  const debounce = (fn, delay) => {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  // Token Fetching
  const fetchToken = async () => {
    if (config.serverUrl) {
      try {
        const res = await fetch(
          `${config.serverUrl}/access_token?channelName=${config.channelName}&uid=${config.uid}`
        );
        const json = await res.json();
        config.token = json.token;
        return json.token;
      } catch (err) {
        config.onError(err);
        return null;
      }
    } else {
      return config.token;
    }
  };

  // Event Listener Registration
  const initializeEventListeners = () => {
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.enableAudioVolumeIndicator();
    client.on("volume-indicator", handleVolumeIndicator);

    client.on("token-privilege-will-expire", handleRenewToken);

    AgoraRTC.onCameraChanged = config.onCameraChanged;
    AgoraRTC.onMicrophoneChanged = config.onMicrophoneChanged;
    AgoraRTC.onPlaybackDeviceChanged = config.onSpeakerChanged;
  };

  const removeEventListeners = () => {
    client.off("user-published", handleUserPublished);
    client.off("user-unpublished", handleUserUnpublished);
    client.off("user-joined", handleUserJoined);
    client.off("user-left", handleUserLeft);
    client.off("volume-indicator", handleVolumeIndicator);

    client.off("token-privilege-will-expire", handleRenewToken);

    AgoraRTC.onCameraChanged = null;
    AgoraRTC.onMicrophoneChanged = null;
    AgoraRTC.onPlaybackDeviceChanged = null;
  };

  // Main Functions
  const join = async () => {
    try {
      await joinRTM();

      await client.setClientRole(
        config.user.role === "audience" ? "audience" : "host"
      );

      initializeEventListeners();

      const token = await fetchToken();
      await client.join(config.appId, config.channelName, token, config.uid);

      if (config.onNeedJoinToVideoStage(config.user)) {
        await joinToVideoStage(config.user);
      }
    } catch (error) {
      config.onError(error);
    }
  };

  const leave = async () => {
    try {
      // Stop and close local tracks
      if (config.localAudioTrack) {
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
      }
      if (config.localVideoTrack) {
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
      }
      if (config.localScreenShareTrack) {
        config.localScreenShareTrack.stop();
        config.localScreenShareTrack.close();
      }

      document.querySelector(config.callContainerSelector).innerHTML = "";

      await Promise.all([client.leave(), clientRTM.logout()]);

      removeEventListeners();

      config.onUserLeave();
    } catch (error) {
      config.onError(error);
    }
  };

  const joinToVideoStage = async (user) => {
    try {
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      if (config.onNeedMuteCameraAndMic(user)) {
        await toggleCamera(true);
        await toggleMic(true);
      }

      const playerId = `#video-wrapper-${user.uid}`;
      let player = document.querySelector(playerId);
      if (player) {
        player.remove();
      }

      await createParticipantUI(user.uid);

      if (user.uid === config.uid) {
        config.localVideoTrack.play(`stream-${user.uid}`);
        await client.publish([config.localAudioTrack, config.localVideoTrack]);
      }
    } catch (error) {
      config.onError(error);
    }
  };

  const leaveFromVideoStage = async (user) => {
    try {
      const playerId = `#video-wrapper-${user.uid}`;
      let player = document.querySelector(playerId);
      if (player) {
        player.remove();
      }

      if (user.uid === config.uid) {
        if (config.localAudioTrack) {
          config.localAudioTrack.stop();
          config.localAudioTrack.close();
        }
        if (config.localVideoTrack) {
          config.localVideoTrack.stop();
          config.localVideoTrack.close();
        }

        await client.unpublish([
          config.localAudioTrack,
          config.localVideoTrack,
        ]);
      }
    } catch (error) {
      config.onError(error);
    }
  };

  const joinRTM = async () => {
    try {
      await clientRTM.login({ uid: config.uid });

      await clientRTM.addOrUpdateLocalUserAttributes(config.user);

      await channelRTM.join();
      handleOnUpdateParticipants();

      clientRTM.on("MessageFromPeer", handleMessageFromPeer);
      channelRTM.on("MemberJoined", handleOnUpdateParticipants);
      channelRTM.on("MemberLeft", handleOnUpdateParticipants);
      channelRTM.on("ChannelMessage", handleChannelMessage);
    } catch (error) {
      config.onError(error);
    }
  };

  const toggleMic = async (isMuted) => {
    if (config.localAudioTrack) {
      await config.localAudioTrack.setMuted(isMuted);
      config.localAudioTrackMuted = isMuted;
      config.onMicMuted(config.localAudioTrackMuted);
    } else {
      config.onError(new Error("Local audio track is not initialized."));
    }
  };

  const toggleCamera = async (isMuted) => {
    if (config.localVideoTrack) {
      await config.localVideoTrack.setMuted(isMuted);
      config.localVideoTrackMuted = isMuted;
      config.onCamMuted(config.localVideoTrackMuted);
    } else {
      config.onError(new Error("Local video track is not initialized."));
    }
  };

  const toggleScreenShare = async (isEnabled) => {
    if (isEnabled) {
      try {
        if (config.localVideoTrack) {
          config.localVideoTrack.stop();
          config.localVideoTrack.close();
          await client.unpublish([config.localVideoTrack]);
        }

        config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
        config.localScreenShareTrack.on("track-ended", handleScreenShareEnded);

        await client.publish([config.localScreenShareTrack]);
        config.localScreenShareTrack.play(`stream-${config.uid}`);

        config.localScreenShareEnabled = true;
        config.onScreenShareEnabled(config.localScreenShareEnabled);
      } catch (e) {
        config.onError(e);
        if (config.localScreenShareTrack) {
          config.localScreenShareTrack.stop();
          config.localScreenShareTrack.close();
          config.localScreenShareTrack = null;
        }

        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await client.publish([config.localVideoTrack]);
        config.localVideoTrack.play(`stream-${config.uid}`);

        config.localScreenShareEnabled = false;
        config.onScreenShareEnabled(config.localScreenShareEnabled);
      }
    } else {
      try {
        if (config.localScreenShareTrack) {
          config.localScreenShareTrack.stop();
          config.localScreenShareTrack.close();
          await client.unpublish([config.localScreenShareTrack]);
          config.localScreenShareTrack = null;
        }

        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await client.publish([config.localVideoTrack]);
        config.localVideoTrack.play(`stream-${config.uid}`);

        config.localScreenShareEnabled = false;
        config.onScreenShareEnabled(config.localScreenShareEnabled);
      } catch (error) {
        config.onError(error);
      }
    }
  };

  const turnOffMic = async (...uids) => {
    for (const uid of uids) {
      await sendMessageToPeer({ event: "mic_off" }, uid);
    }
  };

  const turnOffCamera = async (...uids) => {
    for (const uid of uids) {
      await sendMessageToPeer({ event: "cam_off" }, uid);
    }
  };

  const removeParticipant = async (...uids) => {
    for (const uid of uids) {
      await sendMessageToPeer({ event: "remove_participant" }, uid);
    }
  };

  const changeRole = async (uid, role) => {
    const messageObj = {
      event: "change_user_role",
      targetUid: uid,
      role: role,
    };
    await sendBroadcast(messageObj);
    handleOnUpdateParticipants();
    config.onRoleChanged(uid, role);
  };

  const getCameras = async () => {
    try {
      return await AgoraRTC.getCameras();
    } catch (error) {
      config.onError(error);
      return [];
    }
  };

  const getMicrophones = async () => {
    try {
      return await AgoraRTC.getMicrophones();
    } catch (error) {
      config.onError(error);
      return [];
    }
  };

  const switchCamera = async (deviceId) => {
    try {
      if (config.localVideoTrack) {
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
        await client.unpublish([config.localVideoTrack]);
      }

      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: deviceId,
      });
      await client.publish([config.localVideoTrack]);
      config.localVideoTrack.play(`stream-${config.uid}`);
    } catch (error) {
      config.onError(error);
    }
  };

  const switchMicrophone = async (deviceId) => {
    try {
      if (config.localAudioTrack) {
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
        await client.unpublish([config.localAudioTrack]);
      }

      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: deviceId,
      });
      await client.publish([config.localAudioTrack]);
    } catch (error) {
      config.onError(error);
    }
  };

  // Virtual Background Functions
  const getProcessorInstance = async () => {
    if (!processor && config.localVideoTrack) {
      processor = extensionVirtualBackground.createProcessor();

      try {
        await processor.init();
        config.localVideoTrack
          .pipe(processor)
          .pipe(config.localVideoTrack.processorDestination);
      } catch (e) {
        config.onError("Fail to load WASM resource!");
        processor = null;
      }
    }
    return processor;
  };

  const enableVirtualBackgroundBlur = async () => {
    if (config.localVideoTrack) {
      const processor = await getProcessorInstance();
      if (processor) {
        processor.setOptions({ type: "blur", blurDegree: 2 });
        await processor.enable();
        config.isVirtualBackgroundEnabled = true;
      }
    }
  };

  const enableVirtualBackgroundImage = async (imageSrc) => {
    if (config.localVideoTrack) {
      const imgElement = new Image();
      imgElement.onload = async () => {
        const processor = await getProcessorInstance();
        if (processor) {
          processor.setOptions({ type: "img", source: imgElement });
          await processor.enable();
          config.isVirtualBackgroundEnabled = true;
        }
      };

      imgElement.onerror = () => {
        config.onError("Failed to load background image.");
      };

      imgElement.src = imageSrc;
    }
  };

  const disableVirtualBackground = async () => {
    const processor = await getProcessorInstance();
    if (processor) {
      processor.disable();
      config.isVirtualBackgroundEnabled = false;
    }
  };

  // Messaging Functions
  const sendChat = async (data) => {
    const messageObj = {
      ...data,
      type: "chat",
      sender: config.user,
    };
    await sendMessage(messageObj);
    config.onMessageReceived(messageObj);
  };

  const sendBroadcast = async (data) => {
    const messageObj = {
      ...data,
      type: "broadcast",
      sender: config.user,
    };
    await sendMessage(messageObj);
    config.onMessageReceived(messageObj);
  };

  const sendMessageToPeer = async (data, uid) => {
    try {
      await clientRTM.sendMessageToPeer({ text: JSON.stringify(data) }, uid);
    } catch (error) {
      config.onError(error);
    }
  };

  const sendMessage = async (data) => {
    try {
      await channelRTM.sendMessage({ text: JSON.stringify(data) });
    } catch (error) {
      config.onError(error);
    }
  };

  // Callback Handlers
  const handleUserPublished = async (user, mediaType) => {
    try {
      config.remoteTracks[user.uid] = user;
      await subscribe(user, mediaType);
    } catch (error) {
      config.onError(error);
    }
  };

  const handleUserUnpublished = async (user, mediaType) => {
    if (mediaType === "video") {
      toggleAvatarDisplay(user.uid, true);
    }
  };

  const handleUserJoined = async (user) => {
    config.remoteTracks[user.uid] = user;

    if (!document.querySelector(`#video-wrapper-${user.uid}`)) {
      await createParticipantUI(user.uid);
      toggleAvatarDisplay(user.uid, true);
    }
  };

  const handleUserLeft = async (user) => {
    delete config.remoteTracks[user.uid];
    const playerId = `#video-wrapper-${user.uid}`;
    if (document.querySelector(playerId)) {
      document.querySelector(playerId).remove();
    }
    config.onParticipantLeft(user);
  };

  const handleVolumeIndicator = (volumes) => {
    volumes.forEach((volume) => {
      config.onVolumeIndicatorChanged(volume);
    });
  };

  const handleScreenShareEnded = async () => {
    try {
      if (config.localScreenShareTrack) {
        config.localScreenShareTrack.stop();
        config.localScreenShareTrack.close();
        await client.unpublish([config.localScreenShareTrack]);
        config.localScreenShareTrack = null;
      }

      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      await client.publish([config.localVideoTrack]);
      config.localVideoTrack.play(`stream-${config.uid}`);

      config.localScreenShareEnabled = false;
      config.onScreenShareEnabled(config.localScreenShareEnabled);
    } catch (error) {
      config.onError(error);
    }
  };

  const handleOnUpdateParticipants = debounce(async () => {
    try {
      const uids = await channelRTM.getMembers();
      const participants = await Promise.all(
        uids.map(async (uid) => {
          const userAttr = await clientRTM.getUserAttributes(uid);
          return {
            uid,
            ...userAttr,
          };
        })
      );

      config.onParticipantsChanged(participants);
    } catch (error) {
      config.onError(error);
    }
  }, 1000);

  const handleRenewToken = async () => {
    try {
      config.token = await fetchToken();
      await client.renewToken(config.token);
    } catch (error) {
      config.onError(error);
    }
  };

  const handleMessageFromPeer = async (message, peerId) => {
    try {
      const data = JSON.parse(message.text);
      switch (data.event) {
        case "mic_off":
          await toggleMic(true);
          break;
        case "cam_off":
          await toggleCamera(true);
          break;
        case "remove_participant":
          await leave();
          break;
        default:
          config.onError(new Error(`Unknown event type: ${data.event}`));
      }
    } catch (error) {
      config.onError(error);
    }
  };

  const handleChannelMessage = async (message, memberId) => {
    try {
      const messageObj = JSON.parse(message.text);

      if (
        messageObj.type === "broadcast" &&
        messageObj.event === "change_user_role"
      ) {
        if (config.uid === messageObj.targetUid) {
          config.user.role = messageObj.role;
          await clientRTM.addOrUpdateLocalUserAttributes(config.user);

          await client.leave();
          await leaveFromVideoStage(config.user);
          await join();
        }
        handleOnUpdateParticipants();
        config.onRoleChanged(messageObj.targetUid, messageObj.role);
        return;
      }

      config.onMessageReceived(messageObj);
    } catch (error) {
      config.onError(new Error("Received malformed message."));
    }
  };

  // Subscription Function
  const subscribe = async (user, mediaType) => {
    try {
      await client.subscribe(user, mediaType);

      if (mediaType === "video") {
        if (!document.querySelector(`#video-wrapper-${user.uid}`)) {
          await createParticipantUI(user.uid);
        }
        toggleAvatarDisplay(user.uid, false);
        user.videoTrack.play(`stream-${user.uid}`);
      }

      if (mediaType === "audio") {
        user.audioTrack.play();
      }
    } catch (error) {
      config.onError(error);
    }
  };

  // UI Functions
  const createParticipantUI = async (uid) => {
    try {
      const userAttr = await clientRTM.getUserAttributes(uid);
      const playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, uid)
        .replace(/{{name}}/g, userAttr.name)
        .replace(/{{avatar}}/g, userAttr.avatar);

      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", playerHTML);
    } catch (error) {
      config.onError(error);
    }
  };

  const toggleAvatarDisplay = (uid, showAvatar) => {
    const player = document.querySelector(`#video-wrapper-${uid}`);
    if (player) {
      const videoPlayer = player.querySelector(`#stream-${uid}`);
      const avatarDiv = player.querySelector(`#avatar-${uid}`);
      if (videoPlayer && avatarDiv) {
        if (showAvatar) {
          videoPlayer.style.display = "none";
          avatarDiv.style.display = "block";
        } else {
          videoPlayer.style.display = "block";
          avatarDiv.style.display = "none";
        }
      }
    }
  };

  // Return Public API
  return {
    config: config,
    clientRTM: clientRTM,
    client: client,
    join: join,
    leave: leave,
    joinToVideoStage: joinToVideoStage,
    leaveFromVideoStage: leaveFromVideoStage,
    toggleMic: toggleMic,
    toggleCamera: toggleCamera,
    toggleScreenShare: toggleScreenShare,
    turnOffMic: turnOffMic,
    turnOffCamera: turnOffCamera,
    changeRole: changeRole,
    getCameras: getCameras,
    getMicrophones: getMicrophones,
    switchCamera: switchCamera,
    switchMicrophone: switchMicrophone,
    removeParticipant: removeParticipant,
    sendChat: sendChat,
    sendBroadcast: sendBroadcast,
    enableVirtualBackgroundBlur: enableVirtualBackgroundBlur,
    enableVirtualBackgroundImage: enableVirtualBackgroundImage,
    disableVirtualBackground: disableVirtualBackground,
  };
};

window["MainApp"] = MainApp;
