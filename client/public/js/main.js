/**
 * please include agora on your html, since this not use nodejs import module approach
 * <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
 * <script src="https://cdn.jsdelivr.net/npm/agora-rtm-sdk@1.3.1/index.js"></script>
 * <script src="https://unpkg.com/agora-extension-virtual-background@1.2.0/agora-extension-virtual-background.js"></script>
 */

const templateVideoParticipant = `<div id="video-wrapper-{{uid}}" style="
  flex: 1 1 calc(25% - 20px); /* Ensure wrappers resize flexibly */
  width: 100%;
  min-width: 280px; /* Updated min-width */
  max-width: 800px;
  aspect-ratio: 16/9;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px;
  border-radius: 10px;
  background-color: #3c4043;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  transition: all 0.3s ease; /* Smooth transitions on resizing */
" data-uid="{{uid}}">
  <!-- Video Player -->
  <div id="stream-{{uid}}" class="video-player" style="
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: none; /* Initially hidden because the camera is off */
  "></div>

  <!-- User Avatar (shown when video is off) -->
  <img id="avatar-{{uid}}" class="user-avatar" src="{{avatar}}" alt="{{name}}'s avatar" style="
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
  " />

  <!-- User Name -->
  <div id="name-{{uid}}" class="user-name" style="
    position: absolute;
    bottom: 10px;
    left: 10px;
    font-size: 16px;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    border-radius: 5px;
  ">
    {{name}}
  </div>

  <!-- Participant Status Indicators -->
  <div class="status-indicators" style="
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 5px;
  ">
    <!-- Microphone Status Icon -->
    <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted" style="
      width: 24px;
      height: 24px;
      background-image: url('https://startupcorners-df3e7.web.app/icons/mic-muted.svg');
      background-size: contain;
      background-repeat: no-repeat;
      display: none;
    "></span>

    <!-- Camera Status Icon -->
    <span id="cam-status-{{uid}}" class="cam-status" title="Camera is off" style="
      width: 24px;
      height: 24px;
      background-image: url('icons/camera-off.svg');
      background-size: contain;
      background-repeat: no-repeat;
      display: block;
    "></span>
  </div>
</div>
`;


