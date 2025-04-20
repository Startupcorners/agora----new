// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
  manageUserPromise,
} from "./publishUnpublishHub.js";
import { fetchTokens } from "./fetchTokens.js";
import { handleUserJoined, handleUserLeft } from "./joinLeaveRemoveUser.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { fetchAndSendDeviceList, manageParticipants } from "./talkToBubble.js";
import {
  switchCam,
  switchSpeaker,
  handleCameraDeactivation,
  handleMicDeactivation,
  handleSpeakerDeactivation,
} from "./handleDevices.js";
import { handleRaiseHandMessage } from "./uiHandlers.js";
import { leave } from "./joinLeaveLocalUser.js";
import { onRoleChange } from "./roleChange.js";
import {
  toggleCamera,
  toggleScreenShare,
  getSharingScreenUid,
} from "./video.js";
import { toggleMic } from "./audio.js";
import { sendRTMMessage } from "./helperFunctions.js";

// ---------------------------------------------------------------------------
// ⚠️  Inactivity‑tracking removed (requested) — only no‑host timer retained
// ---------------------------------------------------------------------------

let lastMutedStatuses = {}; // Tracks the mute status of users
let speakingIntervals = {}; // Tracks speaking intervals for users
let lastMicPermissionState = null; // Tracks the microphone permission state
let noHostTimer; // "No‑host" timer (retained)
const noHostTimeout = 300000; // 5 min in ms (retained)
let override = false; // Manual override for mute detection UI

