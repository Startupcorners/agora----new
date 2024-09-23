
/**
 * please include agora on your html, since this not use nodejs import module approach
 * <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
 * <script src="https://cdn.jsdelivr.net/npm/agora-rtm-sdk@1.3.1/index.js"></script>
 * <script src="https://unpkg.com/agora-extension-virtual-background@1.2.0/agora-extension-virtual-background.js"></script>
 */
const templateVideoParticipant = `<div id="video-wrapper-{{uid}}" style="
  flex: 1 1 auto;
  width: 100%; /* Start with full width */
  height: auto;
  max-width: 100%;
  max-height: calc(100vh - 20px); /* Ensure it stays within the screen */
  aspect-ratio: 16/9; /* Maintain a 16:9 ratio */
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px;
  border-radius: 10px;
  background-color: #3c4043;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
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
  let screenClient;
  let localScreenShareTrack;
  let wasCameraOnBeforeSharing = false;
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
      bubble_fn_participantList(participantIds);
    },
    onParticipantLeft: (user) => {
      log("onParticipantLeft");
      log(user);
      bubble_fn_participantList(participantIds);
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
      console.log(
        `Microphone muted for UID ${config.uid}: ${
          isMuted ? "Mic Off" : "Mic On"
        }`
      );
      const micStatusIcon = document.querySelector(`#mic-status-${config.uid}`);
      if (micStatusIcon) {
        micStatusIcon.style.display = isMuted ? "block" : "none";
      }
      bubble_fn_isMicOff(isMuted);
    },


    onCamMuted: (uid, isMuted) => {
  console.log(
    `Camera muted for UID ${uid}: ${isMuted ? "Camera Off" : "Camera On"}`
  );

  const videoWrapper = document.querySelector(`#video-wrapper-${uid}`);
  if (videoWrapper) {
    const videoPlayer = videoWrapper.querySelector(`#stream-${uid}`);
    const avatarDiv = videoWrapper.querySelector(`#avatar-${uid}`);

    if (isMuted) {
      videoPlayer.style.display = "none"; // Hide the video player
      avatarDiv.style.display = "block"; // Show the avatar
    } else {
      videoPlayer.style.display = "block"; // Show the video player
      avatarDiv.style.display = "none"; // Hide the avatar
    }
  }

  // Call any additional functions related to camera muting, like in Bubble
  console.log("Run bubble_fn_isCamOff.", isMuted);
  bubble_fn_isCamOff(isMuted);
},
    onScreenShareEnabled: (enabled) => {
      console.log(
        `Screen share status: ${enabled ? "Sharing" : "Not sharing"}`
      );
      bubble_fn_isScreenOff(enabled);
    },
    onUserLeave: () => {
      log("onUserLeave");
      bubble_fn_participantList(participantIds);
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
        `/generateTokens?channelName=${config.channelName}&uid=${config.uid}&role=${config.user.role}`
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
    // Initialize the Agora RTC client
    config.client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

    // Fetch both RTC and RTM tokens
    const tokens = await fetchTokens(); // Ensure this returns both rtcToken and rtmToken
    console.log("RTC Token (during join):", tokens.rtcToken);
    console.log("RTM Token (during join):", tokens.rtmToken);
    console.log("RTC UID (during join):", config.uid);

    // Set the RTC client role based on the user's role
    await config.client.setClientRole(
      config.user.role === "audience" ? "audience" : "host"
    );
    console.log("Client role set to:", config.user.role);

    // Register RTC event listeners
    config.client.on("user-published", handleUserPublished);
    config.client.on("user-unpublished", handleUserUnpublished);
    config.client.on("user-joined", handleUserJoined);
    config.client.on("user-left", handleUserLeft);
    config.client.enableAudioVolumeIndicator();
    config.client.on("volume-indicator", handleVolumeIndicator);
    config.client.on("token-privilege-will-expire", handleRenewToken);

    // Join the Agora RTC channel using the fetched RTC token
    const { appId, uid, channelName } = config;
    console.log(
      "Joining RTC channel with appId:",
      appId,
      ", channelName:",
      channelName,
      ", UID:",
      uid
    );
    await config.client.join(appId, channelName, tokens.rtcToken, uid);

    // Call the joinRTM function to handle RTM join
    await joinRTM(tokens.rtmToken);

    // User joins the video stage with camera off
    if (config.onNeedJoinToVideoStage(config.user)) {
      await joinToVideoStage(config.user); // Ensure camera is off initially
    }

    console.log("Joined RTC and RTM successfully!");
  } catch (error) {
    console.error("Failed to join the RTC or RTM channel:", error);
  }
};

