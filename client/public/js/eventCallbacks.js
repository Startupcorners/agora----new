export const eventCallbacks = (config) => ({
  onParticipantJoined: async (user) => {
    console.log("onParticipantJoined", user);

    const rtmUid = user.uid.toString(); // Convert UID to string

    try {
      // Fetch user attributes (name, avatar) from RTM
      const userAttr = await config.clientRTM.getUserAttributes(rtmUid);

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
        const userAttr = await config.clientRTM.getUserAttributes(rtmUid);
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

    if (isMuted) {
      // Stop and release the microphone audio track when muted
      if (config.localAudioTrack) {
        config.localAudioTrack.stop();
        config.localAudioTrack.close();
        config.localAudioTrack = null; // Ensure the track is removed
      }
    } else {
      // Reinitialize the microphone track when unmuted
      if (!config.localAudioTrack) {
        config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }
    }

    // Update the UI for mic status (optional)
    const micStatusIcon = document.querySelector(`#mic-status-${config.uid}`);
    if (micStatusIcon) {
      micStatusIcon.style.display = isMuted ? "block" : "none";
    }

    // Call any external function if needed
    if (typeof bubble_fn_isMicOff === "function") {
      bubble_fn_isMicOff(isMuted);
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
        // Camera is off, stop and close the track to fully release the camera
        if (config.localVideoTrack) {
          config.localVideoTrack.stop();  // Stop the track (stop camera feed)
          config.localVideoTrack.close(); // Close the track (release hardware)
          await config.client.unpublish([config.localVideoTrack]); // Unpublish the track
          config.localVideoTrack = null;  // Set the track to null to fully release it
        }

        if (videoPlayer) videoPlayer.style.display = "none"; // Hide video
        if (avatarDiv) avatarDiv.style.display = "block";    // Show avatar
      } else {
        // Camera is on, start or resume the track
        if (!config.localVideoTrack) {
          config.localVideoTrack = await AgoraRTC.createCameraVideoTrack(); // Recreate the track
          await config.client.publish([config.localVideoTrack]); // Publish it
        }

        if (videoPlayer) videoPlayer.style.display = "block"; // Show video
        if (avatarDiv) avatarDiv.style.display = "none";    // Hide avatar
        config.localVideoTrack.play(videoPlayer); // Play video
      }
    }

    // Update Bubble function or any other necessary callbacks
    if (typeof bubble_fn_isCamOff === "function") {
      bubble_fn_isCamOff(isMuted);
    }
  } catch (error) {
    console.log(config.client)
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
