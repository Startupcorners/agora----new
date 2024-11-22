import { templateVideoParticipant } from "./templates.js"; // Import the template
import { eventCallbacks } from "./eventCallbacks.js";
import {
  setupEventListeners,
  setupRTMMessageListener,
  checkMicrophonePermissions,
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

export const newMainApp = function (initConfig) {
  console.log("newMainApp called with initConfig:", initConfig);

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
    // State management variables
    isRTMJoined: false,
    isRTCJoined: false,
    isOnStage: false,
    previousRoleInTheCall: null,
  };

  // Apply initial config
  config = { ...config, ...initConfig };
  if (!config.userTracks[config.uid]) {
    config.userTracks[config.uid] = {};
  }

  // Initialize tracks to null if they don't already exist
  config.userTracks[config.uid].videoTrack = null;
  config.userTracks[config.uid].audioTrack = null;

  if (!config.lastMutedStatuses[config.uid]) {
    config.lastMutedStatuses[config.uid] = "unknown"; // Default to "unknown" for first-time detection
  }

  // Initialize AgoraRTC client
  config.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  // Initialize the Virtual Background extension
  (async () => {
    try {
      console.log("Initializing Virtual Background Extension...");

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
  Object.assign(config, callbacks);

  // Function to ensure RTM is joined
  const ensureRTMJoined = async () => {
    console.log("ensureRTMJoined called");
    if (config.isRTMJoined) {
      console.log("Already joined RTM");
      return;
    }

    const tokens = await fetchTokens(config);
    if (!tokens) throw new Error("Failed to fetch RTM token");

    await joinRTM(tokens.rtmToken);
    config.isRTMJoined = true;
  };

  // Function to handle role changes
  const handleRoleChange = async (newRoleInTheCall) => {
    console.log(
      "handleRoleChange called with newRoleInTheCall:",
      newRoleInTheCall
    );

    const rolesRequiringRTC = [
      "host",
      "speaker",
      "meetingParticipant",
      "audienceOnStage",
      "audience",
    ];
    const rolesRequiringStage = [
      "host",
      "speaker",
      "meetingParticipant",
      "audienceOnStage",
    ];

    const prevRole = config.previousRoleInTheCall;
    config.previousRoleInTheCall = newRoleInTheCall;

    const prevRequiresRTC = rolesRequiringRTC.includes(prevRole);
    const newRequiresRTC = rolesRequiringRTC.includes(newRoleInTheCall);

    const prevRequiresStage = rolesRequiringStage.includes(prevRole);
    const newRequiresStage = rolesRequiringStage.includes(newRoleInTheCall);

    console.log("Previous role:", prevRole);
    console.log("New role:", newRoleInTheCall);
    console.log("prevRequiresRTC:", prevRequiresRTC);
    console.log("newRequiresRTC:", newRequiresRTC);
    console.log("prevRequiresStage:", prevRequiresStage);
    console.log("newRequiresStage:", newRequiresStage);

    // Handle RTC join/leave
    if (!prevRequiresRTC && newRequiresRTC && !config.isRTCJoined) {
      console.log("Joining RTC...");
      await joinRTC();
      config.isRTCJoined = true;
    } else if (prevRequiresRTC && !newRequiresRTC && config.isRTCJoined) {
      console.log("Leaving RTC...");
      await leaveRTC();
      config.isRTCJoined = false;
    }

    // Handle video stage join/leave
    if (!prevRequiresStage && newRequiresStage && !config.isOnStage) {
      console.log("Joining video stage...");
      await joinVideoStage();
      config.isOnStage = true;
    } else if (prevRequiresStage && !newRequiresStage && config.isOnStage) {
      console.log("Leaving video stage...");
      await leaveVideoStage();
      config.isOnStage = false;
    }
  };

  // Main join function
  const join = async () => {
    console.log("join function called");
    bubble_fn_role(config.user.roleInTheCall);

    try {
      // Ensure RTM is joined
      await ensureRTMJoined();

      // Handle role-based actions
      await handleRoleChange(config.user.roleInTheCall);

      // Additional host setup
      if (config.user.role === "host" && config.isOnStage) {
        console.log("User is host and on stage, performing additional setup");
        await addUserWrapper(config, config);
      }

      updateLayout();

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
      console.error("Error during join:", error);

      // Notify Bubble of error
      if (typeof bubble_fn_joining === "function") {
        bubble_fn_joining("Error");
      }
    }
  };

  // Function to join RTM
  const joinRTM = async (rtmToken, retryCount = 0) => {
    console.log(
      "joinRTM called with rtmToken:",
      rtmToken,
      "retryCount:",
      retryCount
    );

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

      // Join the RTM channel
      await config.channelRTM.join();
      console.log("Successfully joined RTM channel:", config.channelName);

      manageParticipants(config.uid, config.user, "join");

      // Notify Bubble of successful join
      if (typeof bubble_fn_joining === "function") {
        bubble_fn_joining("Joined");
        const stage = document.getElementById(`video-stage`);
        stage.classList.remove("hidden");
      }
    } catch (error) {
      if (error.code === 5 && retryCount < 3) {
        console.log("RTM join failed with code 5, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return joinRTM(rtmToken, retryCount + 1);
      } else {
        console.error("Failed to join RTM after multiple attempts:", error);
        throw error;
      }
    }
  };

  // Function to join RTC
  const joinRTC = async () => {
    console.log("joinRTC called");

    // Fetch RTC token
    const tokens = await fetchTokens(config);
    if (!tokens) throw new Error("Failed to fetch RTC token");

    await config.client.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      config.uid
    );
    console.log("Successfully joined RTC channel");

    setupEventListeners(config);
    await fetchAndSendDeviceList(config);
    await updateSelectedDevices(config);

    // Handle token renewal
    config.client.on("token-privilege-will-expire", handleRenewToken);
  };

  // Function to leave RTC
  const leaveRTC = async () => {
    console.log("leaveRTC called");
    await config.client.leave();
    config.isRTCJoined = false;
    console.log("Successfully left RTC channel");
  };

  // Function to join the video stage
  const joinVideoStage = async () => {
    console.log("joinVideoStage called");

    try {
      console.log("Creating and enabling audio track...");

      try {
        // Create and enable a new audio track
        config.userTracks[config.uid].audioTrack =
          await AgoraRTC.createMicrophoneAudioTrack();
        await config.userTracks[config.uid].audioTrack.setEnabled(true);

        console.log("Audio track created and enabled.");
        updateMicStatusElement(config.uid, false);

        // Publish the audio track
        console.log("Publishing audio track...");
        await config.client.publish([config.userTracks[config.uid].audioTrack]);
        console.log("Audio track published.");
      } catch (error) {
        // Handle specific microphone-related errors
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

      console.log("Joined the video stage with audio status updated.");
    } catch (error) {
      console.error("Error in joinVideoStage:", error);
    }
  };

  // Function to leave the video stage
  const leaveVideoStage = async () => {
    console.log("leaveVideoStage called");

    try {
      // Unpublish and close audio track
      if (config.userTracks[config.uid].audioTrack) {
        await config.client.unpublish([
          config.userTracks[config.uid].audioTrack,
        ]);
        config.userTracks[config.uid].audioTrack.close();
        config.userTracks[config.uid].audioTrack = null;
      }
      config.isOnStage = false;
      console.log("Left the video stage successfully");
    } catch (error) {
      console.error("Error in leaveVideoStage:", error);
    }
  };

  // Function to send an RTM message to the channel
  const sendRTMMessage = async (message) => {
    console.log("sendRTMMessage called with message:", message);

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

  // Function to handle external role changes
  const onRoleChange = async (newRoleInTheCall) => {
    console.log("onRoleChange called with newRoleInTheCall:", newRoleInTheCall);
    await handleRoleChange(newRoleInTheCall);
  };

  // Expose the onRoleChange function for external calls
  config.onRoleChange = onRoleChange;

  // Return the API
  return {
    config,
    join,
    joinToVideoStage: joinVideoStage,
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
    sendRTMMessage,
  };
};

window["newMainApp"] = newMainApp;
