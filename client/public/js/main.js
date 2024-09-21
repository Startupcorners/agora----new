import { defaultConfig } from "./config.js";
import { log, imageUrlToBase64, debounce } from "./utils.js";
import { setupAgoraRTCClient } from "./agoraRTCClient.js";
import { setupAgoraRTMClient } from "./agoraRTMClient.js";
import { recordingFunctions } from "./recording.js";

export class newMainApp {
  constructor(userConfig = {}) {
    try {
      // Merge defaultConfig with userConfig, ensuring defaultConfig.appId isn't overwritten
      this.config = {
        ...defaultConfig,
        ...userConfig,
        appId: defaultConfig.appId, // Ensure appId falls back to defaultConfig.appId
      };

      // Log the appId to verify
      console.log("Agora appId in MainApp constructor:", this.config.appId);

      this.validateConfig(); // Validate the configuration
      this.initializeAgoraClients(); // Initialize Agora clients
      this.setupEventListeners(); // Setup necessary event listeners
    } catch (error) {
      console.error("Error initializing MainApp:", error);
      throw error;
    }
  }

  validateConfig() {
    if (!this.config.channelName)
      throw new Error("Please set the channelName first");
    if (!this.config.uid) throw new Error("Please set the uid first");
  }

  initializeAgoraClients() {
    this.client = setupAgoraRTCClient(this.config);
    const { clientRTM, channelRTM } = setupAgoraRTMClient(this.config);
    this.config.clientRTM = clientRTM;
    this.config.channelRTM = channelRTM;
    this.config.client = this.client;
  }

  initializeRecordingFunctions() {
    const { acquireResource, startRecording, stopRecording } =
      recordingFunctions(this.config);
    this.acquireResource = acquireResource;
    this.startRecording = startRecording;
    this.stopRecording = stopRecording;
  }

  initializeVirtualBackground() {
    try {
      const extensionVirtualBackground = new VirtualBackgroundExtension();
      if (!extensionVirtualBackground.checkCompatibility()) {
        log("Does not support Virtual Background!", this.config);
      }
      AgoraRTC.registerExtensions([extensionVirtualBackground]);
    } catch (error) {
      console.error("Error initializing Virtual Background:", error);
      // Decide whether to throw this error or just log it
    }
  }

  setupEventListeners() {
    window.addEventListener("resize", this.updateVideoWrapperSize.bind(this));
    document.addEventListener(
      "DOMContentLoaded",
      this.updateVideoWrapperSize.bind(this)
    );
  }

  async fetchToken() {
    if (this.config.serverUrl !== "") {
      try {
        const res = await fetch(
          `${this.config.serverUrl}/access-token?channelName=${this.config.channelName}&uid=${this.config.uid}`
        );
        const data = await res.json();
        console.log("Fetched Token Data:", data); // <-- Add this line to debug the response
        this.config.token = data.token;
        return data.token;
      } catch (err) {
        log(err, this.config);
        throw err;
      }
    } else {
      return this.config.token;
    }
  }

