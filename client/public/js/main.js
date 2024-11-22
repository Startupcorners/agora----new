import axios from "https://cdn.skypack.dev/axios";
import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import {
  setupEventListeners,
  setupRTMMessageListener, checkMicrophonePermissions,
} from "./setupEventListeners.js"; // Import RTM and RTC event listeners

import { handleRenewToken, manageParticipants } from "./rtcEventHandlers.js"; // Token renewal handler
import {
  fetchTokens,
  switchCam,
  switchMic,
  switchSpeaker,
  fetchAndSendDeviceList,
  updateSelectedDevices,
} from "./helperFunctions.js";

import { addUserWrapper } from "./wrappers.js";


import {
  startCloudRecording,
  stopCloudRecording,
  startAudioRecording,
  stopAudioRecording,
} from "./recordingHandlers.js";
import { toggleVirtualBackground } from "./virtualBackgroundHandlers.js";

import {
  toggleMic,
  toggleCamera,
  toggleScreenShare,
  changeUserRole,
  updateMicStatusElement,
} from "./uiHandlers.js"; // Import toggle functions from uiHandlers

const newMainApp = function (initConfig) {
  let config = {
    debugEnabled: true,
    callContainerSelector: "#video-stage",
    participantPlayerContainer: templateVideoParticipant,
    appId: "95e91980e5444a8e86b4e41c7f03b713",
    uid: null,
    user: {
      name: "guest",
      avatar:
        "https://ui-avatars.com/api/?background=random&color=fff&name=loading",
      role: "", // host, audience (for rtc and rtm)
      company: "",
      rtmUid: "",
      designation: "",
      profileLink: "",
      uidSharingScreen: "",
      bubbleid: "",
      isRaisingHand: "no",
      roleInTheCall: "", // host, speaker, audience (for ui)
    },
    serverUrl: "https://agora-new.vercel.app",
    token: null,
    channelName: null,
    processor: null,
    localAudioTrackMuted: false, // These are needed in config
    localVideoTrackMuted: true,
    cameraToggleInProgress: false,
    defaultMic: null,
    selectedMic: null,
    defaultCam: null,
    selectedCam: null,
    audioRecordingRTMClient: null,
    screenShareRTCClient: null,
    screenShareRTMClient: null,
    sharingScreenUid: null,
    generatedScreenShareId: null,
    isVirtualBackGroundEnabled: false,
    localAudioTrack: null, // Ensure local tracks are initialized as null initially
    localVideoTrack: null,
    currentVirtualBackground: null,
    extensionVirtualBackground: null,
    resourceId: null,
    recordId: null,
    audioResourceId: null,
    userTracks: {},
    lastMutedStatuses: {},
    lastMicPermissionState: null,
    audioRecordId: null,
    audioTimestamp: null,
    timestamp: null,
    sid: null,
    audioSid: null,
    audioResourceId: null,
    audioRecordId: null,
    audioTimestamp: null,
  };

  // Apply initial config
  if (!config.channelRTM) {
    config = { ...config, ...initConfig };
    if (!config.userTracks[config.uid]) {
      config.userTracks[config.uid] = {};
    }

    // Initialize tracks to null if they don't already exist
    config.userTracks[config.uid].videoTrack =
      config.userTracks[config.uid].videoTrack || null;
    config.userTracks[config.uid].audioTrack =
      config.userTracks[config.uid].audioTrack || null;

      if (!config.lastMutedStatuses[config.uid]) {
        config.lastMutedStatuses[config.uid] = "unknown"; // Default to "unknown" for first-time detection
      }

    // Initialize AgoraRTC client
    config.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    // Initialize the Virtual Background extension
    (async () => {
      try {
        console.log("Initializing Virtual Background Extension...");

        // Ensure 'extension' and 'config' are declared beforehand, or declare them if needed
        let extension = new VirtualBackgroundExtension();

        // Check for compatibility before proceeding
        console.log("Checking for compatibility...");
        if (!extension.checkCompatibility()) {
          console.error("Browser does not support Virtual Background.");
          return;
        }
        console.log("Browser is compatible with Virtual Background.");

        // Register the extension
        console.log("Registering Virtual Background extension...");
        AgoraRTC.registerExtensions([extension]);
        console.log("Virtual Background extension registered successfully.");

        // Attach the extension to the config
        console.log("Attaching extension and processor to config...");
        config.extensionVirtualBackground = extension;
        console.log("Extension and processor attached to config.");
      } catch (error) {
        console.error(
          "Failed to initialize the Virtual Background extension:",
          error
        );
      }
    })();

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
    // Continue with the rest of your code

    // Initialize AgoraRTC event listeners
    AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4); // 0 for debug, 4 for none
    AgoraRTC.onCameraChanged = (info) => config.onCameraChanged(info);
    AgoraRTC.onMicrophoneChanged = (info) => config.onMicrophoneChanged(info);
    AgoraRTC.onPlaybackDeviceChanged = (info) => config.onSpeakerChanged(info);

    // Initialize AgoraRTM (RTM client must be initialized before eventCallbacks)
    config.clientRTM = AgoraRTM.createInstance(config.appId, {
      enableLogUpload: false,
      logFilter: config.debugEnabled
        ? AgoraRTM.LOG_FILTER_INFO
        : AgoraRTM.LOG_FILTER_OFF,
    });

    // Initialize RTM Channel
    config.channelRTM = config.clientRTM.createChannel(config.channelName);
    setupRTMMessageListener(config.channelRTM, manageParticipants, config);
    checkMicrophonePermissions(config);

    // Initialize event callbacks with clientRTM passed
    const callbacks = eventCallbacks(config, config.clientRTM);
    config = { ...config, ...callbacks };
  }
  // Modified join function
  const join = async () => {
    bubble_fn_role(config.user.roleInTheCall);

    try {
      // Fetch RTC and RTM tokens
      const tokens = await fetchTokens(config);
      if (!tokens) throw new Error("Failed to fetch token");

      // Ensure the user has a role assigned
      if (!config.user.role) {
        throw new Error("User does not have a role assigned.");
      }

      // Check if already logged into RTM and skip re-login if true
      let isAlreadyLoggedIn = false;
      try {
        const attributes = await config.clientRTM.getUserAttributes(
          config.uid.toString()
        );
        console.log("Already logged in to RTM. Attributes:", attributes);
        isAlreadyLoggedIn = true;
      } catch {
        console.log("Not logged in to RTM, proceeding to join RTM.");
      }

      // Only join RTM if not already logged in
      if (!isAlreadyLoggedIn) {
        await joinRTM(tokens.rtmToken);
      }

      // Check if the user is in the waiting room
      if (config.user.roleInTheCall === "waiting") {
        console.log("User is in the waiting room; skipping RTC join.");
        await sendRTMMessage(`User ${config.user.name} is in the waiting room`);
        await sendRTMMessage("trigger_manage_participants");
        return; // Exit without joining RTC
      }

      // Join RTC
      console.log("config.uid before joining RTC", config.uid);
      await config.client.join(
        config.appId,
        config.channelName,
        tokens.rtcToken,
        config.uid
      );

      setupEventListeners(config);
      await fetchAndSendDeviceList(config);
      await updateSelectedDevices(config);

      // Additional host setup
      if (config.user.role === "host") {
        await joinToVideoStage(config);
      }

      // Track user join and handle token renewal
      manageParticipants(config.uid, config.user, "join");
      config.client.on("token-privilege-will-expire", handleRenewToken);

      // Notify Bubble of successful join
      if (
        [
          "host",
          "speaker",
          "meetingParticipant",
          "audienceOnStage",
          "master",
        ].includes(config.user.roleInTheCall)
      ) {
        const dataToSend = {
          eventId: config.channelName,
          name: config.user.name,
        };

        console.log("Preparing to send data to Bubble:", dataToSend);

        try {
          const bubbleResponse = await axios.post(
            "https://startupcorners.com/version-test/api/1.1/wf/activeParticipant",
            dataToSend
          );
          console.log("Data sent to Bubble successfully:", bubbleResponse.data);
        } catch (error) {
          console.error("Error sending data to Bubble:", error);
        }
      }

      if (typeof bubble_fn_joining === "function") {
        bubble_fn_joining("Joined");
        const stage = document.getElementById(`video-stage`);
        stage.classList.remove("hidden");

        // Check if the user's role is "host" (string comparison)
        if (config.user.role === "host") {
          await addUserWrapper(config, config);
        }

        updateLayout();
      }

     

      // Check for RTM members 2 or 3 and trigger the Bubble popup if not in waiting room
      if (config.user.roleInTheCall !== "waiting") {
        const channelMembers = await config.channelRTM.getMembers();
        console.log("Current RTM channel members:", channelMembers);

        if (channelMembers.includes("2")) {
          console.log("RTM member 2 detected. Video recording is active.");
          bubble_fn_isVideoRecording("yes"); // Indicate video recording is active
        }

        if (channelMembers.includes("3")) {
          console.log("RTM member 3 detected. Audio recording is active.");
          bubble_fn_isAudioRecording("yes"); // Indicate audio recording is active
        }

        if (channelMembers.includes("2") || channelMembers.includes("3")) {
          console.log("RTM members 2 or 3 detected. Event is being recorded.");
          bubble_fn_waitingForAcceptance(); // Trigger the Bubble function to display the popup
        }
      }
    } catch (error) {
      console.error("Error joining channel:", error);

      // Notify Bubble of error
      if (typeof bubble_fn_joining === "function") {
        bubble_fn_joining("Error");
      }
    }
  };

  // Function to send an RTM message to the channel
  const sendRTMMessage = async (message) => {
    try {
      if (config.channelRTM) {
        await config.channelRTM.sendMessage({ text: message });
        console.log("Message sent to RTM channel:", message);
      } else {
        console.warn("RTM channel is not initialized.");
      }
    } catch (error) {
      console.error("Failed to send RTM message:", error);
    }
  };

  // RTM Join function
  const joinRTM = async (rtmToken, retryCount = 0) => {
    try {
      const rtmUid = config.uid.toString();
      console.log("rtmuid value", rtmUid);

      // Login to RTM
      await config.clientRTM.login({ uid: rtmUid, token: rtmToken });

      // Set user attributes, including the role
      const attributes = {
        name: config.user.name || "Unknown",
        avatar: config.user.avatar || "default-avatar-url",
        company: config.user.company || "Unknown",
        designation: config.user.designation || "Unknown",
        role: config.user.role || "audience",
        rtmUid: rtmUid,
        bubbleid: config.user.bubbleid,
        isRaisingHand: config.user.isRaisingHand,
        sharingScreenUid: "0",
        roleInTheCall: config.user.roleInTheCall || "audience",
      };

      await config.clientRTM.setLocalUserAttributes(attributes); // Store attributes in RTM

      // Create the RTM channel and assign it to config.channelRTM if it doesn't exist
      if (!config.channelRTM) {
        config.channelRTM = config.clientRTM.createChannel(config.channelName);
        console.log("RTM channel created with name:", config.channelName);
      }

      // Join the RTM channel
      await config.channelRTM.join();
      console.log("Successfully joined RTM channel:", config.channelName);
    } catch (error) {
      if (error.code === 5 && retryCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return joinRTM(rtmToken, retryCount + 1);
      } else {
        console.error("Failed to join RTM after multiple attempts:", error);
        throw error;
      }
    }
  };
  // Join video stage function
