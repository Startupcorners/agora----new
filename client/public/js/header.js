// External script imports
import "https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.22.2/AgoraRTC_N-production.min.js";
import "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
import "https://unpkg.com/agora-extension-virtual-background@2.0.0/agora-extension-virtual-background.js";
import "https://startupcorners-df3e7.web.app/js/main.js";


document.addEventListener("DOMContentLoaded", function () {
  let videoStage;

  // Define updateLayout as a global function
  window.updateLayout = function () {
    if (!videoStage) {
      console.log(
        "updateLayout skipped: no video stage element present in the DOM."
      );
      return;
    }

    // Check visibility and log properties
    const computedStyle = window.getComputedStyle(videoStage);
    const isDisplayNone = computedStyle.display === "none";
    const isVisibilityHidden = computedStyle.visibility === "hidden";
    const isZeroWidth = videoStage.offsetWidth === 0;
    const isZeroHeight = videoStage.offsetHeight === 0;

    console.log("Visibility check:", {
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      offsetWidth: videoStage.offsetWidth,
      offsetHeight: videoStage.offsetHeight,
      offsetParent: videoStage.offsetParent,
    });

    if (isDisplayNone || isVisibilityHidden || isZeroWidth || isZeroHeight) {
      console.log(
        "updateLayout skipped: stage element is not visible based on dimensions or visibility properties."
      );
      return;
    }

    const participants = Array.from(videoStage.children);
    const participantCount = participants.length;

    console.log(`updateLayout called with ${participantCount} participant(s).`);

    // Remove any existing child-count-X class from the stage element
    videoStage.className = videoStage.className
      .replace(/\bchild-count-\d+\b/g, "")
      .trim();

    // Add the new child-count class based on the current number of participants
    videoStage.classList.add(`child-count-${Math.min(participantCount, 9)}`);
  };

  // Try to find .video-stage or .video-stage-screenshare immediately
  videoStage = document.querySelector(".video-stage, .video-stage-screenshare");
  if (videoStage) {
    console.log(
      ".video-stage or .video-stage-screenshare found on initial load."
    );
    window.updateLayout();
  } else {
    // If not found, observe DOM for the addition of either element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (
              node.classList &&
              (node.classList.contains("video-stage") ||
                node.classList.contains("video-stage-screenshare"))
            ) {
              videoStage = node;
              console.log(
                ".video-stage or .video-stage-screenshare has been added to the DOM."
              );
              observer.disconnect(); // Stop observing once found (remove if you want to keep observing changes)
              window.updateLayout(); // Initial layout update
            }
          });
        }
      });
    });

    // Start observing the document body for the addition of .video-stage or .video-stage-screenshare
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Re-check layout on window resize
  window.addEventListener("resize", window.updateLayout);
});
