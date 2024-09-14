const MainApp = function (initConfig) {
  let config = {
    // Existing configuration properties
    debugEnabled: true,
    callContainerSelector: null,
    participantPlayerContainer: null,
    appId: null,
    uid: null,
    user: {
      id: null,
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
    recordingResourceId: null, // Added for recording resource management
    recordingSid: null, // Added for the recording session ID
    localScreenShareTrack: null,
    localScreenShareEnabled: false,
    localAudioTrackMuted: false,
    localVideoTrackMuted: false,
    isVirtualBackGroundEnabled: false,
    remoteTracks: {},

    // Callbacks
    onParticipantsChanged: (participantIds) =>
      log("onParticipantsChanged", participantIds),
    onParticipantLeft: (user) => log("onParticipantLeft", user),
    onVolumeIndicatorChanged: (volume) =>
      log("onVolumeIndicatorChanged", volume),
    onMessageReceived: (messageObj) => log("onMessageReceived", messageObj),
    onMicMuted: (isMuted) => log("onMicMuted", isMuted),
    onCamMuted: (isMuted) => log("onCamMuted", isMuted),
    onScreenShareEnabled: (enabled) => log("onScreenShareEnabled", enabled),
    onUserLeave: () => log("onUserLeave"),
    onCameraChanged: (info) => log("camera changed", info.state, info.device),
    onMicrophoneChanged: (info) =>
      log("microphone changed", info.state, info.device),
    onSpeakerChanged: (info) => log("speaker changed", info.state, info.device),
    onRoleChanged: (uid, role) => log(`current uid: ${uid}  role: ${role}`),
    onNeedJoinToVideoStage: (user) => {
      log(`onNeedJoinToVideoStage: ${user}`);
      return true;
    },
    onNeedMuteCameraAndMic: (user) => {
      log(`onNeedMuteCameraAndMic: ${user}`);
      return false;
    },
    onError: (error) => log(`onError: ${error}`),
  };

  config = { ...config, ...initConfig };

  if (!config.appId) throw new Error("Please set the appId first");
  if (!config.callContainerSelector)
    throw new Error("Please set the callContainerSelector first");
  if (!config.serverUrl) throw new Error("Please set the serverUrl first");
  if (!config.participantPlayerContainer)
    throw new Error("Please set the participantPlayerContainer first");
  if (!config.channelName) throw new Error("Please set the channelName first");
  if (!config.uid) throw new Error("Please set the uid first");

  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); // 0: debug, 4: none

  const clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });
  const channelRTM = clientRTM.createChannel(config.channelName);

  const extensionVirtualBackground = new VirtualBackgroundExtension();
  if (!extensionVirtualBackground.checkCompatibility()) {
    log("Does not support Virtual Background!");
  }
  AgoraRTC.registerExtensions([extensionVirtualBackground]);
  let processor = null;

  /**
   * Functions
   */
  const fetchToken = async () => {
    if (config.serverUrl) {
      try {
        const res = await fetch(
          `${config.serverUrl}/access_token?channelName=${config.channelName}&uid=${config.uid}`,
          {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
        const data = await res.json();
        config.token = data.token;
        return data.token;
      } catch (err) {
        log(err);
      }
    } else {
      return config.token;
    }
  };

  const join = async () => {
    await joinRTM();
    await client.setClientRole(
      config.user.role === "audience" ? "audience" : "host"
    );
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.enableAudioVolumeIndicator();
    client.on("volume-indicator", handleVolumeIndicator);

    const token = await fetchToken();
    await client.join(config.appId, config.channelName, token, config.uid);

    if (config.onNeedJoinToVideoStage(config.user)) {
      await joinToVideoStage(config.user);
    }
  };

  const handleUserUnpublished = async (user, mediaType) => {
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

  const joinToVideoStage = async (user) => {
    try {
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      if (config.onNeedMuteCameraAndMic(user)) {
        toggleCamera(true);
        toggleMic(true);
      }

      let player = document.querySelector(`#video-wrapper-${user.id}`);
      if (player != null) {
        player.remove();
      }

      let localPlayerContainer = config.participantPlayerContainer
        .replaceAll("{{uid}}", user.id)
        .replaceAll("{{name}}", user.name)
        .replaceAll("{{avatar}}", user.avatar);

      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", localPlayerContainer);

      if (user.id === config.uid) {
        config.localVideoTrack.play(`stream-${user.id}`);
        await client.publish([config.localAudioTrack, config.localVideoTrack]);
      }
    } catch (error) {
      config.onError(error);
    }
  };

  /**
   * Recording Functions
   */

  // Acquire Resource for Recording
  const acquireResource = async () => {
    try {
      const res = await fetch(`${config.serverUrl}/api/acquire`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appId: config.appId,
          appCertificate: config.appCertificate,
          channelName: config.channelName,
          uid: config.uid,
        }),
      });
      const data = await res.json();
      config.recordingResourceId = data.resourceId;
      return data.resourceId;
    } catch (error) {
      log("Error acquiring resource:", error);
    }
  };

  // Start Recording
  const startRecording = async () => {
    if (!config.recordingResourceId) {
      await acquireResource();
    }
    try {
      const res = await fetch(`${config.serverUrl}/api/startRecording`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceId: config.recordingResourceId,
          mode: "mix",
          channelName: config.channelName,
          uid: config.uid,
        }),
      });
      const data = await res.json();
      config.recordingSid = data.sid;
      log("Recording started successfully.");
    } catch (error) {
      log("Error starting recording:", error);
    }
  };

  // Stop Recording
  const stopRecording = async () => {
    try {
      const res = await fetch(`${config.serverUrl}/api/stopRecording`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceId: config.recordingResourceId,
          sid: config.recordingSid,
          channelName: config.channelName,
          uid: config.uid,
        }),
      });
      log("Recording stopped successfully.");
    } catch (error) {
      log("Error stopping recording:", error);
    }
  };

  /**
   * Add the joinRTM function
   */
  const joinRTM = async () => {
    await clientRTM.login({ uid: config.uid });
    await clientRTM.addOrUpdateLocalUserAttributes(config.user);
    await channelRTM.join();
    handleOnUpdateParticipants();

    clientRTM.on("MessageFromPeer", async (message, peerId) => {
      log("messageFromPeer", message);
      const data = JSON.parse(message.text);
      if (data.event === "mic_off") {
        await toggleMic(true);
      } else if (data.event === "cam_off") {
        await toggleCamera(true);
      } else if (data.event === "remove_participant") {
        await leave();
      }
    });

    channelRTM.on("MemberJoined", async () => handleOnUpdateParticipants());
    channelRTM.on("MemberLeft", () => handleOnUpdateParticipants());
    channelRTM.on("ChannelMessage", async (message) => {
      log("on:ChannelMessage", message);
      const messageObj = JSON.parse(message.text);
      if (
        messageObj.type === "broadcast" &&
        messageObj.event === "change_user_role"
      ) {
        if (config.uid === messageObj.targetUid) {
          config.user.role = messageObj.role;
          await client.leave();
          await leaveFromVideoStage(config.user);
          await join();
        }
        handleOnUpdateParticipants();
        config.onRoleChanged(messageObj.targetUid, messageObj.role);
      }
      config.onMessageReceived(messageObj);
    });
  };

  return {
    config,
    clientRTM,
    client,
    join,
    startRecording,
    stopRecording,
  };
};

window["MainApp"] = MainApp;
