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

import { addUserWrapper, removeUserWrapper } from "./wrappers.js";

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
  stopUserScreenshare,
  stopUserMic,
  stopUserCamera,
  updatePublishingList,
  leave,
  denyAccess,
  raiseHand,
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
    listenersSetUp: false,
    resourceId: null,
    recordId: null,
    audioResourceId: null,
    usersRaisingHand: [],
    userTracks: {},
    lastMutedStatuses: {},
    lastMicPermissionState: null,
    audioRecordId: null,
    audioTimestamp: null,
    participantList: [],
    timestamp: null,
    sid: null,
    leaveReason: null,
    audioSid: null,
    usersPublishingVideo: [],
    usersPublishingAudio: [],
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
  setupEventListeners(config);
  checkMicrophonePermissions(config);

  // Initialize event callbacks with clientRTM passed
  const callbacks = eventCallbacks(config, config.clientRTM);
  Object.assign(config, callbacks);

  // Function to ensure RTM is joined
  const ensureRTMJoined = async () => {
    console.warn("ensureRTMJoined called");
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
    console.warn(
      "handleRoleChange called with newRoleInTheCall:",
      newRoleInTheCall
    );

    const rolesRequiringRTC = [
      "master",
      "host",
      "speaker",
      "meetingParticipant",
      "audienceOnStage",
      "audience",
      "waiting",
    ];
    const rolesRequiringStage = [
      "master",
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

      // Subscribe to audio tracks for existing users if transitioning from waiting
      if (prevRole === "waiting") {
        console.log("Subscribing to audio tracks for existing users...");
        for (const userUid in config.userTracks) {
          const user = config.userTracks[userUid];
          if (user && user.audioTrack && !user.audioTrack.isPlaying) {
            try {
              await config.client.subscribe(user, "audio");
              user.audioTrack.play();

              // Update mic status dynamically
              const micStatusElement = document.getElementById(
                `mic-status-${userUid}`
              );
              if (micStatusElement) {
                micStatusElement.classList.add("hidden"); // Show unmuted icon
                console.log(`Updated mic status for user ${userUid}`);
              }

              // Update publishing list
              updatePublishingList(userUid.toString(), "audio", "add", config);
            } catch (error) {
              console.error(
                `Error subscribing to audio for user ${userUid}:`,
                error
              );
            }
          }
        }
      }
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
    console.warn("join function called");
    bubble_fn_role(config.user.roleInTheCall);

    try {
      // Ensure RTM is joined
      await ensureRTMJoined();
      console.warn("ran ensureRTMJoined");

      // Handle role-based actions
      await handleRoleChange(config.user.roleInTheCall);
      console.warn("ran handleRoleChange");

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
      bubble_fn_joining("Joined");
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

      // Update participantList and call manageParticipants for the current user
      manageParticipants(config, config.uid, attributes, "join");

      // Notify Bubble of successful join
      const stage = document.getElementById(`video-stage`);
      stage.classList.remove("hidden");
      // Get the list of RTM channel members
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
  console.warn("joinRTC called");

  try {
    // Fetch RTC token
    const tokens = await fetchTokens(config);
    if (!tokens) throw new Error("Failed to fetch RTC token");

    // Join the RTC channel
    await config.client.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      config.uid
    );
    console.log("Successfully joined RTC channel");
  } catch (error) {
    console.error("Error during joinRTC:", error);
  }
};

  // Function to join the video stage
  const joinVideoStage = async () => {
    console.warn("joinVideoStage called");

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
        updatePublishingList(config.uid.toString(), "audio", "add", config);
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

      console.log("User is host, performing additional setup");
      await addUserWrapper(config.uid, config);

      updateLayout();

      console.log("Joined the video stage with audio status updated.");
    } catch (error) {
      console.error("Error in joinVideoStage:", error);
    }
  };

  // Function to leave the video stage
