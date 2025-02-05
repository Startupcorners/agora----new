import { fetchTokens } from "./fetchTokens.js";
import { joinVideoStage } from "./joinleavestage.js";
import { manageParticipants } from "./talkToBubble.js";
import { stopCamera, stopScreenShare } from "./video.js";
import { endMic } from "./audio.js";

export const join = async (config) => {
  console.warn("join function called");

  bubble_fn_role(config.user.roleInTheCall);

  try {
    const tokens = await fetchTokens(config);
    if (!tokens) throw new Error("Failed to fetch RTM token");

    // Ensure RTM is joined
    await joinRTM(config, tokens.rtmToken);
    console.warn("ran ensureRTMJoined");

    await joinRTC(config, tokens.rtcToken);
    console.warn("ran joinRTC");

    // Check for RTM members 2 or 3 and trigger the Bubble popup if not in waiting room
    if (
      config.user.roleInTheCall !== "waiting" &&
      config.user.roleInTheCall !== "audience" &&
      config.uid != 2
    ) {
      joinVideoStage(config);
    }

    const channelMembers = await config.channelRTM.getMembers();
    console.log("Current RTM channel members:", channelMembers);

    if (channelMembers.includes("2")) {
      console.log("RTM member 2 detected. Video recording is active.");
      bubble_fn_isVideoRecording("yes"); // Indicate video recording is active
      console.log("Checking who created the event");

      try {
        const resourceId = config.resourceId || ""; // Ensure resourceId is set
        if (!resourceId) throw new Error("Missing resourceId for API call.");

        const logResponse = await axios.post(
          "https://startupcorners.com/api/1.1/wf/recording_information",
          {
            resourceId: resourceId,
          }
        );

        console.log("Response from /recording_information:", logResponse.data);

        if (logResponse.data === "yes") {
          console.log(
            `Log entry for resourceId ${resourceId} already exists, skipping stop recording.`
          );
          return; // Skip further processing
        }
      } catch (apiError) {
        console.error("Error fetching recording information:", apiError);
      }
    }

    if (channelMembers.includes("3")) {
      console.log("RTM member 3 detected. Audio recording is active.");
      bubble_fn_isAudioRecording("yes"); // Indicate audio recording is active
    }

    if (channelMembers.includes("2") || channelMembers.includes("3")) {
      console.log("RTM members 2 or 3 detected. Event is being recorded.");
      bubble_fn_waitingForAcceptance(); // Trigger the Bubble function to display the popup
    }

    // Ensure both audio and video tracks are set from Agora's local tracks
    const attributes = {
      name: config.user.name, // Pull name from config.user
      avatar: config.user.avatar, // Pull avatar from config.user
      company: config.user.company || "", // Default to empty string if not set in config.user
      designation: config.user.designation || "", // Default to empty string if not set in config.user
      role: config.user.role || "audience", // Default to "audience" if not set in config.user
      rtmUid: config.uid.toString(), // Use config.uid for RTM UID
      speakerId: config.user.speakerId,
      participantId: config.user.participantId,
      bubbleid: config.user.bubbleid || "", // Default to empty if not set in config.user
      isRaisingHand: config.user.isRaisingHand || false, // Default to false if not set in config.user
      sharingScreenUid: config.sharingScreenUid || "0", // Default to "0" if no screen sharing user ID
      roleInTheCall: config.user.roleInTheCall || "audience", // Default to "audience" if not set in config.user
    };

    manageParticipants(config.uid, attributes, "join");
    bubble_fn_joining("Joined");

    // Notify Bubble when participant enters the session
    try {
      const bubbleResponse = await axios.post(
        "https://startupcorners.com/api/1.1/wf/participantEnterLeave",
        {
          participantId: config.user.participantId,
          action: "enter",
        }
      );
      console.log("Participant enter/leave API response:", bubbleResponse.data);
    } catch (apiError) {
      console.error("Error notifying participantEnterLeave API:", apiError);
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
      speakerId: config.user.speakerId || "None",
      participantId: config.user.participantId,
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

let triggeredReason = null;

// Add the general leave function
export const leave = async (reason, config) => {
  // Check if leave function has already been triggered
  if (triggeredReason) {
    console.warn(
      `Leave function already triggered with reason: ${triggeredReason}. Ignoring subsequent call.`
    );
    return; // Exit if already triggered
  }

  console.warn("leave function called with reason:", reason);
  triggeredReason = reason; // Set the triggered reason to prevent re-entry

  // Define the valid reasons
  const validReasons = [
    "left",
    "removed",
    "deniedAccess",
    "connectionIssue",
    "inactive",
  ];
  const finalReason = validReasons.includes(reason) ? reason : "other"; // Ensure reason is valid

  await stopScreenShare(config);
  await stopCamera(config);
  await endMic(config);

  try {
    const bubbleResponse = await axios.post(
      "https://startupcorners.com/api/1.1/wf/participantEnterLeave",
      {
        participantId: config.user.participantId,
        action: "leave",
      }
    );
    console.log("Participant enter/leave API response:", bubbleResponse.data);
  } catch (apiError) {
    console.error("Error notifying participantEnterLeave API:", apiError);
  }

  try {
    // Leave RTC
    await leaveRTC(config);
    console.log("Left RTC channel successfully");

    // Leave RTM if joined
    // await leaveRTM(config);
    // console.log("Left RTM channel successfully");

    // Call the Bubble function with the final reason
    if (typeof bubble_fn_leave === "function") {
      bubble_fn_leave(finalReason);
    } else {
      console.warn("bubble_fn_leave is not defined or not a function");
    }
  } catch (error) {
    console.error("Error during leave:", error);
  }
};


// Function to leave RTC
export const leaveRTC = async (config) => {
  console.warn("leaveRTC called");
  await config.client.leave();
  config.isRTCJoined = false;
  console.log("Successfully left RTC channel");
};

// Add the leaveRTM function
export const leaveRTM = async (config) => {
  console.warn("leaveRTM called");


  try {
    if (config.channelRTM) {
      await config.channelRTM.leave();
      console.log("Left the RTM channel successfully");
      config.channelRTM = null;
    }
    if (config.clientRTM) {
      await config.clientRTM.logout();
      console.log("Logged out from RTM client successfully");
      config.clientRTM = null;
    }
    config.isRTMJoined = false;
  } catch (error) {
    console.error("Error in leaveRTM:", error);
  }
};
