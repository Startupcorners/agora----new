export const eventCallbacks = (config, clientRTM) => ({
  onParticipantJoined: async (user) => {
    console.log("onParticipantJoined", user);

    const rtmUid = user.uid.toString(); // Convert UID to string for RTM operations

    try {
      // Fetch user attributes (name, avatar) from RTM immediately
      const userAttr = await clientRTM.getUserAttributes(rtmUid);

      const participants = [
        {
          uid: user.uid,
          name: userAttr.name || "Unknown",
          avatar: userAttr.avatar || "default-avatar-url",
        },
      ];

      // Update the participant list
      updateParticipantList(config, participants);
    } catch (error) {
      console.error(`Failed to fetch attributes for user ${rtmUid}`, error);
    }
  },

  onParticipantsChanged: async (participantIds) => {
    console.log("onParticipantsChanged", participantIds);

    const participants = [];

    // Loop through each participant and fetch their attributes
    for (const participant of participantIds) {
      const rtmUid = participant.id.toString();
      try {
        // Fetch user attributes (name, avatar) from RTM
        const userAttr = await clientRTM.getUserAttributes(rtmUid);

        participants.push({
          uid: participant.id,
          name: userAttr.name || "Unknown",
          avatar: userAttr.avatar || "default-avatar-url",
        });
      } catch (error) {
        console.error(`Failed to fetch attributes for user ${rtmUid}`, error);
        participants.push({
          uid: participant.id,
          name: "Unknown",
          avatar: "default-avatar-url",
        });
      }
    }

    // Update the participant list
    updateParticipantList(config, participants);
  },

  onParticipantLeft: (user) => {
    console.log("onParticipantLeft", user);

    const participants = Object.values(config.remoteTracks).map((track) => ({
      uid: track.uid,
      name: track.name || "Unknown",
      avatar: track.avatar || "default-avatar-url",
    }));

    // Update the participant list
    updateParticipantList(config, participants);

    // Handle participant left using Bubble function
    participants.forEach((track) => {
      if (typeof bubble_fn_left === "function") {
        bubble_fn_left(track.uid);
      }
    });
  },

  onVolumeIndicatorChanged: (volume) => {
    console.log("onVolumeIndicatorChanged", volume);
  },

  onMessageReceived: (messageObj) => {
    console.log("onMessageReceived", messageObj);
  },

  onMicMuted: (isMuted) => {
    console.log(
      `Microphone muted for UID ${config.uid}: ${
        isMuted ? "Mic Off" : "Mic On"
      }`
    );

    const micStatusIcon = document.querySelector(`#mic-status-${config.uid}`);
    if (micStatusIcon) {
      micStatusIcon.style.display = isMuted ? "block" : "none";
    }

    if (typeof bubble_fn_isMicOff === "function") {
      bubble_fn_isMicOff(isMuted);
    }
  },

  onCamMuted: (uid, isMuted) => {
    console.log(
      `Camera muted for UID ${uid}: ${isMuted ? "Camera Off" : "Camera On"}`
    );

    const videoWrapper = document.querySelector(`#video-wrapper-${uid}`);
    if (videoWrapper) {
      const videoPlayer = videoWrapper.querySelector(`#stream-${uid}`);
      const avatarDiv = videoWrapper.querySelector(`#avatar-${uid}`);

      videoPlayer.style.display = isMuted ? "none" : "block";
      avatarDiv.style.display = isMuted ? "block" : "none";
    }

    if (typeof bubble_fn_isCamOff === "function") {
      bubble_fn_isCamOff(isMuted);
    }
  },

  onScreenShareEnabled: (enabled) => {
    console.log(`Screen share status: ${enabled ? "Sharing" : "Not sharing"}`);

    if (typeof bubble_fn_isScreenOff === "function") {
      bubble_fn_isScreenOff(enabled);
    }
  },

  onUserLeave: () => {
    console.log("onUserLeave");
  },

  onCameraChanged: (info) => {
    console.log("Camera changed:", info.state, info.device);
  },

  onMicrophoneChanged: (info) => {
    console.log("Microphone changed:", info.state, info.device);
  },

  onSpeakerChanged: (info) => {
    console.log("Speaker changed:", info.state, info.device);
  },

  onRoleChanged: (uid, role) => {
    console.log(`Role changed for UID ${uid}: ${role}`);
  },

  onNeedJoinToVideoStage: (user) => {
    console.log(`onNeedJoinToVideoStage: ${user}`);
    return true;
  },

  onNeedMuteCameraAndMic: (user) => {
    console.log(`onNeedMuteCameraAndMic: ${user}`);
    return false;
  },

  onError: (error) => {
    console.error("Error occurred:", error);
  },
});

const updateParticipantList = (config, participants) => {
  const uids = participants.map((participant) => participant.uid);
  const names = participants.map(
    (participant) => participant.name || "Unknown"
  );
  const avatars = participants.map(
    (participant) => participant.avatar || "default-avatar-url"
  );
  const companies = participants.map(
    (participant) => participant.comp || "Unknown"
  );
  const designations = participants.map(
    (participant) => participant.desg || "Unknown"
  );

  console.log("Updating participant list", {
    uids,
    names,
    avatars,
    companies,
    designations,
  });

  if (typeof bubble_fn_participantList === "function") {
    console.log("Calling bubble_fn_participantList with participant data...");
    bubble_fn_participantList({
      outputlist1: uids,
      outputlist2: names,
      outputlist3: avatars,
      outputlist4: companies,
    });
  } else {
    console.warn("bubble_fn_participantList is not defined");
  }

  if (typeof bubble_fn_participantListOther === "function") {
    console.log("Calling bubble_fn_participantListOther with designations...");
    bubble_fn_participantListOther({
      outputlist1: designations,
    });
  } else {
    console.warn("bubble_fn_participantListOther is not defined");
  }
};
