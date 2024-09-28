import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import { setupEventListeners } from "./setupEventListeners.js"; // Import RTM and RTC event listeners
import { handleRenewToken } from "./rtcEventHandlers.js"; // Token renewal handler
import { fetchTokens } from "./helperFunctions.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { toggleMic, toggleCamera, toggleScreenShare } from "./uiHandlers.js"; // Import toggle functions from uiHandlers



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
      role: "", // host, speaker, audience, etc.
      company: "",
      designation: "",
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
  };

  // Apply initial config
  config = { ...config, ...initConfig };

  // Initialize AgoraRTC client
  config.client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

  // Ensure required config parameters are present
  if (
    !config.appId ||
    !config.callContainerSelector ||
    !config.serverUrl ||
    !config.channelName ||
    !config.uid
  ) {
    throw new Error("Required config parameters are missing.");
  }

  // Initialize AgoraRTC event listeners
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); // 0 for debug, 4 for none
  AgoraRTC.onCameraChanged = (info) => config.onCameraChanged(info);
  AgoraRTC.onMicrophoneChanged = (info) => config.onMicrophoneChanged(info);
  AgoraRTC.onPlaybackDeviceChanged = (info) => config.onSpeakerChanged(info);

  // Initialize AgoraRTM (RTM client must be initialized before eventCallbacks)
  config.clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled ? AgoraRTM.LOG_FILTER_INFO : AgoraRTM.LOG_FILTER_OFF,
  });

  // Initialize RTM Channel
  config.channelRTM = config.clientRTM.createChannel(config.channelName);

  // Initialize event callbacks with clientRTM passed
  const callbacks = eventCallbacks(config, config.clientRTM);
  config = { ...config, ...callbacks };

  // Join RTC and RTM
const join = async () => {
  try {
    const tokens = await fetchTokens(config); // Fetch RTC and RTM tokens
    if (!tokens) throw new Error("Failed to fetch token");

    if (config.user.role === "host") {
      await config.client.setClientRole("host");
    } else {
      await config.client.setClientRole("audience");
    }

    // Join RTM and RTC
    await joinRTM(tokens.rtmToken);

    console.log("config.uid before joining RTC", config.uid);
    await config.client.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      config.uid
    );

    console.log("config.uid before setting up listener", config.uid);
    setupEventListeners(config); // Setup RTC listeners

    // **Trigger handleUserJoined for the current user**
    console.log(
      "Triggering handleUserJoined for the current user:",
      config.uid
    );

    // If the user is a host, join the video stage
    if (config.user.role === "host") {
      await joinToVideoStage(config);
    }

    // Handle token renewal
    config.client.on("token-privilege-will-expire", handleRenewToken);

    // Notify success using bubble_fn_joining
    if (typeof bubble_fn_joining === "function") {
      bubble_fn_joining("Joined");
    }
  } catch (error) {
    console.error("Error before joining", error);

    // Notify error using bubble_fn_joining
    if (typeof bubble_fn_joining === "function") {
      bubble_fn_joining("Error");
    }
  }
};



  // RTM Join function
  const joinRTM = async (rtmToken, retryCount = 0) => {
    try {
      const rtmUid = config.uid.toString();
      console.log("rtmuid value", rtmUid)

      if (config.clientRTM._logined) {
        await config.clientRTM.logout();
      }

      await config.clientRTM.login({ uid: rtmUid, token: rtmToken });

      const attributes = {
        name: config.user.name || "Unknown",
        avatar: config.user.avatar || "default-avatar-url",
        comp: config.user.company || "",
        desg: config.user.designation || "",
      };
      await config.clientRTM.setLocalUserAttributes(attributes);
      await config.channelRTM.join();
    } catch (error) {
      if (error.code === 5 && retryCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return joinRTM(rtmToken, retryCount + 1);
      } else {
        throw new Error("Failed to join RTM after multiple attempts");
      }
    }
  };

  // Join video stage function
const joinToVideoStage = async (config) => {
  try {
    const { user, client } = config;

    // Create and publish the local audio track if it doesn't exist
    if (!config.localAudioTrack) {
      config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    }

    // Create and publish the local video track if it doesn't exist
    if (!config.localVideoTrack) {
      config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    }

    // Publish the local tracks
    await client.publish([config.localAudioTrack, config.localVideoTrack]);

    // Add the current user wrapper (for their own video/audio stream)
    await addUserWrapper({ uid: config.uid, ...config.user }, config);

    console.log("Joined the video stage for the current user");
  } catch (error) {
    console.error("Error in joinToVideoStage", error);
  }
};


  return {
    config,
    join,
    joinToVideoStage,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
  };
};

window["newMainApp"] = newMainApp;