const newMainApp = function (initConfig) {
  let config = {
    debugEnabled: true,
    callContainerSelector: "#video-stage",
    participantPlayerContainer: templateVideoParticipant,
    appId: "95e91980e5444a8e86b4e41c7f03b713",
    timestamp: "",
    recordId: null,
    uid: null,
    user: {
      id: null,
      name: "guest",
      avatar:
        "https://ui-avatars.com/api/?background=random&color=fff&name=loading",
      role: "", //host, speaker, audience, etc
      company: "",
      profileLink: "",
    },
    serverUrl: "https://agora-new.vercel.app",
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
    config.recordId = Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit recordId
    try {
      console.log("Payload for acquire resource:", {
        channelName: config.channelName,
        uid: config.recordId,
      });

      const response = await fetch(config.serverUrl + "/acquire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelName: config.channelName,
          uid: config.recordId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error acquiring resource:", errorData);
        throw new Error(`Failed to acquire resource: ${errorData.error}`);
      }

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
      console.log("Resource acquired:", resourceId);

      config.resourceId = resourceId;

      const timestamp = Date.now().toString(); // Generate timestamp in the frontend
      config.timestamp = timestamp; // Save the timestamp in config for later use

      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Waited 2 seconds after acquiring resource");

      const recordingTokenResponse = await fetch(
        `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${config.recordId}`,
        {
          method: "GET",
        }
      );

      const tokenData = await recordingTokenResponse.json();
      const recordingToken = tokenData.token;

      console.log("Recording token received:", recordingToken);

      // Log the parameters before sending the request to ensure they're correct
      console.log("Sending the following data to the backend:", {
        resourceId: config.resourceId,
        channelName: config.channelName,
        uid: config.recordId,
        token: recordingToken,
        timestamp: config.timestamp, // Ensure the timestamp is being passed here
      });

      const response = await fetch(config.serverUrl + "/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceId: config.resourceId,
          channelName: config.channelName,
          uid: config.recordId,
          token: recordingToken,
          timestamp: config.timestamp, // Ensure the timestamp is passed here
        }),
      });

      const startData = await response.json();
      console.log("Response from start recording:", startData);

      if (!response.ok) {
        console.error("Error starting recording:", startData);
        throw new Error(`Failed to start recording: ${startData.error}`);
      }

      if (startData.sid) {
        console.log("SID received successfully:", startData.sid);
        config.sid = startData.sid;
      } else {
        console.error("SID not received in the response:", startData);
      }

      console.log(
        "Recording started successfully. Resource ID:",
        resourceId,
        "SID:",
        config.sid
      );

      if (typeof bubble_fn_record === "function") {
        bubble_fn_record({
          output1: resourceId,
          output2: config.sid,
          output3: config.recordId,
          output4: config.timestamp, // Pass the timestamp to Bubble function
        });
        console.log("Called bubble_fn_record with:", {
          output1: resourceId,
          output2: config.sid,
          output3: config.recordId,
          output4: config.timestamp,
        });
      } else {
        console.warn("bubble_fn_record is not defined");
      }

      return startData;
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  };

  // Stop recording function without polling
  const stopRecording = async () => {
    try {
      // Stop the recording via backend
      const response = await fetch(`${config.serverUrl}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceId: config.resourceId,
          sid: config.sid,
          channelName: config.channelName,
          uid: config.recordId,
          timestamp: config.timestamp,
        }),
      });

      const stopData = await response.json();

      if (response.ok) {
        console.log("Recording stopped successfully:", stopData);
        // MP4 file handling and other tasks are now done in the backend
      } else {
        console.error("Error stopping recording:", stopData.error);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
    }
  };

  /**
   * Functions
   */
  const fetchTokens = async () => {
    try {
      const res = await fetch(
        config.serverUrl +
          `/generateTokens?channelName=${config.channelName}&uid=${config.uid}&role=${config.user.role}`,
        {
          method: "GET", // Ensure method is GET
          headers: {
            "Cache-Control": "no-cache", // Prevent caching
            Pragma: "no-cache", // HTTP 1.0 backward compatibility
            Expires: "0", // Force immediate expiration
          },
        }
      );
      const data = await res.json();
      return {
        rtcToken: data.rtcToken, // Extract the RTC token
        rtmToken: data.rtmToken, // Extract the RTM token
      };
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
      throw err;
    }
  };
const join = async () => {
  try {
    const { appId, uid, channelName } = config;
    const tokens = await fetchTokens(); // Fetch RTC and RTM tokens

    console.log("RTC Token (during join):", tokens.rtcToken);
    console.log("RTM Token (during join):", tokens.rtmToken);
    console.log("RTC UID (during join):", config.uid);

    if (!tokens) {
      throw new Error("Failed to fetch token");
    }

    console.log("Tokens fetched successfully:", tokens);

    // Step 1: Log in to the RTM service
    await joinRTM(tokens.rtmToken);
    console.log(`Joined RTM successfully with UID: ${uid}`);

    // Step 2: Join the RTC channel
    console.log(
      `Attempting to join RTC channel: ${channelName} with UID: ${uid}`
    );
    await client.join(appId, channelName, tokens.rtcToken, uid);
    console.log(
      `Successfully joined RTC channel: ${channelName} with UID: ${uid}`
    );

    // Step 3: Set up token renewal for RTC
    client.on("token-privilege-will-expire", handleRenewToken);

    // Step 4: Set the client's role based on the user's role
    await client.setClientRole(
      config.user.role === "audience" ? "audience" : "host"
    );
    console.log(`Set client role to: ${config.user.role}`);

    // Step 5: Register common event listeners for all users
    setupEventListeners();
    console.log("Event listeners have been set up for user:", uid);

    // Step 6: Join the video stage if necessary
    if (config.onNeedJoinToVideoStage(config.user)) {
      await joinToVideoStage(config.user);
    } else {
      console.log("User is in the audience and will not join the video stage.");
    }
  } catch (error) {
    console.error("Error in join process:", error);
  }
};

  const setupEventListeners = () => {
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.enableAudioVolumeIndicator();
    client.on("volume-indicator", handleVolumeIndicator);
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
      .replaceAll("{{avatar}}", user.avatar);

    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", localPlayerContainer);

    if (user.id === config.uid) {
      config.localVideoTrack.play(`stream-${user.id}`);
      await client.publish([config.localAudioTrack, config.localVideoTrack]);
      console.log("Published local audio and video tracks for user:", user.id);
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

const joinRTM = async (rtmToken, retryCount = 0) => {
  try {
    const rtmUid = config.uid.toString(); // Convert UID to string for RTM login

    // If the user is already logged in, attempt to log them out first
    if (clientRTM && clientRTM._logined) {
      console.log(`User ${rtmUid} is already logged in. Logging out...`);
      await clientRTM.logout();
      console.log(`User ${rtmUid} logged out successfully.`);
    }

    console.log("RTM Token (during login):", rtmToken);
    console.log("RTM UID (during login):", rtmUid);

    // RTM login with the token
    await clientRTM.login({ uid: rtmUid, token: rtmToken });
    console.log(`RTM login successful for UID: ${rtmUid}`);

    // Set the user's attributes (name and avatar) after login
    const attributes = {
      name: config.user.name || "Unknown", // Ensure default value if name is missing
      avatar: config.user.avatar || "default-avatar-url", // Ensure default avatar
    };

    await clientRTM.setLocalUserAttributes(attributes);
    console.log(`User attributes set for UID: ${rtmUid}:`, attributes);

    // Update participants after joining
    await handleOnUpdateParticipants();

    // Set up RTM event listeners
    setupRTMEventListeners();

    // Join the RTM channel
    await channelRTM.join();
    console.log(`Joined RTM channel successfully`);
  } catch (error) {
    console.error("RTM join process failed. Error details:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);

    if (error.code === 5) {
      console.error(
        "Token error detected. Please check your token generation process and Agora project settings."
      );
      console.error(
        "Make sure you're using a dynamic token, not a static key."
      );
      console.error(
        "Verify that your Agora project is configured for token authentication."
      );
    }

    if (retryCount < 3) {
      console.log(`Retrying RTM join (attempt ${retryCount + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
      return joinRTM(rtmToken, retryCount + 1);
    } else {
      throw new Error("Failed to join RTM after multiple attempts");
    }
  }
};

  const setupRTMEventListeners = () => {
    clientRTM.on("MessageFromPeer", handleMessageFromPeer);
    channelRTM.on("MemberJoined", handleMemberJoined);
    channelRTM.on("MemberLeft", handleMemberLeft);
    channelRTM.on("ChannelMessage", handleChannelMessage);
  };

  const handleMessageFromPeer = async (message, peerId) => {
    console.log("messageFromPeer");
    const data = JSON.parse(message.text);
    console.log(data);

    if (data.event === "mic_off") {
      await toggleMic(true);
    } else if (data.event === "cam_off") {
      await toggleCamera(true);
    } else if (data.event === "remove_participant") {
      await leave();
    }
  };

  const handleMemberJoined = async (memberId) => {
    console.log(`Member joined: ${memberId}`);
    await handleOnUpdateParticipants();
  };

  const handleMemberLeft = async (memberId) => {
    console.log(`Member left: ${memberId}`);
    await handleOnUpdateParticipants();
  };

  const handleChannelMessage = async (message, memberId, props) => {
    console.log("on:ChannelMessage ->");
    const messageObj = JSON.parse(message.text);
    console.log(messageObj);

    if (
      messageObj.type === "broadcast" &&
      messageObj.event === "change_user_role"
    ) {
      if (config.uid === messageObj.targetUid) {
        await handleRoleChange(messageObj);
      }
      await handleOnUpdateParticipants();
      config.onRoleChanged(messageObj.targetUid, messageObj.role);
    } else {
      config.onMessageReceived(messageObj);
    }
  };

  const handleRoleChange = async (messageObj) => {
    config.user.role = messageObj.role;
    console.log("User role changed:", config.user.role);

    await clientRTM.addOrUpdateLocalUserAttributes({
      role: config.user.role,
    });
    console.log("Updated user attributes after role change");

    await client.leave();
    await leaveFromVideoStage(config.user);
    await join(); // Re-join the RTC
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
        `${uid}` // Ensuring uid is passed as a string
      )
      .then(() => {
        console.log("Message sent successfully");
      })
      .catch((error) => {
        console.error("Failed to send message:", error);
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

    const rtmUid = user.uid.toString(); // Convert UID to string for RTM operations

    try {
      // Fetch user attributes from RTM using the stringified UID
      const userAttr = await clientRTM.getUserAttributes(rtmUid);

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
      log("Failed to fetch user attributes:", error);
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

  // A flag to track if the RTM client is already logged in
const subscribe = async (user, mediaType) => {
  try {
    log(`Subscribing to user ${user.uid} for media type: ${mediaType}`);

    // Use the participant's UID for fetching attributes
    const rtmUid = user.uid.toString(); // Ensure UID is a string

    // Fetch user attributes (name, avatar)
    let userAttr = { name: "Unknown", avatar: "default-avatar-url" }; // Default values
    try {
      // Fetch user attributes from RTM for the participant
      log(`Attempting to fetch attributes for user ${rtmUid}`);
      userAttr = await clientRTM.getUserAttributes(rtmUid);

      // Ensure at least default values for missing name or avatar
      userAttr.name = userAttr.name || "Unknown";
      userAttr.avatar = userAttr.avatar || "default-avatar-url";

      // Log the fetched name and avatar
      log(
        `Fetched attributes for user ${user.uid}: Name = ${userAttr.name}, Avatar = ${userAttr.avatar}`
      );
    } catch (err) {
      log(
        `Failed to fetch attributes for user ${user.uid}, using defaults:`,
        err
      );
    }

    // Check if the wrapper already exists to avoid duplicates
    let player = document.querySelector(`#video-wrapper-${user.uid}`);

    if (!player) {
      log(`Creating video wrapper for user ${user.uid}`);

      // Replace placeholders in the template with actual data
      let playerHTML = config.participantPlayerContainer
        .replace(/{{uid}}/g, user.uid)
        .replace(/{{name}}/g, userAttr.name)
        .replace(/{{avatar}}/g, userAttr.avatar);

      // Insert the player HTML into the stage
      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", playerHTML);

      // Get the newly inserted player
      player = document.querySelector(`#video-wrapper-${user.uid}`);
    } else {
      log(`Wrapper already exists for user ${user.uid}, skipping creation.`);
    }

    // Handle the video stream if mediaType is "video"
    const videoPlayer = player.querySelector(`#stream-${user.uid}`);
    const avatarDiv = player.querySelector(`#avatar-${user.uid}`);

    if (mediaType === "video") {
      log(`Handling video track for user ${user.uid}`);

      if (user.videoTrack) {
        // If user has a video track, display the video and hide the avatar
        videoPlayer.style.display = "block";
        avatarDiv.style.display = "none"; // Hide avatar
        user.videoTrack.play(`stream-${user.uid}`);
        log(`Playing video for user ${user.uid}`);
      } else {
        // If no video track, show the avatar and hide the video player
        videoPlayer.style.display = "none";
        avatarDiv.style.display = "block"; // Show avatar
        log(`No video track for user ${user.uid}, displaying avatar.`);
      }
    }

    // Handle the audio stream if mediaType is "audio"
    if (mediaType === "audio") {
      log(`Handling audio track for user ${user.uid}`);

      if (user.audioTrack) {
        user.audioTrack.play();
        log(`Playing audio for user ${user.uid}`);
      } else {
        log(`No audio track for user ${user.uid}`);
      }
    }

    // Ensure the wrapper is visible at all times
    player.style.display = "flex"; // Ensure wrapper is always shown

    // Verify if the number of wrappers matches the number of participants
    checkAndAddMissingWrappers();
  } catch (error) {
    console.error(`Error subscribing to user ${user.uid}:`, error);
    log(`Error subscribing to user ${user.uid}: ${error.message}`);
  }
};


  // Function to check if any wrappers are missing and add them if needed
  const checkAndAddMissingWrappers = () => {
    const participants = client.remoteUsers || [];
    const existingWrappers = document.querySelectorAll(
      '[id^="video-wrapper-"]'
    );

    log(
      `Checking for missing wrappers: ${existingWrappers.length} wrappers for ${participants.length} participants`
    );

    participants.forEach((user) => {
      const player = document.querySelector(`#video-wrapper-${user.uid}`);
      if (!player) {
        log(`Missing wrapper detected for user ${user.uid}, creating wrapper.`);
        subscribe(user, "video"); // Add the missing wrapper
      }
    });
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
};
window["newMainApp"] = newMainApp;

