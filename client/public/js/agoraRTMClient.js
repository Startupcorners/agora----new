import * as eventHandlers from "./eventHandlers.js";

export const setupAgoraRTMClient = (config) => {
  if (!config.appId) {
    throw new Error("Agora appId is missing or invalid.");
  }
  console.log("Agora appId:", config.appId); // Add this line to ensure appId is correct

  const clientRTM = AgoraRTM.createInstance(config.appId, {
    enableLogUpload: false,
    logFilter: config.debugEnabled
      ? AgoraRTM.LOG_FILTER_INFO
      : AgoraRTM.LOG_FILTER_OFF,
  });

  const channelRTM = clientRTM.createChannel(config.channelName);

  // Set up RTM event listeners
  clientRTM.on("MessageFromPeer", async (message, peerId) => {
    log("MessageFromPeer", config);
    const data = JSON.parse(message.text);
    log(data, config);

    try {
      if (data.event === "mic_off") {
        await config.toggleMic(true); // Use config-bound function
      } else if (data.event === "cam_off") {
        await config.toggleCamera(true); // Use config-bound function
      } else if (data.event === "remove_participant") {
        await config.leave(); // Use config-bound function
      }
    } catch (error) {
      console.error("Error handling peer message:", error);
    }
  });

  channelRTM.on("MemberJoined", async (memberId) => {
    log(`Member joined: ${memberId}`, config);
    try {
      await handleOnUpdateParticipants(config)(); // Ensure proper update of participants
    } catch (error) {
      console.error("Error updating participants on member join:", error);
    }
  });

  channelRTM.on("MemberLeft", async (memberId) => {
    log(`Member left: ${memberId}`, config);
    try {
      await handleOnUpdateParticipants(config)(); // Ensure proper update of participants
    } catch (error) {
      console.error("Error updating participants on member leave:", error);
    }
  });

  channelRTM.on("ChannelMessage", async (message, memberId, props) => {
    log("on:ChannelMessage ->", config);
    const messageObj = JSON.parse(message.text);
    log(messageObj, config);

    try {
      if (
        messageObj.type === "broadcast" &&
        messageObj.event === "change_user_role"
      ) {
        if (config.uid === messageObj.targetUid) {
          config.user.role = messageObj.role; // Update local role
          log("User role changed:", config);
          log(config.user.role, config);

          // Update user attributes after role change
          await clientRTM.addOrUpdateLocalUserAttributes({
            role: config.user.role,
          });
          log("Updated user attributes after role change", config);

          // Handle re-joining the RTC channel
          await config.client.leave();
          await config.leaveFromVideoStage(config.user); // Ensure config-bound function
          await config.join(); // Ensure config-bound function
        }

        await handleOnUpdateParticipants(config)();
        config.onRoleChanged(messageObj.targetUid, messageObj.role); // Handle role change event
      } else {
        config.onMessageReceived(messageObj); // Handle normal messages
      }
    } catch (error) {
      console.error("Error handling channel message:", error);
    }
  });

  return { clientRTM, channelRTM };
};
