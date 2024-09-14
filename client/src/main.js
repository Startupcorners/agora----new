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
      role: "", //host, speaker, audience
      company: "",
      profileLink: "",
    },
    serverUrl: null,
    token: null,
    channelName: null,
    localAudioTrack: null,
    localVideoTrack: null,
    recordingResourceId: null, // Add this for recording resource management
    recordingSid: null, // Add this for the recording session ID
    localScreenShareTrack: null,
    localScreenShareEnabled: false,
    localAudioTrackMuted: false,
    localVideoTrackMuted: false,
    isVirtualBackGroundEnabled: false,
    remoteTracks: {},

    // ... Other config and callbacks like onParticipantsChanged, onParticipantLeft, etc.
  };

  config = { ...config, ...initConfig };

  // Check for required config settings
  if (!config.appId) throw new Error("please set the appId first");
  if (!config.callContainerSelector)
    throw new Error("please set the callContainerSelector first");
  if (!config.serverUrl) throw new Error("please set the serverUrl first");
  if (!config.participantPlayerContainer)
    throw new Error("please set the participantPlayerContainer first");
  if (!config.channelName) throw new Error("please set the channelName first");
  if (!config.uid) throw new Error("please set the uid first");

  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); //0 debug, 4 none

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
   * Fetch token function
   */
  const fetchToken = async () => {
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
      const json = await res.json();
      config.token = json.token;
      return json.token;
    } catch (err) {
      log(err);
    }
  };

  /**
   * Recording functions
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
      await acquireResource(); // Acquire resource if not already acquired
    }
    const token = await fetchToken();
    try {
      const res = await fetch(`${config.serverUrl}/api/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appId: config.appId,
          channelName: config.channelName,
          resourceId: config.recordingResourceId,
          uid: config.uid,
          token: token,
        }),
      });
      const data = await res.json();
      config.recordingSid = data.sid;
      log("Recording started:", data.sid);
    } catch (error) {
      log("Error starting recording:", error);
    }
  };

  // Stop Recording
  const stopRecording = async () => {
    if (!config.recordingResourceId || !config.recordingSid) {
      log("No recording to stop.");
      return;
    }
    try {
      const res = await fetch(`${config.serverUrl}/api/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appId: config.appId,
          channelName: config.channelName,
          resourceId: config.recordingResourceId,
          sid: config.recordingSid,
          uid: config.uid,
        }),
      });
      const data = await res.json();
      log("Recording stopped:", data);
    } catch (error) {
      log("Error stopping recording:", error);
    }
  };

  /**
   * MainApp existing functions (join, leave, etc.)
   */
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

  const leave = async () => {
    document.querySelector(config.callContainerSelector).innerHTML = "";
    await Promise.all([client.leave(), clientRTM.logout()]);
    config.onUserLeave();
  };

  const toggleMic = async (isMuted) => {
    if (isMuted) {
      await config.localAudioTrack.setMuted(true);
      config.localAudioTrackMuted = true;
    } else {
      await config.localAudioTrack.setMuted(false);
      config.localAudioTrackMuted = false;
    }
    config.onMicMuted(config.localAudioTrackMuted);
  };

  const toggleCamera = async (isMuted) => {
    if (isMuted) {
      await config.localVideoTrack.setMuted(true);
      config.localVideoTrackMuted = true;
    } else {
      await config.localVideoTrack.setMuted(false);
      config.localVideoTrackMuted = false;
    }
    config.onCamMuted(config.localVideoTrackMuted);
  };

  /**
   * Expose recording functions along with existing functions
   */
  return {
    config: config,
    clientRTM: clientRTM,
    client: client,
    join: join,
    leave: leave,
    startRecording: startRecording,
    stopRecording: stopRecording,
    toggleMic: toggleMic,
    toggleCamera: toggleCamera,
    // Other MainApp functions...
  };
};

window["MainApp"] = MainApp;
