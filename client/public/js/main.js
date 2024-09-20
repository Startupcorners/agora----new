// main.js
import { defaultConfig } from "./config.js";
import { log, imageUrlToBase64 } from "./utils.js";
import { setupAgoraRTCClient } from "./agoraRTCClient.js";
import { setupAgoraRTMClient } from "./agoraRTMClient.js";
import { recordingFunctions } from "./recording.js";
import { handleOnUpdateParticipants } from "./eventHandlers.js";
import { initAgoraApp } from "./init.js";

export function MainApp(initConfig) {
  let config = { ...defaultConfig, ...initConfig };
  let screenClient;
  let localScreenShareTrack;
  let cameraWasInitiallyOn = !config.localVideoTrackMuted;

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


function updateVideoWrapperSize() {
  const videoStage = document.getElementById("video-stage");
  const videoWrappers = videoStage.querySelectorAll('[id^="video-wrapper-"]');
  const count = videoWrappers.length;
  const screenWidth = window.innerWidth;
  const maxWrapperWidth = 800; // Maximum width of each video wrapper

  videoWrappers.forEach((wrapper) => {
    wrapper.style.boxSizing = "border-box"; // Prevent overflow due to padding or borders

    if (screenWidth < 768) {
      wrapper.style.flex = "1 1 100%";
      wrapper.style.maxWidth = "100%";
      wrapper.style.minHeight = "50vh";
    } else {
      if (count === 1) {
        wrapper.style.flex = "1 1 100%";
        wrapper.style.maxWidth = "100%";
        wrapper.style.minHeight = "80vh";
      } else if (count === 2) {
        wrapper.style.flex = "1 1 45%";
        wrapper.style.maxWidth = "50%";
        wrapper.style.minHeight = "45vh";
      } else if (count === 3) {
        wrapper.style.flex = "1 1 30%";
        wrapper.style.maxWidth = "33.333%";
        wrapper.style.minHeight = "35vh";
      } else {
        wrapper.style.flex = "1 1 auto";
        wrapper.style.maxWidth = `${maxWrapperWidth}px`;
        wrapper.style.minHeight = "30vh";
      }
    }
  });
}



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

const joinToVideoStage = async (user) => {
  try {
    console.log("User object:", user);

    // Create local audio and video tracks
    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    // Handle muting camera and microphone if needed
    if (config.onNeedMuteCameraAndMic(user)) {
      await toggleCamera(true);
      await toggleMic(true);
    }

    // Clean up old participant container, if it exists
    const existingWrapper = document.querySelector(`#video-wrapper-${user.id}`);
    if (existingWrapper) {
      existingWrapper.remove(); // Remove old template, if any
    }

    // Generate the participant HTML using the new template
    let participantHTML = config.participantPlayerContainer;
    console.log("Before replacement:", participantHTML);

    // Perform replacements
    participantHTML = participantHTML
      .replace(/{{uid}}/g, user.id)
      .replace(/{{name}}/g, user.name || "Guest User")
      .replace(/{{avatar}}/g, user.avatar || "path/to/default-avatar.png");

    console.log("After replacement:", participantHTML);

    // Insert the new template HTML into the container
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", participantHTML);

    // Check DOM after insertion to verify the content
    const insertedElement = document.querySelector(`#video-wrapper-${user.id}`);
    console.log("Inserted element in the DOM:", insertedElement.outerHTML);

    // Play the video track in the correct stream element
    if (user.id === config.uid) {
      const videoElement = document.querySelector(`#stream-${user.id}`);
      config.localVideoTrack.play(videoElement); // Play video in the correct stream div

      // Publish the local audio and video tracks
      await config.client.publish([
        config.localAudioTrack,
        config.localVideoTrack,
      ]);
    }
  } catch (error) {
    if (config.onError) {
      config.onError(error);
    } else {
      console.error("Error in joinToVideoStage:", error);
    }
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
  try {
    const uid = config.uid;
    const videoPlayer = document.querySelector(`#stream-${uid}`);
    const avatar = document.querySelector(`#avatar-${uid}`);

    if (isMuted) {
      await config.localVideoTrack.setMuted(true); // Mute the video track
      config.localVideoTrackMuted = true;

      // Show the avatar and hide the video player
      videoPlayer.style.display = "none";
      avatar.style.display = "block";
    } else {
      await config.localVideoTrack.setMuted(false); // Unmute the video track
      config.localVideoTrackMuted = false;

      // Hide the avatar and show the video player
      videoPlayer.style.display = "block";
      avatar.style.display = "none";
    }

    config.onCamMuted(uid, config.localVideoTrackMuted);
  } catch (error) {
    if (config.onError) {
      config.onError(error);
    } else {
      console.error("Error in toggleCamera:", error);
    }
  }
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





let cameraWasInitiallyOn = !config.localVideoTrackMuted; // Track initial camera state

const toggleScreenShare = async (isEnabled) => {
  const avatarElement = document.querySelector(`#avatar-${config.uid}`);
  const videoElement = document.querySelector(`#stream-${config.uid}`);

  if (isEnabled) {
    try {
      console.log("Starting screen sharing");

      // Store the initial camera state before starting screen sharing
      cameraWasInitiallyOn = !config.localVideoTrackMuted;

      // Hide the avatar when screen sharing starts
      if (avatarElement) {
        avatarElement.style.display = "none";
      }

      // If there is a camera track, stop and unpublish it before starting screen sharing
      if (config.localVideoTrack) {
        await config.localVideoTrack.stop();
        await config.client.unpublish([config.localVideoTrack]);
        config.localVideoTrack.close();
        config.localVideoTrack = null;
      }

      // Create and publish the screen share track
      config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();

      config.localScreenShareTrack.on("track-ended", async () => {
        console.log("Screen share track ended");
        await toggleScreenShare(false); // Automatically stop screen sharing when the user stops it
      });

      await config.client.publish([config.localScreenShareTrack]);

      // Ensure the video player is visible during screen sharing
      videoElement.style.display = "block";
      config.localScreenShareTrack.play(videoElement); // Play screen share in the correct div

      config.localScreenShareEnabled = true;
      config.onScreenShareEnabled(config.localScreenShareEnabled);
    } catch (e) {
      console.error("Error during screen sharing:", e);
      config.onError(e);
    }
  } else {
    try {
      // Stop screen sharing
      if (config.localScreenShareTrack) {
        console.log("Stopping screen share track");
        config.localScreenShareTrack.stop();
        await config.client.unpublish([config.localScreenShareTrack]);
        config.localScreenShareTrack = null;
      }

      // Restore camera state based on its initial state before screen sharing
      if (cameraWasInitiallyOn) {
        console.log("Re-enabling the camera because it was originally on");
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await config.client.publish([config.localVideoTrack]);
        config.localVideoTrack.play(`stream-${config.uid}`);

        // Ensure the video player is visible, and the avatar is hidden
        videoElement.style.display = "block";
        if (avatarElement) {
          avatarElement.style.display = "none";
        }
      } else {
        // If the camera was off initially, keep it off and show the avatar
        console.log("Camera was off initially, keeping it off");
        videoElement.style.display = "none";
        if (avatarElement) {
          avatarElement.style.display = "block";
        }
      }

      config.localScreenShareEnabled = false;
      config.onScreenShareEnabled(config.localScreenShareEnabled);
    } catch (e) {
      console.error("Error while stopping screen sharing:", e);
      config.onError(e);
    }
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



