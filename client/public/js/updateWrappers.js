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
  // Corrected selector to match the HTML ID
  const micIcon = document.querySelector(`#mic-status-${uid}`);

  if (micIcon) {
    if (isMuted) {
      micIcon.style.display = "block"; // Show muted mic icon
    } else {
      micIcon.style.display = "none"; // Hide muted mic icon
    }
  } else {
    console.warn(`Mic icon for user ${uid} not found.`);
  }
};