function updateVideoWrapperSize() {
  const videoStage = document.getElementById("video-stage");

  if (!videoStage) {
    console.error("Error: #video-stage element not found.");
    return;
  }

  const videoWrappers = videoStage.querySelectorAll('[id^="video-wrapper-"]');
  const count = videoWrappers.length;
  const stageWidth = videoStage.clientWidth; // Get the width of the video-stage
  const stageHeight = videoStage.clientHeight; // Get the height of the video-stage

  const maxWrapperWidth = Math.min(800, stageWidth * 0.8); // Max 80% of the video-stage width
  const maxWrapperHeight = (maxWrapperWidth * 9) / 16; // Maintain a 16:9 aspect ratio

  videoStage.style.overflowY = "auto"; // Add vertical scroll if needed

  videoWrappers.forEach((wrapper) => {
    wrapper.style.boxSizing = "border-box";
    wrapper.style.margin = "10px"; // Adjust margin for better spacing
    wrapper.style.borderRadius = "10px";
    wrapper.style.overflow = "hidden";
    wrapper.style.position = "relative";
    wrapper.style.backgroundColor = "#3c4043";
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "center";
    wrapper.style.alignItems = "center";
    wrapper.style.height = "auto"; // Auto height to prevent overflow
    wrapper.style.maxHeight = `${maxWrapperHeight}px`; // Limit height to 80% of video-stage height

    // Handle small screens (<= 768px) or if the video-stage is narrow
    if (stageWidth <= 768) {
      wrapper.style.flex = "1 1 100%"; // Full width for narrow stages
      wrapper.style.maxWidth = "100%";
      wrapper.style.minHeight = "50vh";
    } else {
      // Adjust for larger video-stages based on participant count
      if (count === 1) {
        wrapper.style.flex = "0 1 auto";
        wrapper.style.width = `${maxWrapperWidth}px`;
        wrapper.style.height = `${maxWrapperHeight}px`; // 16:9 aspect ratio
      } else if (count === 2) {
        wrapper.style.flex = "1 1 45%"; // 45% width for two players
        wrapper.style.maxWidth = "45%";
        wrapper.style.height = `${(stageWidth * 0.45 * 9) / 16}px`; // 16:9 aspect ratio
      } else if (count === 3) {
        wrapper.style.flex = "1 1 30%"; // 30% width for three players
        wrapper.style.maxWidth = "30%";
        wrapper.style.height = `${(stageWidth * 0.3 * 9) / 16}px`; // 16:9 aspect ratio
      } else if (count >= 4 && count <= 9) {
        wrapper.style.flex = "1 1 23%"; // 23% width for 4-9 players
        wrapper.style.maxWidth = "23%";
        wrapper.style.height = `${(stageWidth * 0.23 * 9) / 16}px`; // 16:9 aspect ratio
      } else {
        wrapper.style.flex = "1 1 15%"; // For 10 or more participants
        wrapper.style.maxWidth = "15%";
        wrapper.style.height = `${(stageWidth * 0.15 * 9) / 16}px`; // 16:9 aspect ratio
      }

      wrapper.style.minWidth = `200px`; // Ensure minimum width
    }

    // Ensure video content stays visible and fits inside the wrapper
    const videoPlayer = wrapper.querySelector(".video-player");
    const avatar = wrapper.querySelector(".user-avatar");

    // Check if the camera is off, and adjust display accordingly
    if (videoPlayer && avatar) {
      if (videoPlayer.style.display === "none") {
        avatar.style.display = "block"; // Show avatar when the camera is off
        wrapper.style.justifyContent = "center"; // Center the avatar
        wrapper.style.alignItems = "center"; // Ensure vertical centering
      } else {
        avatar.style.display = "none"; // Hide avatar when the camera is on
        videoPlayer.style.display = "flex"; // Ensure video player uses flex
        wrapper.style.justifyContent = "center"; // Center the video player
        wrapper.style.alignItems = "center"; // Ensure vertical centering
      }
    }
  });

  // Add overflow control for the video-stage to prevent overflow
  videoStage.style.overflowX = "hidden"; // Prevent horizontal overflow
  videoStage.style.overflowY = count > 3 ? "auto" : "hidden"; // Scroll vertically if needed
}