  updateVideoWrapperSize = () => {
    const videoStage = document.getElementById("video-stage");
    const videoWrappers = videoStage.querySelectorAll('[id^="video-wrapper-"]');
    const count = videoWrappers.length;
    const screenWidth = window.innerWidth;
    const maxWrapperWidth = 800;

    videoWrappers.forEach((wrapper) => {
      wrapper.style.boxSizing = "border-box";

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
  };

  async join() {
    await this.joinRTM();
    const token = await this.fetchToken();
    await this.client.join(
      this.config.appId,
      this.config.channelName,
      token,
      this.config.uid
    );

    const roleToSet =
      this.config.user.role === "audience" ? "audience" : "host";
    await this.client.setClientRole(roleToSet);

    if (this.config.onNeedJoinToVideoStage(this.config.user)) {
      await this.joinToVideoStage(this.config.user);
    }
  }

  async joinRTM() {
    try {
      const rtmUid = this.config.uid.toString();
      const rtmToken = await this.fetchToken(); // Fetch the RTM token

      await this.config.clientRTM.login({ uid: rtmUid, token: rtmToken });
      await this.config.clientRTM.addOrUpdateLocalUserAttributes({
        name: this.config.user.name,
        avatar: this.config.user.avatar,
        role: this.config.user.role,
      });
      await this.config.channelRTM.join();
      this.handleOnUpdateParticipants();
    } catch (error) {
      log("RTM join process failed:", error, this.config);
      throw error;
    }
  }

  async joinToVideoStage(user) {
    try {
      this.config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      this.config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      if (this.config.onNeedMuteCameraAndMic(user)) {
        await this.toggleCamera(true);
        await this.toggleMic(true);
      }

      const existingWrapper = document.querySelector(
        `#video-wrapper-${user.id}`
      );
      if (existingWrapper) {
        existingWrapper.remove();
      }

      let participantHTML = this.config.participantPlayerContainer
        .replace(/{{uid}}/g, user.id)
        .replace(/{{name}}/g, user.name || "Guest User")
        .replace(/{{avatar}}/g, user.avatar || "path/to/default-avatar.png");

      document
        .querySelector(this.config.callContainerSelector)
        .insertAdjacentHTML("beforeend", participantHTML);

      if (user.id === this.config.uid) {
        const videoElement = document.querySelector(`#stream-${user.id}`);
        this.config.localVideoTrack.play(videoElement);
        await this.config.client.publish([
          this.config.localAudioTrack,
          this.config.localVideoTrack,
        ]);
      }
    } catch (error) {
      if (this.config.onError) {
        this.config.onError(error);
      } else {
        console.error("Error in joinToVideoStage:", error);
      }
    }
  }

  async leaveFromVideoStage(user) {
    let player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player != null) {
      player.remove();
    }

    if (user.id === this.config.uid) {
      try {
        this.config.localAudioTrack.stop();
        this.config.localVideoTrack.stop();
        this.config.localAudioTrack.close();
        this.config.localVideoTrack.close();
        await this.client.unpublish([
          this.config.localAudioTrack,
          this.config.localVideoTrack,
        ]);
      } catch (error) {
        log(error, this.config);
      }
    }
  }

  async leave() {
    document.querySelector(this.config.callContainerSelector).innerHTML = "";
    await Promise.all([this.client.leave(), this.config.clientRTM.logout()]);
    this.config.onUserLeave();
  }

  async toggleMic(isMuted) {
    await this.config.localAudioTrack.setMuted(isMuted);
    this.config.localAudioTrackMuted = isMuted;
    this.config.onMicMuted(this.config.localAudioTrackMuted);
  }

  async toggleCamera(isMuted) {
    try {
      const uid = this.config.uid;
      const videoPlayer = document.querySelector(`#stream-${uid}`);
      const avatar = document.querySelector(`#avatar-${uid}`);

      if (!this.config.localVideoTrack) {
        this.config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        videoPlayer.style.display = "block";
        this.config.localVideoTrack.play(videoPlayer);
        await this.config.client.publish([this.config.localVideoTrack]);
      }

      await this.config.localVideoTrack.setMuted(isMuted);
      this.config.localVideoTrackMuted = isMuted;

      videoPlayer.style.display = isMuted ? "none" : "block";
      avatar.style.display = isMuted ? "block" : "none";

      this.config.onCamMuted(uid, this.config.localVideoTrackMuted);
    } catch (error) {
      console.error("Error in toggleCamera:", error);
      if (this.config.onError) {
        this.config.onError(error);
      }
    }
  }

  async toggleScreenShare(isEnabled) {
    try {
      const uid = this.config.uid;
      const videoPlayer = document.querySelector(`#stream-${uid}`);
      const avatar = document.querySelector(`#avatar-${uid}`);

      if (isEnabled) {
        console.log("Starting screen share");

        // Store whether the camera was originally on before sharing
        this.wasCameraOnBeforeSharing = !this.config.localVideoTrackMuted;

        // Create the screen share track
        this.config.localScreenShareTrack =
          await AgoraRTC.createScreenVideoTrack();

        // If we successfully create the screen share track, stop and unpublish the local video track
        if (this.config.localVideoTrack) {
          this.config.localVideoTrack.stop();
          await this.config.client.unpublish([this.config.localVideoTrack]);
          videoPlayer.style.display = "none"; // Hide the video player
        }

        // Play and publish the screen share track
        this.config.localScreenShareTrack.on("track-ended", async () => {
          console.log("Screen share track ended, reverting back to camera");
          await this.toggleScreenShare(false); // Revert to camera when screen sharing stops
        });

        await this.config.client.publish([this.config.localScreenShareTrack]);
        this.config.localScreenShareTrack.play(videoPlayer);
        videoPlayer.style.display = "block"; // Show the screen share in the video player
        avatar.style.display = "none"; // Hide the avatar during screen share
      } else {
        console.log("Stopping screen share");

        // Stop screen sharing and revert to the camera
        if (this.config.localScreenShareTrack) {
          this.config.localScreenShareTrack.stop();
          await this.config.client.unpublish([
            this.config.localScreenShareTrack,
          ]);
          this.config.localScreenShareTrack = null;
        }

        // Recreate the camera video track and publish it if the camera was originally on
        if (!this.config.localVideoTrack) {
          this.config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        }

        await this.config.client.publish([this.config.localVideoTrack]);
        this.config.localVideoTrack.play(videoPlayer);

        // Restore the camera or avatar visibility based on the initial state before screen sharing
        if (this.wasCameraOnBeforeSharing) {
          videoPlayer.style.display = "block"; // Show video player if the camera was on before sharing
          avatar.style.display = "none"; // Hide avatar
        } else {
          videoPlayer.style.display = "none"; // Hide video player if the camera was off
          avatar.style.display = "block"; // Show avatar
        }
      }

      this.config.localScreenShareEnabled = isEnabled;
      this.config.onScreenShareEnabled(isEnabled);
    } catch (e) {
      console.error("Error during screen sharing:", e);
      this.config.onError(e);

      // If there's an error (like canceling screen share), ensure the local video is still active
      if (!isEnabled && !this.config.localVideoTrack) {
        this.config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await this.config.client.publish([this.config.localVideoTrack]);
        this.config.localVideoTrack.play(videoPlayer);

        // Restore camera or avatar visibility based on the initial state
        if (this.wasCameraOnBeforeSharing) {
          videoPlayer.style.display = "block"; // Show video player
          avatar.style.display = "none"; // Hide avatar
        } else {
          videoPlayer.style.display = "none"; // Hide video player
          avatar.style.display = "block"; // Show avatar
        }
      }
    }
  }

  sendMessageToPeer(data, uid) {
    this.config.clientRTM
      .sendMessageToPeer({ text: JSON.stringify(data) }, `${uid}`)
      .then(() => log("Message sent successfully", this.config))
      .catch((error) => log("Failed to send message:", error, this.config));
  }

  sendMessage(data) {
    this.config.channelRTM
      .sendMessage({ text: JSON.stringify(data) })
      .then(() => {})
      .catch((error) => log(error, this.config));
  }

  sendChat(data) {
    const messageObj = {
      ...data,
      type: "chat",
      sender: this.config.user,
    };
    this.sendMessage(messageObj);
    this.config.onMessageReceived(messageObj);
  }

  sendBroadcast(data) {
    const messageObj = {
      ...data,
      type: "broadcast",
      sender: this.config.user,
    };
    this.sendMessage(messageObj);
    this.config.onMessageReceived(messageObj);
  }

  turnOffMic(...uids) {
    uids.forEach((uid) => {
      this.sendMessageToPeer({ content: "", event: "mic_off" }, `${uid}`);
    });
  }

  turnOffCamera(...uids) {
    uids.forEach((uid) => {
      this.sendMessageToPeer({ content: "", event: "cam_off" }, `${uid}`);
    });
  }

  removeParticipant(...uids) {
    uids.forEach((uid) => {
      this.sendMessageToPeer(
        { content: "", event: "remove_participant" },
        `${uid}`
      );
    });
  }

  changeRole(uid, role) {
    const messageObj = {
      event: "change_user_role",
      targetUid: uid,
      role: role,
    };
    this.sendBroadcast(messageObj);
    this.handleOnUpdateParticipants();
    this.config.onRoleChanged(uid, role);
  }

  async getProcessorInstance() {
    if (!this.processor && this.config.localVideoTrack) {
      this.processor = this.extensionVirtualBackground.createProcessor();
      try {
        await this.processor.init();
        this.config.localVideoTrack
          .pipe(this.processor)
          .pipe(this.config.localVideoTrack.processorDestination);
      } catch (e) {
        log("Fail to load WASM resource!", this.config);
        return null;
      }
    }
    return this.processor;
  }

  async enableVirtualBackgroundBlur() {
    if (this.config.localVideoTrack) {
      let processor = await this.getProcessorInstance();
      processor.setOptions({ type: "blur", blurDegree: 2 });
      await processor.enable();
      this.config.isVirtualBackGroundEnabled = true;
    }
  }

  async enableVirtualBackgroundImage(imageSrc) {
    const imgElement = document.createElement("img");
    imgElement.onload = async () => {
      let processor = await this.getProcessorInstance();
      processor.setOptions({ type: "img", source: imgElement });
      await processor.enable();
      this.config.isVirtualBackGroundEnabled = true;
    };
    const base64 = await imageUrlToBase64(imageSrc);
    imgElement.src = base64;
  }

  async disableVirtualBackground() {
    let processor = await this.getProcessorInstance();
    if (processor) {
      processor.disable();
    }
    this.config.isVirtualBackGroundEnabled = false;
  }
}

window.newMainApp = newMainApp;