const leaveVideoStage = async () => {
  console.warn("leaveVideoStage called");

  try {
    // Unpublish and close audio track
    if (config.userTracks[config.uid]?.audioTrack) {
      console.log("Unpublishing audio track...");
      await config.client.unpublish([config.userTracks[config.uid].audioTrack]);
      config.userTracks[config.uid].audioTrack.close();
      config.userTracks[config.uid].audioTrack = null;
      console.log("Audio track unpublished and closed");
    }

    // Unpublish and close video track
    if (config.userTracks[config.uid]?.videoTrack) {
      console.log("Unpublishing video track...");
      await config.client.unpublish([config.userTracks[config.uid].videoTrack]);
      config.userTracks[config.uid].videoTrack.close();
      config.userTracks[config.uid].videoTrack = null;
      console.log("Video track unpublished and closed");
    }

    // Update stage status
    config.isOnStage = false;
    console.log("Left the video stage successfully");
  } catch (error) {
    console.error("Error in leaveVideoStage:", error);
  }
};

  // Function to send an RTM message to the channel
  const sendRTMMessage = async (message) => {
    console.warn("sendRTMMessage called with message:", message);

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

  const handleRaisingHand = async (userUid) => {
    // Check if the user is already in the list
    if (config.usersRaisingHand.includes(userUid)) {
      // Remove the user if they are already in the list
      config.usersRaisingHand = config.usersRaisingHand.filter(
        (uid) => uid !== userUid
      );
      console.log(`User ${userUid} removed from raising hand list.`);
    } else {
      // Add the user if they are not in the list
      config.usersRaisingHand.push(userUid);
      console.log(`User ${userUid} added to raising hand list.`);
    }

    console.log("config.usersRaisingHand", config.usersRaisingHand);

    // Update Bubble with the new list of users raising their hand
    bubble_fn_usersRaisingHand(config.usersRaisingHand);
  };



  // Function to handle external role changes
  const onRoleChange = async (newRoleInTheCall) => {
    console.warn(
      "onRoleChange called with newRoleInTheCall:",
      newRoleInTheCall
    );

    // Retrieve the previous role for cleanup
    const previousRoleInTheCall = config.user.roleInTheCall;

    // Update the user's role in config
    config.user.roleInTheCall = newRoleInTheCall;
    console.warn("bubble_fn_role:", config.user.roleInTheCall);
    bubble_fn_role(config.user.roleInTheCall);

    // Update the user's attributes in RTM
    const attributes = {
      name: config.user.name || "Unknown",
      avatar: config.user.avatar || "default-avatar-url",
      company: config.user.company || "Unknown",
      designation: config.user.designation || "Unknown",
      role: config.user.role || "audience",
      rtmUid: config.uid.toString(),
      bubbleid: config.user.bubbleid,
      isRaisingHand: config.user.isRaisingHand,
      sharingScreenUid: "0",
      roleInTheCall: newRoleInTheCall || "audience",
    };

    // Update local user attributes in RTM
    if (
      config.clientRTM &&
      typeof config.clientRTM.setLocalUserAttributes === "function"
    ) {
      await config.clientRTM.setLocalUserAttributes(attributes);
      console.log("Local RTM user attributes updated:", attributes);
    } else {
      console.warn(
        "RTM client or setLocalUserAttributes method is not available."
      );
    }

    // Handle role change (e.g., join/leave RTC, update UI)
    await handleRoleChange(newRoleInTheCall);

    // Call manageParticipants to remove the user from the previous role
    if (previousRoleInTheCall && previousRoleInTheCall !== newRoleInTheCall) {
      console.log(
        `Calling manageParticipants to remove user ${config.uid} from previous role: ${previousRoleInTheCall}`
      );
      await manageParticipants(config, config.uid, {}, "leave");
    }

    // Update participant list for the new role
    console.log(
      `Calling manageParticipants for user ${config.uid} with new role: ${newRoleInTheCall}`
    );
    await manageParticipants(config, config.uid, attributes, "join");

    // Send a message to inform other users about the role change
    const roleUpdateMessage = {
      type: "userRoleUpdated",
      userUid: config.uid.toString(),
      newRole: config.user.role,
      newRoleInTheCall: newRoleInTheCall,
      userAttr: attributes, // Include the user attributes
    };

    if (config.channelRTM) {
      try {
        await config.channelRTM.sendMessage({
          text: JSON.stringify(roleUpdateMessage),
        });
        console.log("Sent userRoleUpdated message to RTM channel.");
      } catch (error) {
        console.error("Failed to send userRoleUpdated message:", error);
      }
    } else {
      console.warn(
        "RTM channel is not initialized. Cannot send role update message."
      );
    }
  };

  // Expose the onRoleChange function for external calls
  config.onRoleChange = onRoleChange;
  config.handleRaisingHand = handleRaisingHand;

  // Return the API
  return {
    config,
    join,
    toggleMic,
    leave,
    toggleVirtualBackground,
    toggleCamera,
    denyAccess,
    switchCam,
    switchMic,
    switchSpeaker,
    changeUserRole,
    toggleScreenShare,
    fetchAndSendDeviceList,
    startCloudRecording,
    stopCloudRecording,
    startAudioRecording,
    raiseHand,
    stopAudioRecording,
    sendRTMMessage,
    stopUserCamera, // Add stop camera function
    stopUserMic, // Add stop mic function
    stopUserScreenshare,
  };
};

window["newMainApp"] = newMainApp;