// Add a resize event listener to update video wrapper sizes dynamically
window.addEventListener("resize", updateVideoWrapperSize);

// Call the function once during initialization to set the initial layout
document.addEventListener("DOMContentLoaded", () => {
  updateVideoWrapperSize();
});


const handleUserUnpublished = async (user, mediaType) => {
  if (mediaType === "video") {
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      // Remove the entire video wrapper from the DOM
      videoWrapper.remove();
    }
  }

  if (mediaType === "audio") {
    console.log(`User ${user.uid} has unpublished their audio.`);
    // Handle any specific audio-related logic here, if necessary
  }
};


const joinToVideoStage = async (user) => {
  try {
    // Create local audio track
    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    // Initialize the video track but keep it off initially
    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    // Remove any previous instance of the video player container for this user
    let player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player != null) {
      player.remove(); // Remove old player if it exists
    }

    // Generate the player's HTML container using the name, avatar, and role passed from `newMainApp()`
    let localPlayerContainer = config.participantPlayerContainer
      .replaceAll("{{uid}}", user.id)
      .replaceAll("{{name}}", user.name || "Unknown User") // Fallback to "Unknown User"
      .replaceAll("{{avatar}}", user.avatar || "path/to/default-avatar.png"); // Fallback avatar

    // Insert the new player container into the video stage
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", localPlayerContainer);

    // Set the video to be off (not played) initially and show the avatar
    const videoPlayer = document.querySelector(`#stream-${user.id}`);
    const avatarDiv = document.querySelector(`#avatar-${user.id}`);

    // Hide the video player and show the avatar
    videoPlayer.style.display = "none"; // Make sure video player is hidden
    avatarDiv.style.display = "block"; // Ensure avatar is visible

    // Mute the video track by default (camera off) and set the state
    await config.localVideoTrack.setMuted(true);
    config.localVideoTrackMuted = true;

    // Trigger the `onCamMuted` event to indicate the camera is off
    config.onCamMuted(user.id, true); // Camera is off by default

    // Publish only the local audio track (video remains off)
    await config.client.publish([config.localAudioTrack]);

    // Handle any user-specific muting requirements (camera/mic)
    if (config.onNeedMuteCameraAndMic(user)) {
      toggleCamera(true); // Keep the camera off
      toggleMic(true); // Optionally mute the microphone
    }

    // Call updateVideoWrapperSize to ensure proper layout
    updateVideoWrapperSize();
  } catch (error) {
    console.error("Error joining video stage:", error);
    if (config.onError) {
      config.onError(error);
    }
  }
};






