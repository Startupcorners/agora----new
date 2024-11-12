export const toggleVideoOrAvatar = (
  uid,
  videoTrack,
  avatarDiv,
  videoPlayer
) => {
  if (videoTrack) {
    // Video track is available, show the video
    videoPlayer.style.display = "block";
    avatarDiv.style.display = "none";
    videoTrack.play(videoPlayer);
  } else {
    // No video track, show the avatar
    videoPlayer.style.display = "none";
    avatarDiv.style.display = "block";
  }
};


export const toggleMicIcon = (uid, isMuted) => {
  // Select the mic icon within the name tag by UID
  const micIcon = document.querySelector(`#name-${uid} .mic-icon`);

  if (micIcon) {
    micIcon.style.display = isMuted ? "inline-block" : "none"; // Show or hide based on isMuted
  } else {
    console.warn(`Mic icon for user ${uid} not found.`);
  }
};

