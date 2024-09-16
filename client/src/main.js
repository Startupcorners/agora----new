/**
 * please include agora on your html, since this not use nodejs import module approach
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
      bubbleID: "",
      avatar:
        "https://ui-avatars.com/api/?background=random&color=fff&name=loading",
      role: "", //host, speaker, audience,
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
      log(`current uid: ${uid}  role: ${role}`);
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

  if (config.appId === null) {
    throw new Error("please set the appId first");
  }

  if (config.callContainerSelector === null) {
    throw new Error("please set the callContainerSelector first");
  }

  if (config.serverUrl === null) {
    throw new Error("please set the serverUrl first");
  }

  if (config.participantPlayerContainer === null) {
    throw new Error("please set the participantPlayerContainer first");
  }

  if (config.channelName === null) {
    throw new Error("please set the channelName first");
  }

  if (config.uid === null) {
    throw new Error("please set the uid first");
  }

  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); //0 debug, 4 none
  AgoraRTC.onCameraChanged = (info) => {
    config.onCameraChanged(info);
  };
  AgoraRTC.onMicrophoneChanged = (info) => {
    config.onMicrophoneChanged(info);
  };
  AgoraRTC.onPlaybackDeviceChanged = (info) => {
    config.onSpeakerChanged(info);
  };

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

const acquireResource = async () => {
  try {
    // Log the payload before making the API call
    console.log("Payload for acquire resource:", {
      channelName: config.channelName,
      uid: "0",
    });

    const response = await fetch(config.serverUrl + "/acquire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName: config.channelName, // Provide the channel name
        uid: "0", // Provide the UID
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error acquiring resource:", errorData);
      throw new Error(`Failed to acquire resource: ${errorData.error}`);
    }

    const data = await response.json();
    console.log("Resource acquired:", data.resourceId); // Log the resourceId
    return data.resourceId;
  } catch (error) {
    console.error("Error acquiring resource:", error);
    throw error;
  }
};


const startRecording = async () => {
  try {
    const resourceId = await acquireResource(); // Acquire the resource first
    console.log("Resource acquired:", resourceId);

    // Add a 2-second delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("Waited 2 seconds after acquiring resource");
    

    // Fetch a new token for recording with PUBLISHER role
    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=0`,
      {
        method: "GET",
      }
    );

    const tokenData = await recordingTokenResponse.json();
    const recordingToken = tokenData.token;

    // Log the recording token for debugging purposes
    console.log("Recording token received:", recordingToken);

    const response = await fetch(config.serverUrl + "/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: resourceId, // Pass the correct resourceId
        channelName: config.channelName, // Channel name must match the one used for the call
        uid: "0", // UID should be "0" for recording
        token: recordingToken, // Use the new token generated for recording
      }),
    });

    const startData = await response.json();

    // Log the full response for detailed analysis
    console.log("Response from start recording:", startData);

    if (!response.ok) {
      console.error("Error starting recording:", startData);
      throw new Error(`Failed to start recording: ${startData.error}`);
    }

    // Check if SID is received
    if (startData.sid) {
      console.log("SID received successfully:", startData.sid);
    } else {
      console.error("SID not received in the response:", startData);
    }

    config.sid = startData.sid; // Store the SID if received
    console.log(
      "Recording started successfully. Resource ID:",
      resourceId,
      "SID:",
      config.sid
    );

    return startData;
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
};




  const stopRecording = async (resourceId, sid) => {
    const response = await fetch(config.serverUrl + "/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName: config.channelName,
        resourceId: resourceId,
        sid: sid,
      }),
    });
    const stopData = await response.json();
    return stopData;
  };

  /**
   * Functions
   */
  const fetchToken = async () => {
    if (config.serverUrl !== "") {
      try {
        const res = await fetch(
          config.serverUrl +
            `/access_token?channelName=${config.channelName}&uid=${config.uid}`
        );
        const data = await res.text();
        const json = await JSON.parse(data);
        config.token = json.token;

        return json.token;
      } catch (err) {
        log(err);
      }
    } else {
      return config.token;
    }
  };

  const join = async () => {
    // Start by joining the RTM (Real-Time Messaging) channel
    await joinRTM();

    // Set the client's role based on the user's role
    await client.setClientRole(
      config.user.role === "audience" ? "audience" : "host"
    );

    // Register common event listeners for all users
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished); // Add this line to handle avatar toggling
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.enableAudioVolumeIndicator();
    client.on("volume-indicator", handleVolumeIndicator);

    // Join the Agora channel
    const { appId, uid, channelName } = config;
    const token = await fetchToken(config);
    client.on("token-privilege-will-expire", handleRenewToken);
    await client.join(appId, channelName, token, uid);

    // If the user needs to join the video stage (e.g., host or speaker), proceed to publish tracks
    if (config.onNeedJoinToVideoStage(config.user)) {
      await joinToVideoStage(config.user);
    }
    // Audience members do not publish tracks or join the video stage
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
      console.log("Avatar URL:", user.avatar);
      let localPlayerContainer = config.participantPlayerContainer
        .replaceAll("{{uid}}", user.id)
        .replaceAll("{{name}}", user.name)
        .replaceAll("{{avatar}}", user.avatar); // Ensure avatar is replaced as well

      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", localPlayerContainer);

      //need detect remote or not
      if (user.id === config.uid) {
        config.localVideoTrack.play(`stream-${user.id}`);

        await client.publish([config.localAudioTrack, config.localVideoTrack]);
      }
    } catch (error) {
      config.onError(error);
    }
  };

  const leaveFromVideoStage = async (user) => {
    let player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player != null) {
      player.remove();
    }

    if (user.id === config.uid) {
      try {
        config.localAudioTrack.stop();
        config.localVideoTrack.stop();

        config.localAudioTrack.close();
        config.localVideoTrack.close();

        await client.unpublish([
          config.localAudioTrack,
          config.localVideoTrack,
        ]);
      } catch (error) {
        //
      }
    }
  };

  const joinRTM = async () => {
    try {
      console.log("UID for RTM login:", config.uid);
      console.log("Token for RTM login (if applicable):", config.token);

      await clientRTM.login({ uid: config.uid, token: config.token });

      await clientRTM.addOrUpdateLocalUserAttributes(config.user);
      log("addOrUpdateLocalUserAttributes: success");

      await channelRTM.join();
      handleOnUpdateParticipants();

      clientRTM.on("MessageFromPeer", async (message, peerId) => {
        log("messageFromPeer");
        const data = JSON.parse(message.text);
        log(data);
        // Handle peer messages
      });

      channelRTM.on("MemberJoined", async (memberId) => {
        handleOnUpdateParticipants();
      });

      channelRTM.on("MemberLeft", (memberId) => {
        handleOnUpdateParticipants();
      });

      channelRTM.on("ChannelMessage", async (message, memberId, props) => {
        log("on:ChannelMessage ->", message);

        const messageObj = JSON.parse(message.text);
        log(messageObj);
        // Handle channel messages
      });
    } catch (error) {
      log("RTM client login or join failure:", error);
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

  const toggleScreenShare = async (isEnabled) => {
    if (isEnabled) {
      try {
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
        client.unpublish([config.localVideoTrack]);

        config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
        config.localScreenShareTrack.on("track-ended", handleScreenShareEnded);

        client.publish([config.localScreenShareTrack]);
        config.localScreenShareTrack.play(`stream-${config.uid}`);

        config.localScreenShareEnabled = true;
      } catch (e) {
        config.onError(e);
        config.localScreenShareTrack = null;

        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        client.publish([config.localVideoTrack]);
        config.localVideoTrack.play(`stream-${config.uid}`);

        config.localScreenShareEnabled = false;
      }
    } else {
      config.localScreenShareTrack.stop();
      config.localScreenShareTrack.close();
      client.unpublish([config.localScreenShareTrack]);
      config.localScreenShareTrack = null;

      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      client.publish([config.localVideoTrack]);
      config.localVideoTrack.play(`stream-${config.uid}`);

      config.localScreenShareEnabled = false;
    }

    config.onScreenShareEnabled(config.localScreenShareEnabled);
  };

  const turnOffMic = (...uids) => {
    uids.forEach((uid) => {
      sendMessageToPeer(
        {
          content: "",
          event: "mic_off",
        },
        `${uid}`
      );
    });
  };

  const turnOffCamera = (...uids) => {
    uids.forEach((uid) => {
      sendMessageToPeer(
        {
          content: "",
          event: "cam_off",
        },
        `${uid}`
      );
    });
  };

  const removeParticipant = (...uids) => {
    uids.forEach((uid) => {
      sendMessageToPeer(
        {
          content: "",
          event: "remove_participant",
        },
        `${uid}`
      );
    });
  };

  const changeRole = (uid, role) => {
    const messageObj = {
      event: "change_user_role",
      targetUid: uid,
      role: role,
    };
    sendBroadcast(messageObj);
    handleOnUpdateParticipants();
    config.onRoleChanged(uid, role);
  };

  const getCameras = async () => {
    return await AgoraRTC.getCameras();
  };

  const getMicrophones = async () => {
    return await AgoraRTC.getMicrophones();
  };

  const switchCamera = async (deviceId) => {
    //todo
    config.localVideoTrack.stop();
    config.localVideoTrack.close();
    client.unpublish([config.localVideoTrack]);

    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      cameraId: deviceId,
    });
    client.publish([config.localVideoTrack]);
    config.localVideoTrack.play(`stream-${config.uid}`);
  };

  const switchMicrophone = async (deviceId) => {
    //todo
    config.localAudioTrack.stop();
    config.localAudioTrack.close();
    client.unpublish([config.localAudioTrack]);

    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: deviceId,
    });
    client.publish([config.localAudioTrack]);
  };

  async function getProcessorInstance() {
    if (!processor && config.localVideoTrack) {
      processor = extensionVirtualBackground.createProcessor();

      try {
        await processor.init();
      } catch (e) {
        log("Fail to load WASM resource!");
        return null;
      }
      config.localVideoTrack
        .pipe(processor)
        .pipe(config.localVideoTrack.processorDestination);
    }
    return processor;
  }

  const enableVirtualBackgroundBlur = async () => {
    if (config.localVideoTrack) {
      let processor = await getProcessorInstance(config);
      processor.setOptions({ type: "blur", blurDegree: 2 });
      await processor.enable();

      config.isVirtualBackGroundEnabled = true;
    }
  };

  const enableVirtualBackgroundImage = async (imageSrc) => {
    const imgElement = document.createElement("img");
    imgElement.onload = async () => {
      let processor = await getProcessorInstance();
      processor.setOptions({ type: "img", source: imgElement });
      await processor.enable();

      config.isVirtualBackGroundEnabled = true;
    };

    const base64 = await imageUrlToBase64(imageSrc);
    imgElement.src = base64;
  };

  const imageUrlToBase64 = async (url) => {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data);
      };
      reader.onerror = reject;
    });
  };

  const disableVirtualBackground = async () => {
    let processor = await getProcessorInstance(config);
    processor.disable();

    config.isVirtualBackGroundEnabled = false;
  };

  const sendChat = (data) => {
    const messageObj = {
      ...data,
      type: "chat",
      sender: config.user,
    };
    sendMessage(messageObj);
    config.onMessageReceived(messageObj);
  };

  const sendBroadcast = (data) => {
    const messageObj = {
      ...data,
      type: "broadcast",
      sender: config.user,
    };
    sendMessage(messageObj);
    config.onMessageReceived(messageObj);
  };

  const sendMessageToPeer = (data, uid) => {
    clientRTM
      .sendMessageToPeer(
        {
          text: JSON.stringify(data),
        },
        `${uid}`
      )
      .then(() => {
        //success
      })
      .catch((error) => {
        log(error);
      });
  };

  const sendMessage = (data) => {
    channelRTM
      .sendMessage({
        text: JSON.stringify(data),
      })
      .then(() => {
        //success
      })
      .catch((error) => {
        log(error);
      });
  };

  /**
   * Callback Handlers
   */
  const handleUserPublished = async (user, mediaType) => {
    log("handleUserPublished Here");
    config.remoteTracks[user.uid] = user;
    subscribe(user, mediaType);
  };

  const handleUserJoined = async (user) => {
    log("handleUserJoined Here");
    config.remoteTracks[user.uid] = user;

    // Check if the participant UI already exists
    let player = document.querySelector(`#video-wrapper-${user.uid}`);
    if (!player) {
      // Get user attributes from RTM
      const userAttr = await clientRTM.getUserAttributes(user.uid);

      // Replace placeholders in the template
      let playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, user.uid)
        .replace(/{{name}}/g, userAttr.name)
        .replace(/{{avatar}}/g, userAttr.avatar);

      // Insert the participant UI into the DOM
      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", playerHTML);

      // Hide the video player and show the avatar since the user hasn't published video
      const videoPlayer = document.querySelector(`#stream-${user.uid}`);
      const avatarDiv = document.querySelector(`#avatar-${user.uid}`);
      if (videoPlayer && avatarDiv) {
        videoPlayer.style.display = "none"; // Hide the video player
        avatarDiv.style.display = "block"; // Show the avatar
      }
    }
  };

  const handleUserLeft = async (user, reason) => {
    delete config.remoteTracks[user.uid];
    if (document.querySelector(`#video-wrapper-${user.uid}`)) {
      document.querySelector(`#video-wrapper-${user.uid}`).remove();
    }
    config.onParticipantLeft(user);
  };

  const handleVolumeIndicator = (result) => {
    result.forEach((volume, index) => {
      config.onVolumeIndicatorChanged(volume);
    });
  };

  const handleScreenShareEnded = async () => {
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

  const handleOnUpdateParticipants = () => {
    debounce(() => {
      channelRTM
        .getMembers()
        .then(async (uids) => {
          const participants = await Promise.all(
            uids.map(async (uid) => {
              const userAttr = await clientRTM.getUserAttributes(uid);
              return {
                id: uid,
                ...userAttr,
              };
            })
          );

          config.onParticipantsChanged(participants);
        })
        .catch((error) => {
          log(error);
        });
    }, 1000);
  };

  const handleRenewToken = async () => {
    config.token = await fetchToken();
    await client.renewToken(config.token);
  };

  const subscribe = async (user, mediaType) => {
    await client.subscribe(user, mediaType);

    if (mediaType === "video") {
      let player = document.querySelector(`#video-wrapper-${user.uid}`);
      if (!player) {
        // Create the player if it doesn't exist
        const userAttr = await clientRTM.getUserAttributes(user.uid);

        // Replace placeholders in the template
        let playerHTML = config.participantPlayerContainer
          .replace(/{{uid}}/g, user.uid)
          .replace(/{{name}}/g, userAttr.name)
          .replace(/{{avatar}}/g, userAttr.avatar);

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
      user.videoTrack.play(`stream-${user.uid}`);
    }

    if (mediaType === "audio") {
      user.audioTrack.play();
    }
  };

  const log = (arg) => {
    if (config.debugEnabled) {
      console.log(arg);
    }
  };

  let timer;
  const debounce = (fn, delay) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(fn, delay);
  };

  return {
    config: config,
    clientRTM: clientRTM,
    client: client,
    debounce: debounce,
    join: join,
    joinToVideoStage: joinToVideoStage,
    leaveFromVideoStage: leaveFromVideoStage,
    leave: leave,
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
    acquireResource: acquireResource,
    startRecording: startRecording,
    stopRecording: stopRecording,
  };
}

window['MainApp'] = MainApp;