// ---------------------------------------------------------------------------
//  Main RTC / RTM event‑listener setup
// ---------------------------------------------------------------------------
export const setupEventListeners = (config) => {
  console.log("listenerConfig", config);
  const client = config.client;

  // Handle media publish / unpublish
  client.on("user-published", async (user, mediaType) => {
    console.log(
      `user-published event received for user: ${user.uid}, mediaType: ${mediaType}`
    );
    await handleUserPublished(user, mediaType, config);
  });

  client.on("user-unpublished", async (user, mediaType) => {
    console.log("Heard user-unpublished:", user);
    await handleUserUnpublished(user, mediaType, config);
  });

  // Autoplay fallback (mobile / Safari, etc.)
  config.client.on("autoplay-fallback", () => {
    console.warn("Autoplay was blocked by the browser.");

    const autoplayButton = document.createElement("button");
    autoplayButton.textContent = "Start Media";
    autoplayButton.style.position = "absolute";
    autoplayButton.style.zIndex = "1000";
    autoplayButton.style.top = "50%";
    autoplayButton.style.left = "50%";
    autoplayButton.style.transform = "translate(-50%, -50%)";
    document.body.appendChild(autoplayButton);

    autoplayButton.addEventListener("click", () => {
      config.client.enableLocalAudio();
      config.client.enableLocalVideo();
      autoplayButton.remove();
    });
  });

  // ───────────────  User join / leave  ───────────────
  client.on("user-joined", async (user) => {
    console.log(`User joined: ${user.uid}`);
    const userUid = user.uid.toString();

    // Avoid duplicate processing via promise map
    let existingPromise = manageUserPromise(userUid, "get");
    if (existingPromise) {
      console.log(
        `A promise is already running for user: ${userUid}. Waiting...`
      );
      await existingPromise;
      console.log(`Existing promise for user ${userUid} completed.`);
      return;
    }

    // Create promise wrapper so we can track / dedupe
    const userJoinPromise = (async () => {
      let userAttr = {};

      if (config.clientRTM) {
        try {
          const fetchedAttributes = await config.clientRTM.getUserAttributes(
            userUid
          );
          console.log(
            `Fetched attributes for user ${userUid}:`,
            fetchedAttributes
          );

          userAttr = {
            name: fetchedAttributes.name || "Unknown",
            avatar: fetchedAttributes.avatar || "default-avatar-url",
            company: fetchedAttributes.company || "Unknown",
            designation: fetchedAttributes.designation || "Unknown",
            role: fetchedAttributes.role || "audience",
            rtmUid: fetchedAttributes.rtmUid || userUid,
            bubbleid: fetchedAttributes.bubbleid || "",
            speakerId: fetchedAttributes.speakerId,
            participantId: fetchedAttributes.participantId,
            isRaisingHand: fetchedAttributes.isRaisingHand || false,
            sharingScreenUid: fetchedAttributes.sharingScreenUid || "0",
            roleInTheCall: fetchedAttributes.roleInTheCall || "audience",
          };
        } catch (err) {
          console.error(`Failed to fetch attributes for user ${userUid}:`, err);
          userAttr = {
            name: "Unknown",
            avatar: "default-avatar-url",
            company: "Unknown",
            designation: "Unknown",
            role: "audience",
            rtmUid: userUid,
            bubbleid: "",
            isRaisingHand: false,
            sharingScreenUid: "0",
            roleInTheCall: "audience",
          };
        }
      }

      try {
        await handleUserJoined(user, userAttr, config);
        console.log(`User ${userUid} handled successfully.`);
      } catch (e) {
        console.error(`Error handling user ${userUid}:`, e);
      }
    })();

    manageUserPromise(userUid, "add", userJoinPromise);
    await userJoinPromise;
    manageUserPromise(userUid, "remove");
    console.log(`Promise for user ${userUid} completed and removed.`);
  });

  client.on("user-left", async (user) => {
    console.log("Heard user-left:", user);
    await handleUserLeft(user, config);
  });

  // ───────────────  Volume indicator (mute detection)  ───────────────
  client.enableAudioVolumeIndicator();

  client.on("volume-indicator", async (volumes) => {
    await handleVolumeIndicator(volumes, config);
  });

  // ───────────────  Connection state changes  ───────────────
  client.on("connection-state-change", async (curState, revState, reason) => {
    console.log(
      `Connection state changed from ${revState} to ${curState} due to ${reason}`
    );

    if (curState === "DISCONNECTED" && !config.leaveReason) {
      if (reason === "NETWORK_ERROR" || reason === "FAILURE") {
        console.warn("User has been disconnected due to network issues.");
        if (leave) await leave("connectionIssue", config);
      } else if (reason === "LEAVE_CHANNEL") {
        await leave("left", config);
      } else {
        if (leave) await leave("other", config);
      }
    }
  });

  // ───────────────  Device hot‑swap listeners  ───────────────
  AgoraRTC.on("microphone-changed", async (info) => {
    console.log("Microphone device change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";
    if (action === "activated") {
      await switchMic(info.device);
    } else {
      await handleMicDeactivation(info.device, config);
    }
  });

  AgoraRTC.on("playback-device-changed", async (info) => {
    console.log("Playback device (speaker) change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";
    if (action === "activated") {
      await switchSpeaker(info.device);
    } else {
      await handleSpeakerDeactivation(info.device, config);
    }
  });

  AgoraRTC.on("camera-changed", async (info) => {
    console.log("Camera device change detected:", info);
    await fetchAndSendDeviceList();

    const action = info.state === "ACTIVE" ? "activated" : "deactivated";
    if (action === "activated") {
      console.log("Camera activated:", info.device.label);
    } else {
      await handleCameraDeactivation(info.device, config);
    }
  });

  client.on("exception", (err) => {
    console.error("RTC Exception detected:", err);
    notifyErrorToChannel(err, config);
  });
};

// ---------------------------------------------------------------------------
//  RTM token lifecycle helpers (unchanged)
// ---------------------------------------------------------------------------
export function setupRTMTokenListeners(config) {
  const { client, clientRTM } = config;
  if (!client || !clientRTM) return;

  async function renewBoth() {
    try {
      const { rtcToken, rtmToken } = await fetchTokens(config);
      await Promise.allSettled([
        client.renewToken?.(rtcToken),
        clientRTM.renewToken?.(rtmToken),
      ]);
      console.info("✅ Renewed RTC + RTM tokens");
    } catch (err) {
      console.error("❌ Token renewal failed:", err);
    }
  }

  client.on("token-privilege-will-expire", renewBoth);
  clientRTM.on("TokenExpired", async () => {
    console.warn("RTM token expired – renewing and re‑logging in…");
    await renewBoth();
    try {
      const { rtmToken } = await fetchTokens(config);
      await clientRTM.login({ uid: config.uid.toString(), token: rtmToken });
      console.info("✅ Re‑logged into RTM after expiry");
    } catch (e) {
      console.error("❌ RTM re‑login failed:", e);
    }
  });
}

// ---------------------------------------------------------------------------
//  RTM message listener (unchanged)
// ---------------------------------------------------------------------------
export const setupRTMMessageListener = (config) => {
  const channelRTM = config.channelRTM;
  if (!channelRTM) {
    console.warn("RTM channel is not initialized.");
    return;
  }

  console.log("Current user's rtmUid:", config.user.rtmUid);

  channelRTM.on("ChannelMessage", async (message, memberId) => {
    if (memberId === config.user.rtmUid) return; // ignore self

    let parsed;
    try {
      parsed = JSON.parse(message.text);
    } catch {
      return;
    }

    const {
      type,
      userUid,
      newRole,
      newRoleInTheCall,
      userAttr,
      bubbleId,
      isRaisingHand,
    } = parsed;

    switch (type) {
      case "toggleHand":
      case "lowerHand":
        handleRaiseHandMessage(
          bubbleId,
          type === "toggleHand" ? isRaisingHand : false,
          config
        );
        break;

      case "roleChange":
        if (newRoleInTheCall === "audience") await removeUserWrapper(userUid);
        if (userUid.toString() === config.user.rtmUid)
          await onRoleChange(newRoleInTheCall, config);
        break;

      case "userRoleUpdated": {
        await manageParticipants(userUid, {}, "leave");
        await manageParticipants(userUid, userAttr, "join");
        const rolesRequiringWrapper = [
          "master",
          "host",
          "speaker",
          "meetingParticipant",
          "audienceOnStage",
        ];
        const sharingScreenUid = getSharingScreenUid();
        if (rolesRequiringWrapper.includes(newRoleInTheCall)) {
          await addUserWrapper(userUid, config, sharingScreenUid !== null);
        } else {
          await removeUserWrapper(userUid, sharingScreenUid !== null);
        }
        break;
      }

      case "stopCamera":
        if (userUid.toString() === config.user.rtmUid) toggleCamera(config);
        break;
      case "stopMic":
        if (userUid.toString() === config.user.rtmUid) toggleMic(config);
        break;
      case "stopScreenshare":
        if (userUid.toString() === config.user.rtmUid)
          toggleScreenShare(config);
        break;
      case "ERROR_NOTIFICATION":
      case "log":
        console.warn(`RTM log from ${parsed.user}: ${parsed.message}`);
        break;
      case "accessDenied":
        if (userUid.toString() === config.user.rtmUid)
          await leave("removed", config);
        break;
      default:
        console.warn("Unhandled RTM message type:", type);
    }
  });

  channelRTM.on("MemberJoined", (id) =>
    console.log(`RTM Member joined: ${id}`)
  );

  channelRTM.on("MemberLeft", (memberId) => {
    console.log(`RTM Member left: ${memberId}`);
    if (memberId === "3" && typeof bubble_fn_isAudioRecording === "function") {
      bubble_fn_isAudioRecording("no");
    }
  });
};

// ---------------------------------------------------------------------------
//  Microphone permission watcher (unchanged)
// ---------------------------------------------------------------------------
export async function checkMicrophonePermissions(config) {
  if (!navigator.permissions) {
    console.warn("Permission API is not supported in this browser.");
    return;
  }
  try {
    const micPermission = await navigator.permissions.query({
      name: "microphone",
    });

    if (micPermission.state !== lastMicPermissionState) {
      handleMicPermissionChange(micPermission.state, config);
      lastMicPermissionState = micPermission.state;
    }

    if ("onchange" in micPermission) {
      micPermission.onchange = () => {
        if (micPermission.state !== lastMicPermissionState) {
          handleMicPermissionChange(micPermission.state, config);
          lastMicPermissionState = micPermission.state;
        }
      };
    }

    console.log(`Initial microphone permission state: ${micPermission.state}`);
  } catch (e) {
    console.error("Error checking microphone permissions:", e);
  }
}

function handleMicPermissionChange(state, config) {
  if (!config || config.user.roleInTheCall === "waiting" || !config.client)
    return;
  const granted = state === "granted";

  if (typeof bubble_fn_micPermissionIsGranted === "function") {
    bubble_fn_micPermissionIsGranted(granted ? "yes" : "no");
  }

  if (!granted) {
    toggleMic(config);
    lastMutedStatuses[config.uid] = "unknown";
  } else {
    if (typeof bubble_fn_systemmuted === "function")
      bubble_fn_systemmuted("no");
    lastMutedStatuses[config.uid] = "no";
  }
}

// ---------------------------------------------------------------------------
//  Volume‑indicator (UI mute ring) —  **simplified** (inactivity code removed)
// ---------------------------------------------------------------------------
export const handleVolumeIndicator = (() => {
  return async (result, config) => {
    const currentUserUid = config.uid;

    for (const volume of result) {
      const userUID = volume.uid;
      if (userUID === 1) continue; // ignore screen‑share pseudo‑user

      const audioLevel = volume.level;
      let wrapper = document.querySelector(`#video-wrapper-${userUID}`);
      let waveElement = document.querySelector(`#wave-${userUID}`);

      const currentStatus = override ? "no" : audioLevel < 3 ? "yes" : "no";

      // ---------- visual feedback ----------
      if (wrapper)
        wrapper.style.borderColor = audioLevel > 50 ? "#1a73e8" : "transparent";

      if (waveElement) {
        const bars = waveElement.querySelectorAll(".bar");
        if (bars.length) {
          if (audioLevel > 50) {
            if (!speakingIntervals[userUID]) {
              speakingIntervals[userUID] = setInterval(() => {
                bars.forEach((bar) => {
                  const h = Math.floor(Math.random() * 10) + 3;
                  bar.style.height = `${h}px`;
                });
              }, 100);
            }
          } else if (speakingIntervals[userUID]) {
            clearInterval(speakingIntervals[userUID]);
            delete speakingIntervals[userUID];
            bars.forEach((bar) => (bar.style.height = "5px"));
          }
        }
      }

      // ---------- send mute‑status to Bubble ----------
      if (!lastMutedStatuses[userUID]) lastMutedStatuses[userUID] = "unknown";

      if (
        !override &&
        currentStatus !== lastMutedStatuses[userUID] &&
        userUID === currentUserUid
      ) {
        if (typeof bubble_fn_systemmuted === "function")
          bubble_fn_systemmuted(currentStatus);
        lastMutedStatuses[userUID] = currentStatus;
      }
    }
  };
})();

// ---------------------------------------------------------------------------
//  "No‑host" safeguard  (retained)
// ---------------------------------------------------------------------------
export const noHosts = (config) => {
  console.log("No hosts detected. Starting 5‑minute timer.");
  clearTimeout(noHostTimer);
  noHostTimer = setTimeout(() => {
    console.log("No host joined within 5 minutes — leaving session.");
    if (leave) leave("nohost", config);
  }, noHostTimeout);
};

export const hostJoined = () => {
  console.log("A host has joined. Clearing the no‑host timer.");
  clearTimeout(noHostTimer);
  if (typeof bubble_fn_hostJoined === "function") bubble_fn_hostJoined();
};

// ---------------------------------------------------------------------------
//  Error relay helper (unchanged)
// ---------------------------------------------------------------------------
const notifyErrorToChannel = async (error, config) => {
  const msg = {
    type: "ERROR_NOTIFICATION",
    message: error.message || "Unknown error",
    details: error.details || null,
    user: config.uid,
    timestamp: Date.now(),
  };
  try {
    await sendRTMMessage(JSON.stringify(msg), config);
  } catch (e) {
    console.error("Failed to send error notification via RTM:", e);
  }
};

// ---------------------------------------------------------------------------
//  Manual override toggle (unchanged)
// ---------------------------------------------------------------------------
export function toggleOverride(config) {
  override = !override;
  const uid = config.uid;
  if (override) {
    lastMutedStatuses[uid] = "no";
    if (typeof bubble_fn_systemmuted === "function")
      bubble_fn_systemmuted("no");
  }
  console.log(`Override is now ${override ? "ENABLED" : "DISABLED"}`);
}

// ---------------------------------------------------------------------------
//  Simple responsive‑layout helper (unchanged)
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => editClasses());

export const editClasses = async () => {
  const videoStage = document.getElementById("video-stage");
  const mainContainer = document.getElementById("main-container");
  const sharingScreenUid = getSharingScreenUid();

  if (!videoStage || !mainContainer) return;

  if (sharingScreenUid === null) {
    videoStage.classList.remove(
      "video-stage-screenshare",
      "video-stage-screenshare-below"
    );
    videoStage.classList.add("video-stage");
    mainContainer.classList.remove("main-container-below");
    mainContainer.classList.add("main-container-left");
    return;
  }

  const layout =
    mainContainer.getBoundingClientRect().width < 600 ? "below" : "left";
  await new Promise((res) => setTimeout(res, 100));

  if (layout === "below") {
    videoStage.classList.remove("video-stage", "video-stage-screenshare");
    videoStage.classList.add("video-stage-screenshare-below");
    mainContainer.classList.remove("main-container-left");
    mainContainer.classList.add("main-container-below");
  } else {
    videoStage.classList.remove("video-stage", "video-stage-screenshare-below");
    videoStage.classList.add("video-stage-screenshare");
    mainContainer.classList.remove("main-container-below");
    mainContainer.classList.add("main-container-left");
  }
};
