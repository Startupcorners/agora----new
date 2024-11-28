import { getConfig, updateConfig } from "./config";
import { joinVideoStage} from "./joinleavestage";
import { fetchTokens} from "./helperFunctions.js";

export const join = async () => {
  let config = getConfig()

  console.warn("join function called");

  if (!config.userTracks[config.uid]) {
    config.userTracks[config.uid] = {};
  }

  // Initialize tracks to null if they don't already exist
  config.userTracks[config.uid].videoTrack = null;
  config.userTracks[config.uid].audioTrack = null;

  if (!config.lastMutedStatuses[config.uid]) {
    config.lastMutedStatuses[config.uid] = "unknown"; // Default to "unknown" for first-time detection
  }

  bubble_fn_role(config.user.roleInTheCall);

  try {
    const tokens = await fetchTokens(config);
    if (!tokens) throw new Error("Failed to fetch RTM token");
    // Ensure RTM is joined
    await joinRTM(config,tokens.rtmToken);
    console.warn("ran ensureRTMJoined");

    await joinRTC(config, tokens.rtcToken);
    console.warn("ran joinRTC");

    // Check for RTM members 2 or 3 and trigger the Bubble popup if not in waiting room
    if (
      config.user.roleInTheCall !== "waiting" &&
      config.user.roleInTheCall !== "audience"
    ) {joinVideoStage(config);
    }
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
    manageParticipants(config, config.uid, attributes, "join");
    bubble_fn_joining("Joined");
    updateConfig(config, "join")
  } catch (error) {
    console.error("Error during join:", error);

    // Notify Bubble of error
    if (typeof bubble_fn_joining === "function") {
      bubble_fn_joining("Error");
    }
  }
};


// Function to join RTM
const joinRTM = async (config, rtmToken, retryCount = 0) => {
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
    // Notify Bubble of successful join
    const stage = document.getElementById(`video-stage`);
    stage.classList.remove("hidden");
    // Get the list of RTM channel members
  } catch (error) {
    if (error.code === 5 && retryCount < 3) {
      console.log("RTM join failed with code 5, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return joinRTM(config, rtmToken, retryCount + 1);
    } else {
      console.error("Failed to join RTM after multiple attempts:", error);
      throw error;
    }
  }
};

// Function to join RTC
const joinRTC = async (config, rtcToken) => {
  console.warn("joinRTC called");

  try {
    // Join the RTC channel
    await config.client.join(
      config.appId,
      config.channelName,
      rtcToken,
      config.uid
    );
    console.log("Successfully joined RTC channel");
  } catch (error) {
    console.error("Error during joinRTC:", error);
  }
};
