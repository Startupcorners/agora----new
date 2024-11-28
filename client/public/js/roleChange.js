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

  // Subscribe to audio tracks for existing users if transitioning from waiting
  if (prevRole === "waiting" && newRoleInTheCall !== "waiting") {
    console.log("Subscribing to audio tracks for existing users...");
    console.log("Current config.userTracks:", config.userTracks);

    // Iterate over all userTracks
    for (const userUid in config.userTracks) {
      const user = config.userTracks[userUid];

      if (user && user.audioTrack) {
        console.log(`Found audio track for user ${userUid}:`, user.audioTrack);

        if (!user.audioTrack.isPlaying) {
          try {
            console.log(
              `Attempting to subscribe to audio track for user ${userUid}...`
            );
            await config.client.subscribe(user, "audio");
            user.audioTrack.play();

            console.log(
              `Successfully subscribed and playing audio for user ${userUid}.`
            );

            // Update mic status dynamically
            const micStatusElement = document.getElementById(
              `mic-status-${userUid}`
            );
            if (micStatusElement) {
              micStatusElement.classList.add("hidden"); // Show unmuted icon
              console.log(`Updated mic status for user ${userUid}`);
            } else {
              console.warn(`Mic status element not found for user ${userUid}`);
            }

            // Update publishing list
            updatePublishingList(userUid.toString(), "audio", "add", config);
          } catch (error) {
            console.error(
              `Error subscribing to audio for user ${userUid}:`,
              error
            );
          }
        } else {
          console.log(
            `User ${userUid}'s audio track is already playing. Skipping subscription.`
          );
        }
      } else {
        console.log(
          `User ${userUid} does not have a valid audio track. Skipping.`
        );
      }
    }
  }

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



export const onRoleChange = async (newRoleInTheCall) => {
  console.warn("onRoleChange called with newRoleInTheCall:", newRoleInTheCall);

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