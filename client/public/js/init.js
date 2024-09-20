export function initAgoraApp(
  channelName,
  uid,
  role,
  name,
  avatar,
  options = {}
) {
  const {
    onParticipantsChanged = (participants) => {
      console.log("Participants changed:", participants);
      const idList = participants.map((participant) => participant.id);

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
    },
    onMessageReceived = (message) => {
      console.log("Message received:", message);
    },
    onMicMuted = (isMuted) => {
      console.log(`Microphone muted for UID ${uid}: ${isMuted ? 'Mic Off' : 'Mic On'}`);

  // Find the mic status icon for the participant
  const micStatusIcon = document.querySelector(`#mic-status-${uid}`);
  if (!micStatusIcon) {
    console.error(`No mic status icon found for UID: ${uid}`);
    return;
  }

  // Toggle the mic icon visibility based on the muted state
  micStatusIcon.style.display = isMuted ? 'block' : 'none';
      bubble_fn_isMicOff(isMuted);
    },
    onCamMuted = (uid, isMuted) => {
  console.log(`Camera muted for UID ${uid}: ${isMuted ? 'Camera Off' : 'Camera On'}`);

  if (!uid) {
    console.error("UID is undefined, cannot find video wrapper.");
    return;
  }

  // Find the video wrapper for the participant
  const videoWrapper = document.querySelector(`#video-wrapper-${uid}`);
  if (!videoWrapper) {
    console.error(`No video wrapper found for UID: ${uid}`);
    return;
  }

  const videoPlayer = videoWrapper.querySelector(`#stream-${uid}`);
  const avatarDiv = videoWrapper.querySelector(`#avatar-${uid}`);

  // Toggle between showing video and avatar based on whether the camera is muted
  if (isMuted) {
    videoPlayer.style.display = "none";  // Hide the video player
    avatarDiv.style.display = "block";   // Show the avatar
  } else {
    videoPlayer.style.display = "block";  // Show the video player
    avatarDiv.style.display = "none";     // Hide the avatar
  }

  bubble_fn_isCamOff(isMuted);  // Optionally, send this status to Bubble if needed
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
      // You can send this info to Bubble or handle it differently
    },
    onError = (error) => {
      console.error("Error occurred:", error);
      // You can display the error to the user or handle it as needed
    },
  } = options;

  // Set up the video stage element
  window["videoStage"] = document.querySelector("#video-stage");

  // Template for each video participant
  const templateVideoParticipant = `<div id="video-wrapper-965183480" style="flex: 1 1 30%; max-width: 400px; min-width: 250px; min-height: 200px; height: auto; display: flex; justify-content: center; align-items: center; margin: 5px; border-radius: 10px; overflow: hidden; position: relative; background-color: #000;">
    <!-- Video Player -->
    <div id="stream-965183480" class="video-player" style="width: 100%; height: auto; aspect-ratio: 16/9; display: flex; justify-content: center; align-items: center;"></div>
    
    <!-- User Avatar (shown when video is off) -->
    <img id="avatar-965183480" class="user-avatar" src="//8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1721914804225x763896299148515200/image.png" alt="Emily's avatar" style="display: none; width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
    
    <!-- User Name -->
    <div id="name-965183480" class="user-name" style="position: absolute; bottom: 10px; left: 10px; font-size: 16px; color: #fff; background-color: rgba(0, 0, 0, 0.5); padding: 5px 10px; border-radius: 5px;">
      Emily
    </div>
    
    <!-- Participant Status Indicators -->
    <div class="status-indicators" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 10px;">
      <!-- Microphone Status Icon -->
      <span id="mic-status-965183480" class="mic-status" title="Microphone is muted" style="width: 24px; height: 24px; background-image: url('icons/mic-muted.svg'); background-size: contain; background-repeat: no-repeat; display: none;"></span>
      
      <!-- Camera Status Icon -->
      <span id="cam-status-965183480" class="cam-status" title="Camera is off" style="width: 24px; height: 24px; background-image: url('icons/camera-off.svg'); background-size: contain; background-repeat: no-repeat; display: none;"></span>
    </div>
  </div>`;

console.log(
  "Template being passed before MainApp call:",
  templateVideoParticipant
);
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
