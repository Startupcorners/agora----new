// main.js
import { defaultConfig } from "./config.js";
import { log, imageUrlToBase64 } from "./utils.js";
import { setupAgoraRTCClient } from "./agoraRTCClient.js";
import { setupAgoraRTMClient } from "./agoraRTMClient.js";
import { recordingFunctions } from "./recording.js";
import { handleOnUpdateParticipants } from "./eventHandlers.js";

export function MainApp(initConfig) {
  let config = { ...defaultConfig, ...initConfig };
  let screenClient;
  let localScreenShareTrack;

  // Perform required config checks
  if (!config.appId) throw new Error("Please set the appId first");
  if (!config.callContainerSelector)
    throw new Error("Please set the callContainerSelector first");
  if (!config.serverUrl) throw new Error("Please set the serverUrl first");
  if (!config.participantPlayerContainer)
    throw new Error("Please set the participantPlayerContainer first");
  if (!config.channelName) throw new Error("Please set the channelName first");
  if (!config.uid) throw new Error("Please set the uid first");

  // Initialize Agora clients
  const client = setupAgoraRTCClient(config);
  const { clientRTM, channelRTM } = setupAgoraRTMClient(config);
  config.clientRTM = clientRTM; // Add clientRTM to config for access in handlers
  config.channelRTM = channelRTM;
  config.client = client;

  // Initialize recording functions
  const { acquireResource, startRecording, stopRecording } =
    recordingFunctions(config);

  // Other necessary initializations (e.g., extensions)
  const extensionVirtualBackground = new VirtualBackgroundExtension();
  if (!extensionVirtualBackground.checkCompatibility()) {
    log("Does not support Virtual Background!", config);
  }
  AgoraRTC.registerExtensions([extensionVirtualBackground]);
  let processor = null;

  /**
   * Functions that tie everything together
   */

  // Fetch Token
  const fetchToken = async () => {
    if (config.serverUrl !== "") {
      try {
        const res = await fetch(
          `${config.serverUrl}/access-token?channelName=${config.channelName}&uid=${config.uid}`
        );
        const data = await res.json();
        config.token = data.token;
        return data.token;
      } catch (err) {
        log(err, config);
        throw err;
      }
    } else {
      return config.token;
    }
  };

  // Join Function
  const join = async () => {
    // Start by joining the RTM (Real-Time Messaging) channel
    await joinRTM();

    // Join the Agora channel
    const token = await fetchToken();
    await client.join(config.appId, config.channelName, token, config.uid);

    // Set the client's role based on the user's role
    console.log("config.user.role:", config.user.role);

    const roleToSet = config.user.role === "audience" ? "audience" : "host";
    console.log("Setting client role to:", roleToSet);

    await client.setClientRole(roleToSet);

    // Check the client's role
    console.log("Client role after setting:", client.role);

    // If the user needs to join the video stage, proceed to publish tracks
    if (config.onNeedJoinToVideoStage(config.user)) {
      await joinToVideoStage(config.user);
    }
  };


  // Join RTM Function
  const joinRTM = async () => {
    try {
      const rtmUid = config.uid.toString();

      // RTM login
      await clientRTM.login({ uid: rtmUid });
      log(`RTM login successful for UID: ${rtmUid}`, config);

      // Update local user attributes
      await clientRTM.addOrUpdateLocalUserAttributes({
        name: config.user.name,
        avatar: config.user.avatar,
        role: config.user.role,
      });
      log("addOrUpdateLocalUserAttributes: success", config);

      // Join the RTM channel
      await channelRTM.join();
      log("Joined RTM channel successfully", config);

      // Update participants after joining
      handleOnUpdateParticipants(config)();
    } catch (error) {
      log("RTM join process failed:", error, config);
      throw error;
    }
  };

  // Join to Video Stage
  const joinToVideoStage = async (user) => {
    try {
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      if (config.onNeedMuteCameraAndMic(user)) {
        await toggleCamera(true);
        await toggleMic(true);
      }

      // Prepare the local player container
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

  // Leave from Video Stage
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
        log(error, config);
      }
    }
  };

  // Leave Function
  const leave = async () => {
    document.querySelector(config.callContainerSelector).innerHTML = "";

    await Promise.all([client.leave(), clientRTM.logout()]);

    config.onUserLeave();
  };

  // Toggle Microphone
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

  // Toggle Camera
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

  // Send Message to Peer
  const sendMessageToPeer = (data, uid) => {
    config.clientRTM
      .sendMessageToPeer(
        {
          text: JSON.stringify(data),
        },
        `${uid}`
      )
      .then(() => {
        log("Message sent successfully", config);
      })
      .catch((error) => {
        log("Failed to send message:", error, config);
      });
  };

  // Send Message
  const sendMessage = (data) => {
    config.channelRTM
      .sendMessage({
        text: JSON.stringify(data),
      })
      .then(() => {
        // Success
      })
      .catch((error) => {
        log(error, config);
      });
  };

  // Send Chat
  const sendChat = (data) => {
    const messageObj = {
      ...data,
      type: "chat",
      sender: config.user,
    };
    sendMessage(messageObj);
    config.onMessageReceived(messageObj);
  };

  // Send Broadcast
  const sendBroadcast = (data) => {
    const messageObj = {
      ...data,
      type: "broadcast",
      sender: config.user,
    };
    sendMessage(messageObj);
    config.onMessageReceived(messageObj);
  };

  // Turn Off Mic
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

  // Turn Off Camera
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

  // Remove Participant
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

  // Change Role
  const changeRole = (uid, role) => {
    const messageObj = {
      event: "change_user_role",
      targetUid: uid,
      role: role,
    };
    sendBroadcast(messageObj);
    handleOnUpdateParticipants(config)();
    config.onRoleChanged(uid, role);
  };

  // Functions related to Virtual Backgrounds
  async function getProcessorInstance() {
    if (!processor && config.localVideoTrack) {
      processor = extensionVirtualBackground.createProcessor();

      try {
        await processor.init();
      } catch (e) {
        log("Fail to load WASM resource!", config);
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
      let processor = await getProcessorInstance();
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

  const disableVirtualBackground = async () => {
    let processor = await getProcessorInstance();
    if (processor) {
      processor.disable();
    }

    config.isVirtualBackGroundEnabled = false;
  };


const toggleScreenShare = async (isEnabled) => {
  if (isEnabled) {
    try {
      console.log("Client role before screen sharing:", client.role);

      // Ensure the client has joined the channel
      if (!client.connectionState || client.connectionState !== "CONNECTED") {
        console.log("Client not connected, joining channel...");
        const token = await fetchToken();
        await client.join(config.appId, config.channelName, token, config.uid);
      }

      // Set the client role to 'host' if it's not already
      if (client.role !== "host") {
        console.log("Changing client role to 'host' for screen sharing");
        await client.setClientRole("host");
        config.user.role = "host";

        // Update user attributes in RTM
        await config.clientRTM.addOrUpdateLocalUserAttributes({
          role: config.user.role,
        });
      }

      // Create the screen share track
      config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();

      // Stop and unpublish the local video track only after the screen share track is created
      if (config.localVideoTrack) {
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
        await client.unpublish([config.localVideoTrack]);
      }

      config.localScreenShareTrack.on("track-ended", async () => {
        // Automatically stop screen sharing when the user stops it via the browser
        await toggleScreenShare(false);
      });

      await client.publish([config.localScreenShareTrack]);
      config.localScreenShareTrack.play(`stream-${config.uid}`);

      config.localScreenShareEnabled = true;
      config.onScreenShareEnabled(config.localScreenShareEnabled);
    } catch (e) {
      console.error("Error during screen sharing:", e);
      config.onError(e);

      // If there was an error (e.g., user canceled screen sharing), ensure the local video is still active
      if (!config.localVideoTrack) {
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await client.publish([config.localVideoTrack]);
        config.localVideoTrack.play(`stream-${config.uid}`);
      }

      config.localScreenShareEnabled = false;
      config.onScreenShareEnabled(config.localScreenShareEnabled);
    }
  } else {
    // Stop screen sharing
    if (config.localScreenShareTrack) {
      config.localScreenShareTrack.stop();
      config.localScreenShareTrack.close();
      await client.unpublish([config.localScreenShareTrack]);
      config.localScreenShareTrack = null;
    }

    // Re-create and publish the camera video track
    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    await client.publish([config.localVideoTrack]);
    config.localVideoTrack.play(`stream-${config.uid}`);

    config.localScreenShareEnabled = false;
    config.onScreenShareEnabled(config.localScreenShareEnabled);
  }
};



  // Attach functions to config so they can be accessed in other modules
  config.toggleMic = toggleMic;
  config.toggleScreenShare = toggleScreenShare;
  config.toggleCamera = toggleCamera;
  config.leave = leave;
  config.joinToVideoStage = joinToVideoStage;
  config.leaveFromVideoStage = leaveFromVideoStage;
  config.join = join;
  config.fetchToken = fetchToken;

  // Expose Methods
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
    turnOffMic,
    turnOffCamera,
    changeRole,
    getCameras: async () => await AgoraRTC.getCameras(),
    getMicrophones: async () => await AgoraRTC.getMicrophones(),
    switchCamera: async (deviceId) => {
      // Switch Camera logic
      config.localVideoTrack.stop();
      config.localVideoTrack.close();
      client.unpublish([config.localVideoTrack]);

      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: deviceId,
      });
      client.publish([config.localVideoTrack]);
      config.localVideoTrack.play(`stream-${config.uid}`);
    },
    switchMicrophone: async (deviceId) => {
      // Switch Microphone logic
      config.localAudioTrack.stop();
      config.localAudioTrack.close();
      client.unpublish([config.localAudioTrack]);

      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: deviceId,
      });
      client.publish([config.localAudioTrack]);
    },
    removeParticipant,
    sendChat,
    sendBroadcast,
    enableVirtualBackgroundBlur,
    enableVirtualBackgroundImage,
    disableVirtualBackground,
    acquireResource,
    startRecording,
    stopRecording,
  };
}

window["MainApp"] = MainApp;
