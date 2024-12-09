// External script imports
import "https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.22.2/AgoraRTC_N-production.min.js";
import "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
import "https://unpkg.com/agora-extension-virtual-background@2.0.0/agora-extension-virtual-background.js";
import "https://startupcorners-df3e7.web.app/js/main.js";

// Inline JavaScript
document.addEventListener('DOMContentLoaded', function () {
  let videoStage;

  // Define updateLayout as a global function
  window.updateLayout = function () {
    if (!videoStage) {
      console.log("updateLayout skipped: .video-stage is not present in the DOM.");
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
        "updateLayout skipped: .video-stage is not visible based on dimensions or visibility properties."
      );
      return;
    }

    const participants = Array.from(videoStage.children);
    const participantCount = participants.length;

    console.log(`updateLayout called with ${participantCount} participant(s).`);

    // Remove any existing child-count-X class
    videoStage.className = videoStage.className.replace(/\bchild-count-\d+\b/g, "").trim();

    // Add the new child-count class based on the current number of participants
    videoStage.classList.add(`child-count-${Math.min(participantCount, 9)}`);
  };

  // Observe DOM for the addition of .video-stage
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains("video-stage")) {
            videoStage = node;
            console.log(".video-stage has been added to the DOM.");
            observer.disconnect(); // Stop observing once .video-stage is found
            window.updateLayout(); // Initial layout update
          }
        });
      }
    });
  });

  // Start observing the document body for the addition of .video-stage
  observer.observe(document.body, { childList: true, subtree: true });

  // Re-check layout on window resize
  window.addEventListener("resize", window.updateLayout);
});
