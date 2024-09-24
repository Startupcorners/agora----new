import "./handles.js";
import "./main.js";


const handleUserUnpublished = async (user, mediaType) => {
  if (mediaType === "video") {
    const videoWrapper = document.querySelector(`#video-wrapper-${user.uid}`);
    if (videoWrapper) {
      const videoPlayer = videoWrapper.querySelector(`#stream-${user.uid}`);
      const avatarDiv = videoWrapper.querySelector(`#avatar-${user.uid}`);

      videoPlayer.style.display = "none"; // Hide the video player
      avatarDiv.style.display = "block"; // Show the avatar
    }
  }
};

const handleMessageFromPeer = async (message, peerId) => {
  console.log("messageFromPeer");
  const data = JSON.parse(message.text);
  console.log(data);

  if (data.event === "mic_off") {
    await toggleMic(true);
  } else if (data.event === "cam_off") {
    await toggleCamera(true);
  } else if (data.event === "remove_participant") {
    await leave();
  }
};

const handleMemberJoined = async (memberId) => {
  console.log(`Member joined: ${memberId}`);
  await handleOnUpdateParticipants();
};
