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
    console.log("Initializing audio recording RTM client");

    // Always create a fresh RTM client to avoid issues
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
        console.log(
          "Audio recording RTM disconnected but recording is active, reconnecting..."
        );
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

    // Setup periodic connectivity check
    this.setupConnectivityCheck(config, fetchTokens);
  },

  // Join the channel
  async joinChannel(config) {
    console.log("Joining audio recording RTM channel");

    if (!this.rtmClient) {
      console.error("RTM client not initialized, initializing now");
      await this.initRTM(config, fetchTokens);
    }

    this.channelRTM = this.rtmClient.createChannel(config.channelName);

    // Add event listeners for channel events
    this.channelRTM.on("MemberLeft", (memberId) => {
      console.log(`Member left audio recording channel: ${memberId}`);
      // If our own client left, try to rejoin
      if (memberId === "3" && this.isActive) {
        console.log(
          "Our audio recording client left the channel, attempting to rejoin"
        );
        this.rejoins;
      }
    });

    // Add more channel event listeners
    this.channelRTM.on("MemberJoined", (memberId) => {
      console.log(`Member joined audio recording channel: ${memberId}`);
    });

    // Add channel message handling
    this.channelRTM.on("ChannelMessage", (message, memberId) => {
      console.log(
        `Message in audio recording channel from ${memberId}:`,
        message
      );
    });

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

      // Check if we need to create a new client
      if (!this.rtmClient) {
        this.rtmClient = AgoraRTM.createInstance(config.appId, {
          enableLogUpload: false,
          logFilter: config.debugEnabled
            ? AgoraRTM.LOG_FILTER_INFO
            : AgoraRTM.LOG_FILTER_OFF,
        });

        // Re-add the event listeners
        this.rtmClient.on("ConnectionStateChanged", (newState, reason) => {
          console.log(
            `Audio Recording RTM state changed: ${newState}, reason: ${reason}`
          );
          if (newState === "DISCONNECTED" && this.isActive) {
            this.reconnect(config, fetchTokens);
          }
        });
      }

      // Login again
      await this.rtmClient.login({
        uid: audioRtmUid,
        token: tokens.rtmToken,
      });

      // Create a new channel if needed
      if (!this.channelRTM) {
        this.channelRTM = this.rtmClient.createChannel(config.channelName);

        // Re-add channel event listeners
        this.channelRTM.on("MemberLeft", (memberId) => {
          console.log(`Member left audio recording channel: ${memberId}`);
        });

        this.channelRTM.on("MemberJoined", (memberId) => {
          console.log(`Member joined audio recording channel: ${memberId}`);
        });
      }

      // Join the channel
      await this.channelRTM.join();
      console.log(
        "Audio recording RTM client rejoined channel:",
        config.channelName
      );
    } catch (error) {
      console.error("Failed to reconnect audio recording RTM:", error);
      // Retry after a delay
      setTimeout(() => this.reconnect(config, fetchTokens), 5000);
    }
  },

  // Setup periodic connectivity check
  setupConnectivityCheck(config, fetchTokens) {
    // Clear any existing interval
    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval);
    }

    // Check connection every 10 seconds
    this.connectivityCheckInterval = setInterval(() => {
      if (!this.isActive) {
        // Stop checking if recording is no longer active
        clearInterval(this.connectivityCheckInterval);
        this.connectivityCheckInterval = null;
        return;
      }

      // Check if client is connected and in channel
      const isConnected =
        this.rtmClient && this.rtmClient.connectionState === "CONNECTED";
      const isInChannel = this.channelRTM != null;

      console.log(
        `Audio recording RTM connectivity check: connected=${isConnected}, inChannel=${isInChannel}`
      );

      // Reconnect if needed
      if (!isConnected || !isInChannel) {
        console.log("Audio recording RTM needs reconnection");
        this.reconnect(config, fetchTokens);
      }
    }, 10000);
  },

  // Explicitly clean up
  async cleanup() {
    console.log("Cleaning up audio recording RTM");
    this.isActive = false;

    // Clear connectivity check
    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval);
      this.connectivityCheckInterval = null;
    }

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
