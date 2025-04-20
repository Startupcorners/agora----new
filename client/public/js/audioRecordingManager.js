// audioRecordingManager.js
const audioRecordingManager = {
  rtmClient: null,
  channelRTM: null,
  resourceId: null,
  sid: null,
  recordId: null,
  timestamp: null,
  isActive: false,

  // Initialize the RTM client
  async initRTM(config, fetchTokens) {
    if (this.rtmClient) return;

    this.rtmClient = AgoraRTM.createInstance(config.appId, {
      enableLogUpload: false,
      logFilter: config.debugEnabled
        ? AgoraRTM.LOG_FILTER_INFO
        : AgoraRTM.LOG_FILTER_OFF,
    });

    // Add event listeners for connection state
    this.rtmClient.on("ConnectionStateChanged", (newState, reason) => {
      console.log(
        `Audio Recording RTM state changed: ${newState}, reason: ${reason}`
      );
      if (newState === "DISCONNECTED" && this.isActive) {
        this.reconnect(config, fetchTokens);
      }
    });

    // Login with the dedicated recording UID
    const audioRtmUid = "3";
    const tokens = await fetchTokens(config, audioRtmUid);
    if (!tokens)
      throw new Error("Failed to fetch token for audio recording RTM");

    await this.rtmClient.login({
      uid: audioRtmUid,
      token: tokens.rtmToken,
    });

    console.log(
      "Audio recording RTM client initialized with UID:",
      audioRtmUid
    );
  },

  // Join the channel
  async joinChannel(config) {
    if (!this.rtmClient) {
      console.error("RTM client not initialized");
      return;
    }

    if (!this.channelRTM) {
      this.channelRTM = this.rtmClient.createChannel(config.channelName);

      // Add event listeners for channel events
      this.channelRTM.on("MemberLeft", (memberId) => {
        console.log(`Member left audio recording channel: ${memberId}`);
      });
    }

    await this.channelRTM.join();
    console.log(
      "Audio recording RTM client joined channel:",
      config.channelName
    );
  },

  // Reconnect if disconnected
  async reconnect(config, fetchTokens) {
    try {
      console.log("Attempting to reconnect audio recording RTM client...");

      const audioRtmUid = "3";
      const tokens = await fetchTokens(config, audioRtmUid);
      if (!tokens) throw new Error("Failed to fetch token for reconnection");

      await this.rtmClient.login({
        uid: audioRtmUid,
        token: tokens.rtmToken,
      });

      if (this.channelRTM) {
        await this.channelRTM.join();
        console.log(
          "Audio recording RTM client rejoined channel:",
          config.channelName
        );
      }
    } catch (error) {
      console.error("Failed to reconnect audio recording RTM:", error);
      setTimeout(() => this.reconnect(config, fetchTokens), 5000);
    }
  },

  // Explicitly clean up
  async cleanup() {
    this.isActive = false;

    if (this.channelRTM) {
      try {
        await this.channelRTM.leave();
        this.channelRTM = null;
      } catch (error) {
        console.error("Error leaving audio recording RTM channel:", error);
      }
    }

    if (this.rtmClient) {
      try {
        await this.rtmClient.logout();
        this.rtmClient = null;
      } catch (error) {
        console.error("Error logging out audio recording RTM client:", error);
      }
    }
  },
};

export default audioRecordingManager;
