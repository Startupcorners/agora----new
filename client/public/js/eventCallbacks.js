export const eventCallbacks = (config, clientRTM) => ({
  onParticipantJoined: async (user) => {
    console.log("onParticipantJoined", user);

    const rtmUid = user.uid.toString(); // Convert UID to string

    try {
      // Fetch user attributes (name, avatar) from RTM using clientRTM
      const userAttr = await clientRTM.getUserAttributes(rtmUid);

      const participants = [
        {
          uid: user.uid,
          name: userAttr.name || "Unknown",
          avatar: userAttr.avatar || "default-avatar-url",
        },
      ];

      updateParticipantList(config, participants);
    } catch (error) {
      console.error(`Failed to fetch attributes for user ${rtmUid}`, error);
    }
  },

  onParticipantsChanged: async (participantIds) => {
    console.log("onParticipantsChanged", participantIds);

    const participants = [];

    for (const participant of participantIds) {
      const rtmUid = participant.id.toString(); // Convert UID to string
      try {
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

    updateParticipantList(config, participants);
  },

  onParticipantLeft: (user) => {
    console.log("onParticipantLeft", user);

    const participants = Object.values(config.remoteTracks).map((track) => ({
      uid: track.uid,
      name: track.name || "Unknown",
      avatar: track.avatar || "default-avatar-url",
    }));

    updateParticipantList(config, participants);

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

  onMicMuted: async (isMuted) => {
    console.log(
      `Microphone muted for UID ${config.uid}: ${
        isMuted ? "Mic Off" : "Mic On"
      }`
    );

    try {
      if (isMuted) {
        // Unpublish and stop the audio track
        if (config.localAudioTrack) {
          await config.client.unpublish([config.localAudioTrack]);
          config.localAudioTrack.stop();
          config.localAudioTrack.close();
          config.localAudioTrack = null;

          if (config.client) {
            console.log("Destroying Agora client to release resources.");
            config.client.leave();
            config.client = null;
          }
        }
      } else {
        if (!config.localAudioTrack) {
          config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          await config.client.publish([config.localAudioTrack]);
        }
      }

      const micStatusIcon = document.querySelector(`#mic-status-${config.uid}`);
      if (micStatusIcon) {
        micStatusIcon.style.display = isMuted ? "block" : "none";
      }

      if (typeof bubble_fn_isMicOff === "function") {
        bubble_fn_isMicOff(isMuted);
      }
    } catch (error) {
      console.error("Error in onMicMuted:", error);
      if (config.onError) {
        config.onError(error);
      }
    }
  },

  onCamMuted: async (uid, isMuted) => {
    try {
      console.log(
        `Camera muted for UID ${uid}: ${isMuted ? "Camera Off" : "Camera On"}`
      );

      const videoWrapper = document.querySelector(`#video-wrapper-${uid}`);
      if (videoWrapper) {
        const videoPlayer = videoWrapper.querySelector(`#stream-${uid}`);
        const avatarDiv = videoWrapper.querySelector(`#avatar-${uid}`);

        if (isMuted) {
          if (config.localVideoTrack) {
            config.localVideoTrack.stop();
            config.localVideoTrack.close();
            await config.client.unpublish([config.localVideoTrack]);
            config.localVideoTrack = null;
          }

          if (videoPlayer) videoPlayer.style.display = "none";
          if (avatarDiv) avatarDiv.style.display = "block";
        } else {
          if (!config.localVideoTrack) {
            config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
            await config.client.publish([config.localVideoTrack]);
          }

          if (videoPlayer) {
            videoPlayer.style.display = "block";
            config.localVideoTrack.play(videoPlayer);
          }
          if (avatarDiv) avatarDiv.style.display = "none";
        }
      } else {
        console.error("Video wrapper element not found.");
      }

      if (typeof bubble_fn_isCamOff === "function") {
        bubble_fn_isCamOff(isMuted);
      }
    } catch (error) {
      console.error("Error in onCamMuted:", error);
      if (config.onError) {
        config.onError(error);
      }
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

  console.log("Updating participant list", { uids, names, avatars });

  if (typeof bubble_fn_participantList === "function") {
    bubble_fn_participantList({
      outputlist1: uids,
      outputlist2: names,
      outputlist3: avatars,
    });
  }

  if (typeof bubble_fn_participantListOther === "function") {
    const companies = participants.map(
      (participant) => participant.comp || "Unknown"
    );
    const designations = participants.map(
      (participant) => participant.desg || "Unknown"
    );

    bubble_fn_participantListOther({
      outputlist1: designations,
    });
  }
};
