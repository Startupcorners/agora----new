/**
 * Please include Agora on your HTML, since this does not use node.js import module approach
 * <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
 * <script src="https://cdn.jsdelivr.net/npm/agora-rtm-sdk@1.3.1/index.js"></script>
 * <script src="https://unpkg.com/agora-extension-virtual-background@1.2.0/agora-extension-virtual-background.js"></script>
 */

const MainApp = function (initConfig) {
  let config = {
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
    localScreenShareTrack: null,
    localScreenShareEnabled: false,
    localAudioTrackMuted: false,
    localVideoTrackMuted: false,
    isVirtualBackGroundEnabled: false,
    remoteTracks: {},
    onParticipantsChanged: (participantIds) => {
      log("onParticipantsChanged");
      log(participantIds);
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
      log(user);
      log(content);
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

  config = { ...config, ...initConfig };

  if (!config.appId) throw new Error("please set the appId first");
  if (!config.callContainerSelector) throw new Error("please set the callContainerSelector first");
  if (!config.serverUrl) throw new Error("please set the serverUrl first");
  if (!config.participantPlayerContainer) throw new Error("please set the participantPlayerContainer first");
  if (!config.channelName) throw new Error("please set the channelName first");
  if (!config.uid) throw new Error("please set the uid first");

  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); // 0 debug, 4 none

  const clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled ? AgoraRTM.LOG_FILTER_INFO : AgoraRTM.LOG_FILTER_OFF,
  });

  const channelRTM = clientRTM.createChannel(config.channelName);
  const extensionVirtualBackground = new VirtualBackgroundExtension();

  if (!extensionVirtualBackground.checkCompatibility()) log("Does not support Virtual Background!");
  AgoraRTC.registerExtensions([extensionVirtualBackground]);

  let processor = null;

  const acquireResource = async () => {
    try {
      const response = await fetch(config.serverUrl + "/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName: config.channelName, uid: "0" }),
      });
      if (!response.ok) throw new Error(`Failed to acquire resource: ${await response.text()}`);
      const data = await response.json();
      console.log("Resource acquired:", data.resourceId);
      return data.resourceId;
    } catch (error) {
      console.error("Error acquiring resource:", error);
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      const resourceId = await acquireResource();
      const response = await fetch(config.serverUrl + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, channelName: config.channelName, uid: "0", token: config.token }),
      });
      if (!response.ok) throw new Error(`Failed to start recording: ${await response.text()}`);
      const startData = await response.json();
      console.log("Recording started:", startData);
      config.sid = startData.sid;
      return startData;
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  };

  const stopRecording = async (resourceId, sid) => {
    const response = await fetch(config.serverUrl + "/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName: config.channelName, resourceId, sid }),
    });
    const stopData = await response.json();
    return stopData;
  };

  const fetchToken = async () => {
    if (config.serverUrl !== "") {
      try {
        const response = await fetch(
          `${config.serverUrl}/access_token?channelName=${config.channelName}&uid=${config.uid}`
        );
        const data = await response.json();
        if (data.token) {
          config.token = data.token;
          console.log("Token fetched successfully:", config.token);
          return config.token;
        } else {
          throw new Error("Token generation failed");
        }
      } catch (err) {
        console.error("Error fetching token:", err);
        throw err;
      }
    }
  };

  const join = async () => {
    try {
      await joinRTM();
      await client.setClientRole(config.user.role === "audience" ? "audience" : "host");

      client.on("user-published", handleUserPublished);
      client.on("user-unpublished", handleUserUnpublished);
      client.on("user-joined", handleUserJoined);
      client.on("user-left", handleUserLeft);
      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", handleVolumeIndicator);

      const token = await fetchToken();
      client.on("token-privilege-will-expire", handleRenewToken);
      await client.join(config.appId, config.channelName, token, config.uid);

      if (config.onNeedJoinToVideoStage(config.user)) await joinToVideoStage(config.user);
    } catch (err) {
      console.error("Error joining channel:", err);
    }
  };

  const joinRTM = async () => {
    try {
      await clientRTM.login({ uid: config.uid });
      await channelRTM.join();
      clientRTM.on("MessageFromPeer", async (message) => {
        log("messageFromPeer");
        const data = JSON.parse(message.text);
        if (data.event === "mic_off") await toggleMic(true);
        else if (data.event === "cam_off") await toggleCamera(true);
        else if (data.event === "remove_participant") await leave();
      });
      handleOnUpdateParticipants();
    } catch (error) {
      console.error("Error joining RTM:", error);
    }
  };

  const handleOnUpdateParticipants = async () => {
    const uids = await channelRTM.getMembers();
    const participants = await Promise.all(
      uids.map(async (uid) => {
        const userAttr = await clientRTM.getUserAttributes(uid);
        return { id: uid, ...userAttr };
      })
    );
    config.onParticipantsChanged(participants);
  };

  const handleUserPublished = async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === "video") {
      const userAttr = await clientRTM.getUserAttributes(user.uid);
      let playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, user.uid)
        .replace(/{{name}}/g, userAttr.name)
        .replace(/{{avatar}}/g, userAttr.avatar);

      document.querySelector(config.callContainerSelector).insertAdjacentHTML("beforeend", playerHTML);
      user.videoTrack.play(`stream-${user.uid}`);
    }
    if (mediaType === "audio") user.audioTrack.play();
  };

  const handleUserUnpublished = async (user) => {
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
      const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);
      videoPlayer.style.display = "none";
      avatarDiv.style.display = "block";
    }
  };

  const leave = async () => {
    document.querySelector(config.callContainerSelector).innerHTML = "";
    await Promise.all([client.leave(), clientRTM.logout()]);
    config.onUserLeave();
  };

  const log = (arg) => {
    if (config.debugEnabled) console.log(arg);
  };

  return {
    config,
    clientRTM,
    client,
    join,
    joinToVideoStage,
    leaveFromVideoStage,
    leave,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    startRecording,
    stopRecording,
    acquireResource,
  };
};

window["MainApp"] = MainApp;