const joinToVideoStage = async (config) => {
  try {
    // Ensure userTracks has an entry for the user
    let audioTrackCreated = false;

    // Try to create and enable an audio track
    if (!config.userTracks[config.uid].audioTrack) {
      console.log("Creating and enabling audio track...");
      try {
        config.userTracks[config.uid].audioTrack =
          await AgoraRTC.createMicrophoneAudioTrack();
        await config.userTracks[config.uid].audioTrack.setEnabled(true);
        audioTrackCreated = true;
        console.log("Audio track created and enabled.");
        console.log(config);
        updateMicStatusElement(config.uid, false);
      } catch (error) {
        if (error.name === "NotAllowedError") {
          console.warn(
            "Microphone access denied by the user or browser settings."
          );
        } else if (error.name === "NotFoundError") {
          console.warn("No microphone found on this device.");
        } else {
          console.warn("Unexpected error creating microphone track:", error);
        }

        // Trigger the Bubble function with "yes" to indicate muted status
        console.log(
          "Triggering Bubble function: system muted (no audio available)."
        );
        bubble_fn_systemmuted("yes");
        updateMicStatusElement(config.uid, true);
      }
    }

    // If an audio track was successfully created, publish it
    if (audioTrackCreated && config.userTracks[config.uid].audioTrack) {
      console.log("Publishing audio track...");
      await config.client.publish([config.userTracks[config.uid].audioTrack]);
      console.log("Audio track published.");
    }

    console.log("Joined the video stage with audio status updated.");
  } catch (error) {
    console.error("Error in joinToVideoStage:", error);
  }
};

  return {
    config,
    join,
    joinToVideoStage,
    toggleMic,
    toggleVirtualBackground,
    toggleCamera,
    switchCam,
    switchMic,
    switchSpeaker,
    changeUserRole,
    toggleScreenShare,
    fetchAndSendDeviceList,
    startCloudRecording,
    stopCloudRecording,
    startAudioRecording,
    stopAudioRecording,
  };
};

window["newMainApp"] = newMainApp;