const joinRTM = async (rtmToken) => {
  try {
    // Convert UID to string for RTM login
    const rtmUid = config.uid.toString();

    // Log the RTM Token and UID
    console.log("RTM Token (during login):", rtmToken);
    console.log("RTM UID (during login):", rtmUid);

    // Check if the user is already logged in, and log out if necessary
    if (clientRTM.connectionState === "CONNECTED") {
      console.log("User is already logged in, logging out first...");
      await clientRTM.logout();
      console.log("User successfully logged out from RTM.");
    }

    // RTM login with the token
    await clientRTM.login({ token: rtmToken, uid: rtmUid });
    console.log(`RTM login successful for UID: ${rtmUid}`);

    // Update local user attributes in RTM (name, avatar)
    await clientRTM.addOrUpdateLocalUserAttributes({
      name: config.user.name, // Set user's name
      avatar: config.user.avatar, // Set user's avatar
    });
    console.log("User attributes (name, avatar) updated in RTM.");

    // Join the RTM channel
    await channelRTM.join();
    console.log("Joined RTM channel successfully");
  } catch (error) {
    console.error("RTM join process failed:", error);
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
  try {
    const uid = config.uid;
    const videoPlayer = document.querySelector(`#stream-${uid}`);
    const avatar = document.querySelector(`#avatar-${uid}`);

    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    // Log the current state before toggling the camera
    console.log(`Camera is about to be ${isMuted ? "muted" : "unmuted"}`);
    console.log("Video player element:", videoPlayer);
    console.log("Avatar element:", avatar);

    if (!videoPlayer) {
      console.error(`Video player with id #stream-${uid} not found`);
      return;
    }

    // Check if the video track exists, if not create and initialize it
    if (!config.localVideoTrack) {
      console.log("Initializing new camera video track...");
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    }

    // Mute or unmute the video track
    if (isMuted) {
      console.log("Muting camera...");
      await config.localVideoTrack.setMuted(true);
      config.localVideoTrackMuted = true;

      // Show the avatar and hide the video player
      videoPlayer.style.display = "none";
      avatar.style.display = "block";
    } else {
      console.log("Unmuting camera...");

      // Ensure the video player is visible
      videoPlayer.style.display = "block";
      avatar.style.display = "none";

      // Reattach and play the video track inside the video player
      if (
        videoPlayer.childNodes.length === 0 ||
        !videoPlayer.querySelector("video")
      ) {
        console.log("Reattaching video element...");
        config.localVideoTrack.play(videoPlayer); // Reattach the video track to the player
      } else {
        console.log("Video element already exists, playing it.");
        config.localVideoTrack.play(videoPlayer); // Ensure the track plays
      }

      // Ensure the track is unmuted
      await config.localVideoTrack.setMuted(false);
      config.localVideoTrackMuted = false;
    }

    console.log(
      `Camera muted for UID ${uid}: ${isMuted ? "Camera Off" : "Camera On"}`
    );

    // Correctly call onCamMuted with both uid and the muted state
    config.onCamMuted(uid, config.localVideoTrackMuted);
  } catch (error) {
    console.error("Error in toggleCamera:", error);
    if (config.onError) {
      config.onError(error);
    }
  }
};

const leaveFromVideoStage = async (user) => {
  try {
    // Find and remove the video wrapper element for the user
    let player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player != null) {
      player.remove(); // Remove the user's video element from the DOM
    }

    // If the leaving user is the current user
    if (user.id === config.uid) {
      // Stop and close the local audio and video tracks
      if (config.localAudioTrack) {
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
      }
      if (config.localVideoTrack) {
        config.localVideoTrack.stop();
        config.localVideoTrack.close();
      }

      // Unpublish the user's tracks
      await config.client.unpublish([
        config.localAudioTrack,
        config.localVideoTrack,
      ]);
    }

    console.log(`User ${user.id} left the video stage.`);
  } catch (error) {
    console.error("Error leaving video stage:", error);
    if (config.onError) {
      config.onError(error);
    }
  }
};


