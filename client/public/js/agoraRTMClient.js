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

    if (data.event === "mic_off") {
      await toggleMic(true);
    } else if (data.event === "cam_off") {
      await toggleCamera(true);
    } else if (data.event === "remove_participant") {
      await leave();
    }
  });

  channelRTM.on("MemberJoined", async (memberId) => {
    log(`Member joined: ${memberId}`, config);
    handleOnUpdateParticipants(config)();
  });

  channelRTM.on("MemberLeft", (memberId) => {
    log(`Member left: ${memberId}`, config);
    handleOnUpdateParticipants(config)();
  });

  channelRTM.on("ChannelMessage", async (message, memberId, props) => {
    log("on:ChannelMessage ->", config);
    const messageObj = JSON.parse(message.text);
    log(messageObj, config);

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

        await config.client.leave();
        await leaveFromVideoStage(config.user);
        await join(); // Re-join the RTC
      }
      handleOnUpdateParticipants(config)();
      config.onRoleChanged(messageObj.targetUid, messageObj.role);
    } else {
      config.onMessageReceived(messageObj);
    }
  });

  return { clientRTM, channelRTM };
};
