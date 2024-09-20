export function initAgoraApp(
  channelName,
  uid,
  role,
  name,
  avatar,
  options = {}
) {
  // Function to update the size of video wrappers dynamically
  function updateVideoWrapperSize() {
    const videoStage = document.getElementById("video-stage");
    const videoWrappers = videoStage.querySelectorAll('[id^="video-wrapper-"]');
    const count = videoWrappers.length;
    const screenWidth = window.innerWidth;
    const maxWrapperWidth = 800; // Maximum width of each video wrapper

    videoWrappers.forEach((wrapper) => {
      wrapper.style.boxSizing = "border-box"; // Prevent overflow due to padding or borders

      if (screenWidth < 768) {
        wrapper.style.flex = "1 1 100%";
        wrapper.style.maxWidth = "100%";
        wrapper.style.minHeight = "50vh";
      } else {
        if (count === 1) {
          wrapper.style.flex = "1 1 100%";
          wrapper.style.maxWidth = "100%";
          wrapper.style.minHeight = "80vh";
        } else if (count === 2) {
          wrapper.style.flex = "1 1 45%";
          wrapper.style.maxWidth = "50%";
          wrapper.style.minHeight = "45vh";
        } else if (count === 3) {
          wrapper.style.flex = "1 1 30%";
          wrapper.style.maxWidth = "33.333%";
          wrapper.style.minHeight = "35vh";
        } else {
          wrapper.style.flex = "1 1 auto";
          wrapper.style.maxWidth = `${maxWrapperWidth}px`;
          wrapper.style.minHeight = "30vh";
        }
      }
    });
  }

  window.updateVideoWrapperSize = updateVideoWrapperSize;

  // Add a resize event listener to update video wrapper sizes dynamically
  window.addEventListener("resize", updateVideoWrapperSize);

  // Optionally, call the function once during initialization to set the initial layout
  document.addEventListener("DOMContentLoaded", () => {
    updateVideoWrapperSize();
  });

  const {
    onParticipantsChanged = (participants) => {
      console.log("Participants changed:", participants);
      const idList = participants.map((participant) => participant.id);
      updateVideoWrapperSize();

      // Send the list of participant UIDs to Bubble
      bubble_fn_participantList(idList);
    },
    onParticipantLeft = (user) => {
      console.log(`Participant left: ${user.id}`);

      // Find and remove the participant's video wrapper from the DOM
      const videoWrapper = document.querySelector(`#video-wrapper-${user.id}`);
      if (videoWrapper) {
        videoWrapper.remove();
      }

      // Update Bubble with the remaining participants' UIDs
      const remainingParticipants = Array.from(
        document.querySelectorAll("[data-uid]")
      ).map((element) => element.getAttribute("data-uid"));

      bubble_fn_participantList(remainingParticipants);
      updateVideoWrapperSize();
    },
    onMessageReceived = (message) => {
      console.log("Message received:", message);
    },
    onMicMuted = (isMuted) => {
      console.log(
        `Microphone muted for UID ${uid}: ${isMuted ? "Mic Off" : "Mic On"}`
      );

      // Find the mic status icon for the participant
      const micStatusIcon = document.querySelector(`#mic-status-${uid}`);
      if (micStatusIcon) {
        micStatusIcon.style.display = isMuted ? "block" : "none";
      }
      bubble_fn_isMicOff(isMuted);
    },
    onCamMuted = (uid, isMuted) => {
      console.log(
        `Camera muted for UID ${uid}: ${isMuted ? "Camera Off" : "Camera On"}`
      );

      if (!uid) {
        console.error("UID is undefined, cannot find video wrapper.");
        return;
      }

      // Find the video wrapper for the participant
      const videoWrapper = document.querySelector(`#video-wrapper-${uid}`);
      if (videoWrapper) {
        const videoPlayer = videoWrapper.querySelector(`#stream-${uid}`);
        const avatarDiv = videoWrapper.querySelector(`#avatar-${uid}`);

        // Toggle between showing video and avatar based on whether the camera is muted
        if (isMuted) {
          videoPlayer.style.display = "none"; // Hide the video player
          avatarDiv.style.display = "block"; // Show the avatar
        } else {
          videoPlayer.style.display = "block"; // Show the video player
          avatarDiv.style.display = "none"; // Hide the avatar
        }
      }
      bubble_fn_isCamOff(isMuted);
    },
    onScreenShareEnabled = (enabled) => {
      console.log("Screen share status:", enabled ? "Sharing" : "Not sharing");
      bubble_fn_isScreenOff(enabled);
    },
    onUserLeave = () => {
      window.location.href = "https://sccopy-38403.bubbleapps.io/dashboard";
    },
    onCameraChanged = (info) => {
      console.log("Camera changed!", info.state, info.device);
    },
    onMicrophoneChanged = (info) => {
      console.log("Microphone changed!", info.state, info.device);
    },
    onSpeakerChanged = (info) => {
      console.log("Speaker changed!", info.state, info.device);
    },
    onRoleChanged = async (targetUid, role) => {
      console.log(`Role changed for UID ${targetUid}, new role: ${role}`);
    },
    onNeedJoinToVideoStage = (user) => {
      console.log(`onNeedJoinToVideoStage: ${user}`);
      return user.role !== "audience";
    },
    onNeedMuteCameraAndMic = (user) => {
      console.log(`Default onNeedMuteCameraAndMic for user: ${user.id}`);
      return false; // Default behavior, not muting mic or camera
    },
    onVolumeIndicatorChanged = (volume) => {
      console.log("Default onVolumeIndicatorChanged:", volume);
    },
    onError = (error) => {
      console.error("Error occurred:", error);
    },
  } = options;

  // Set up the video stage element
  window["videoStage"] = document.querySelector("#video-stage");

  // Template for each video participant
  const templateVideoParticipant = `
<div id="video-wrapper-{{uid}}" style="
  flex: 1 1 320px; 
  max-width: 800px; 
  min-height: 220px; 
  height: 100%; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  margin: 5px; 
  border-radius: 10px; 
  overflow: hidden; 
  position: relative; 
  background-color: #000;
  box-sizing: border-box;
" data-uid="{{uid}}">
    <!-- Video Player -->
    <div id="stream-{{uid}}" class="video-player" style="
      width: 100%; 
      height: 100%; 
      display: flex; 
      justify-content: center; 
      align-items: center;
      object-fit: cover;
    "></div>
    
    <!-- User Avatar (shown when video is off) -->
    <img id="avatar-{{uid}}" class="user-avatar" src="{{avatar}}" alt="{{name}}'s avatar" style="
      display: none; 
      width: 100px; 
      height: 100px; 
      border-radius: 50%; 
      object-fit: cover;
    " />

    <!-- User Name -->
    <div id="name-{{uid}}" class="user-name" style="
      position: absolute; 
      bottom: 10px; 
      left: 10px; 
      font-size: 16px; 
      color: #fff; 
      background-color: rgba(0, 0, 0, 0.5); 
      padding: 5px 10px; 
      border-radius: 5px;
    ">
      {{name}}
    </div>

    <!-- Participant Status Indicators -->
    <div class="status-indicators" style="
      position: absolute; 
      top: 10px; 
      right: 10px; 
      display: flex; 
      gap: 5px;
    ">
      <!-- Microphone Status Icon -->
      <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted" style="
        width: 24px; 
        height: 24px; 
        background-image: url('icons/mic-muted.svg'); 
        background-size: contain; 
        background-repeat: no-repeat; 
        display: none;
      "></span>
      
      <!-- Camera Status Icon -->
      <span id="cam-status-{{uid}}" class="cam-status" title="Camera is off" style="
        width: 24px; 
        height: 24px; 
        background-image: url('icons/camera-off.svg'); 
        background-size: contain; 
        background-repeat: no-repeat; 
        display: none;
      "></span>
    </div>
  </div>
`;

  // Initialize the MainApp with the necessary configurations
  const mainApp = MainApp({
    appId: "88eb7ea8de544d68a718601966c086ce",
    callContainerSelector: "#video-stage",
    serverUrl: "https://agora-new.vercel.app",
    channelName: channelName,
    uid: uid,
    user: {
      id: uid,
      name: name, // Dynamically pass the user's name
      avatar: avatar, // Dynamically pass the user's avatar
      role: role, // 'host' or 'audience'
    },
    participantPlayerContainer: templateVideoParticipant,
    onParticipantsChanged: onParticipantsChanged,
    onParticipantLeft: onParticipantLeft,
    onMessageReceived: onMessageReceived,
    onMicMuted: onMicMuted,
    onCamMuted: onCamMuted,
    onScreenShareEnabled: onScreenShareEnabled,
    onUserLeave: onUserLeave,
    onError: onError,
    onCameraChanged: onCameraChanged,
    onMicrophoneChanged: onMicrophoneChanged,
    onSpeakerChanged: onSpeakerChanged,
    onRoleChanged: onRoleChanged,
    onNeedJoinToVideoStage: onNeedJoinToVideoStage,
    onNeedMuteCameraAndMic: onNeedMuteCameraAndMic,
    onVolumeIndicatorChanged: onVolumeIndicatorChanged,
  });

  console.log("MainApp initialized:", mainApp);
  window.mainApp = mainApp;

  // Call the join method to join the channel
  mainApp.join();

  return mainApp;
}

window.initAgoraApp = initAgoraApp;
