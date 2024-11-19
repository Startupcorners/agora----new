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
  const micIcon = document.querySelector(`#mic-status-${uid}`);

  if (micIcon) {
    micIcon.style.display = isMuted ? "inline-block" : "none";
    console.log(
      `Mic icon for user ${uid} updated to ${isMuted ? "muted" : "unmuted"}.`
    );
  } else {
    console.warn(`Mic icon for user ${uid} not found. Retrying...`);

    // Retry after a short delay if the mic icon is not found
    setTimeout(() => toggleMicIcon(uid, isMuted), 500);
  }
};
