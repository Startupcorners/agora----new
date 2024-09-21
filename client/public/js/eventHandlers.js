import * as eventHandlers from "./eventHandlers.js";
import { initAgoraApp } from "./init.js";
import { defaultConfig } from "./config.js";
import { log, imageUrlToBase64 } from "./utils.js";
import { setupAgoraRTCClient } from "./agoraRTCClient.js";
import { setupAgoraRTMClient } from "./agoraRTMClient.js";
import { recordingFunctions } from "./recording.js";

export function MainApp(initConfig) {
  let config = { ...defaultConfig, ...initConfig };
  let screenClient;
  let localScreenShareTrack;
  let wasCameraOnBeforeSharing = false;

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
        eventHandlers.handleError(config)(err);
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
  window.updateVideoWrapperSize = updateVideoWrapperSize;

  // Add a resize event listener to update video wrapper sizes dynamically
  window.addEventListener("resize", updateVideoWrapperSize);

  // Optionally, call the function once during initialization to set the initial layout
  document.addEventListener("DOMContentLoaded", () => {
    updateVideoWrapperSize();
  });

  // Join Function
  const join = async () => {
    // Start by joining the RTM (Real-Time Messaging) channel
    await joinRTM();

    // Join the Agora channel
    const token = await fetchToken();
    await client.join(config.appId, config.channelName, token, config.uid);

    // Set the client's role based on the user's role
    const roleToSet = config.user.role === "audience" ? "audience" : "host";
    await client.setClientRole(roleToSet);

    // If the user needs to join the video stage, proceed to publish tracks
    if (eventHandlers.handleNeedJoinToVideoStage(config)(config.user)) {
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
      eventHandlers.handleOnUpdateParticipants(config)(); // Correct reference
    } catch (error) {
      eventHandlers.handleError(config)(error);
      throw error;
    }
  };

  const joinToVideoStage = async (user) => {
    try {
      // Create local audio and video tracks
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      // Handle muting camera and microphone if needed
      if (eventHandlers.handleNeedMuteCameraAndMic(config)(user)) {
        await toggleCamera(true);
        await toggleMic(true);
      }

      // Clean up old participant container, if it exists
      const existingWrapper = document.querySelector(
        `#video-wrapper-${user.id}`
      );
      if (existingWrapper) {
        existingWrapper.remove(); // Remove old template, if any
      }

      // Generate the participant HTML using the new template
      let participantHTML = config.participantPlayerContainer;
      participantHTML = participantHTML
        .replace(/{{uid}}/g, user.id)
        .replace(/{{name}}/g, user.name || "Guest User")
        .replace(/{{avatar}}/g, user.avatar || "path/to/default-avatar.png");

      // Insert the new template HTML into the container
      document
        .querySelector(config.callContainerSelector)
        .insertAdjacentHTML("beforeend", participantHTML);

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
      eventHandlers.handleError(config)(error);
    }
  };

  // Leave from Video Stage
  const leaveFromVideoStage = async (user) => {
    const player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player) player.remove();

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
    console.log("User has left the call");
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

    eventHandlers.handleMicMuted(config)(config.localAudioTrackMuted);
  };

  // Toggle Camera
  const toggleCamera = async (isMuted) => {
    try {
      const uid = config.uid;
      const videoPlayer = document.querySelector(`#stream-${uid}`);
      const avatar = document.querySelector(`#avatar-${uid}`);

      if (!config.localVideoTrack) {
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        config.localVideoTrack.play(videoPlayer);
        await config.client.publish([config.localVideoTrack]);
      }

      if (isMuted) {
        await config.localVideoTrack.setMuted(true);
        config.localVideoTrackMuted = true;
        videoPlayer.style.display = "none";
        avatar.style.display = "block";
      } else {
        await config.localVideoTrack.setMuted(false);
        config.localVideoTrackMuted = false;
        videoPlayer.style.display = "block";
        avatar.style.display = "none";
      }

      eventHandlers.handleCamMuted(config)(uid, config.localVideoTrackMuted);
    } catch (error) {
      eventHandlers.handleError(config)(error);
    }
  };

  // Send Message to Peer
  const sendMessageToPeer = (data, uid) => {
    config.clientRTM
      .sendMessageToPeer({ text: JSON.stringify(data) }, `${uid}`)
      .then(() => log("Message sent successfully", config))
      .catch((error) => eventHandlers.handleError(config)(error));
  };

  // Send Message
  const sendMessage = (data) => {
    config.channelRTM
      .sendMessage({ text: JSON.stringify(data) })
      .then(() => {})
      .catch((error) => eventHandlers.handleError(config)(error));
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
    sendMessageToPeer,
  };
}
window["MainApp"] = MainApp;