const toggleScreenShare = async (isEnabled) => {
  try {
    const uid = config.uid;
    const videoPlayer = document.querySelector(`#stream-${uid}`);
    const avatar = document.querySelector(`#avatar-${uid}`);

    if (!config.client) {
      console.error("Agora client is not initialized!");
      return;
    }

    if (config.localScreenShareEnabled && isEnabled) {
      console.log("Already sharing. Stopping screen share.");
      isEnabled = false;
    }

    if (isEnabled) {
      console.log("Starting screen share");
      wasCameraOnBeforeSharing = !config.localVideoTrackMuted;

      // Create the screen share track if it doesn't already exist
      if (!config.localScreenShareTrack) {
        console.log("Creating screen share track...");
        config.localScreenShareTrack = await AgoraRTC.createScreenVideoTrack();
      }

      // Stop and unpublish the local video track before screen share
      if (config.localVideoTrack) {
        console.log(
          "Stopping and unpublishing local video track before screen share..."
        );
        config.localVideoTrack.stop();
        await config.client.unpublish([config.localVideoTrack]);
        videoPlayer.style.display = "none";
      }

      // Play and publish the screen share track
      config.localScreenShareTrack.on("track-ended", async () => {
        console.log("Screen share track ended, reverting back to camera");
        await toggleScreenShare(false); // Revert to camera when screen sharing stops
      });

      await config.client.publish([config.localScreenShareTrack]);
      config.localScreenShareTrack.play(videoPlayer);
      videoPlayer.style.display = "block";
      avatar.style.display = "none";
    } else {
      console.log("Stopping screen share");

      // Stop the screen share and revert to the camera
      if (config.localScreenShareTrack) {
        console.log("Stopping and closing the screen share track...");
        config.localScreenShareTrack.stop();
        config.localScreenShareTrack.close();
        await config.client.unpublish([config.localScreenShareTrack]);
        config.localScreenShareTrack = null;
      }

      // Reinitialize the camera track only if it was on before sharing
      if (wasCameraOnBeforeSharing) {
        console.log("Restoring camera track after screen share...");
        if (!config.localVideoTrack) {
          console.log("Creating new camera video track...");
          config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        }

        console.log("Publishing and playing the camera track...");
        await config.client.publish([config.localVideoTrack]);

        // Re-attach video track to the video player element
        if (videoPlayer) {
          console.log("Playing camera video track in videoPlayer...");
          config.localVideoTrack.play(videoPlayer);
          videoPlayer.style.display = "block";
          avatar.style.display = "none";
        } else {
          console.error("Video player not found for camera playback!");
        }
      } else {
        // If the camera was off, show the avatar
        console.log("Camera was off before sharing, showing avatar...");
        videoPlayer.style.display = "none";
        avatar.style.display = "block";
      }
    }

    config.localScreenShareEnabled = isEnabled;
    config.onScreenShareEnabled(isEnabled);
  } catch (error) {
    console.error("Error during screen sharing:", error);
    config.onError(error);

    // Ensure local video is active in case of an error
    if (!isEnabled && !config.localVideoTrack) {
      try {
        console.log("Reinitializing camera track after error...");
        config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await config.client.publish([config.localVideoTrack]);

        if (videoPlayer) {
          console.log(
            "Playing camera video track in videoPlayer after error..."
          );
          config.localVideoTrack.play(videoPlayer);

          if (wasCameraOnBeforeSharing) {
            videoPlayer.style.display = "block";
            avatar.style.display = "none";
          } else {
            videoPlayer.style.display = "none";
            avatar.style.display = "block";
          }
        } else {
          console.error("Video player not found after error!");
        }
      } catch (cameraError) {
        console.error("Error reinitializing camera track:", cameraError);
      }
    }
  }
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
  try {
    console.log(`User published: ${user.uid}, mediaType: ${mediaType}`);

    // Call the subscribe function to handle the media (video/audio)
    await subscribe(user, mediaType);
  } catch (error) {
    console.error("Error handling user published:", error);
  }
};



const handleUserJoined = async (user) => {
  try {
    console.log(`User joined with UID: ${user.uid}`);

    // Fetch user attributes from RTM
    const userAttributes = await clientRTM.getUserAttributes(
      user.uid.toString()
    );
    const userName = userAttributes.name || `User ${user.uid}`;
    const userAvatar = userAttributes.avatar || "path/to/default-avatar.png";

    console.log("User name:", userName);
    console.log("User avatar:", userAvatar);

    // Store user info in userInfoMap
    config.userInfoMap = config.userInfoMap || {}; // Ensure it's initialized as an empty object
    config.userInfoMap[user.uid] = {
      id: user.uid,
      name: userName,
      avatar: userAvatar,
    };

    // Generate the player's HTML container for the user
    let playerHTML = config.participantPlayerContainer
      .replace(/{{uid}}/g, user.uid)
      .replace(/{{name}}/g, userName)
      .replace(/{{avatar}}/g, userAvatar);

    // Insert the new player container into the video stage
    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", playerHTML);

    // Ensure the avatar is displayed and the video player is hidden until video is published
    const videoPlayer = document.querySelector(`#stream-${user.uid}`);
    const avatarDiv = document.querySelector(`#avatar-${user.uid}`);

    if (videoPlayer && avatarDiv) {
      videoPlayer.style.display = "none"; // Hide the video player (camera off initially)
      avatarDiv.style.display = "block"; // Show the avatar
    }

    // Call updateVideoWrapperSize to adjust the layout after the new player is added
    updateVideoWrapperSize();
  } catch (error) {
    console.error("Error during user join:", error);
  }
};




const handleUserLeft = async (user, reason) => {
  try {
    // Log the reason why the user left (if needed)
    console.log(`User ${user.uid} left due to ${reason}`);

    // Clean up remote tracks
    delete config.remoteTracks[user.uid];

    // Remove the user's video player
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      videoWrapper.remove();
    }

    // Trigger any additional logic (if any)
    if (typeof config.onParticipantLeft === "function") {
      config.onParticipantLeft(user);
    }

    // Stop and clean up audio tracks if they exist
    if (
      config.remoteTracks[user.uid] &&
      config.remoteTracks[user.uid].audioTrack
    ) {
      config.remoteTracks[user.uid].audioTrack.stop();
    }

    // Call the function to update the layout after a user leaves
    updateVideoWrapperSize();
  } catch (error) {
    console.error(`Error handling user left: ${error}`);
  }
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
  try {
    // Fetch a new token
    const newToken = await fetchToken();
    config.token = newToken;

    // Renew the Agora token for the RTC client
    await config.client.renewToken(config.token);
    console.log("RTC token renewed successfully!");

    // For RTM, log the user out first and then re-login with the new token
    if (clientRTM && clientRTM.getConnectionState() === "CONNECTED") {
      await clientRTM.logout();
      console.log("Logged out from RTM for token renewal.");
    }

    // Renew RTM Token
    await clientRTM.login({ token: newToken, uid: config.uid.toString() });
    console.log("RTM token renewed and re-logged successfully!");

    // Optionally re-join the RTM channel if required
    await channelRTM.join();
    console.log("Re-joined RTM channel after token renewal.");
  } catch (error) {
    console.error("Error during token renewal process:", error);

    if (error.code === 5) {
      console.error("RTM login failed: Token invalid or expired.");
      // Handle token invalid or expired scenario, possibly retry the process
    } else {
      console.error("Unexpected error during token renewal:", error);
    }
  }
};


const subscribe = async (user, mediaType) => {
  try {
    // Subscribe to the user's published media (video or audio)
    await config.client.subscribe(user, mediaType);

    // Handle video subscription
    if (mediaType === "video") {
      let player = document.querySelector(`#video-wrapper-${user.uid}`);

      // If player doesn't exist, create it
      if (!player) {
        // Fetch user attributes (name, avatar, etc.) from RTM
        const userAttr = await clientRTM.getUserAttributes(user.uid.toString()); // Make sure UID is a string
        console.log(`User attributes for ${user.uid}:`, userAttr);

        // Safeguard: Fallback values if name/avatar are not set
        const userName = userAttr.name || `User ${user.uid}`;
        const userAvatar = userAttr.avatar || "path/to/default-avatar.png";

        // Replace placeholders in the participant template
        let playerHTML = config.participantPlayerContainer
          .replace(/{{uid}}/g, user.uid) // Replace UID
          .replace(/{{name}}/g, userName) // Replace name
          .replace(/{{avatar}}/g, userAvatar); // Replace avatar

        // Insert the player HTML into the video stage
        document
          .querySelector(config.callContainerSelector)
          .insertAdjacentHTML("beforeend", playerHTML);

        // Select the newly created player
        player = document.querySelector(`#video-wrapper-${user.uid}`);
      }

      // Find and hide the avatar, show the video player
      const videoPlayer = player.querySelector(`#stream-${user.uid}`);
      const avatarDiv = player.querySelector(`#avatar-${user.uid}`);

      if (videoPlayer && avatarDiv) {
        videoPlayer.style.display = "block"; // Show the video player
        avatarDiv.style.display = "none"; // Hide the avatar when video is on

        // Play the video track
        user.videoTrack.play(videoPlayer);
      }
    }

    // Handle audio subscription
    if (mediaType === "audio") {
      user.audioTrack.play(); // Play audio track
    }
  } catch (error) {
    console.error("Error during subscription:", error);
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
window['newMainApp'] = newMainApp;
