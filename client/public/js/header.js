// External script imports
import "https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.22.2/AgoraRTC_N-production.min.js";
import "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
import "https://unpkg.com/agora-extension-virtual-background@2.0.0/agora-extension-virtual-background.js";
import "https://startupcorners-df3e7.web.app/js/main.js";

document.addEventListener("DOMContentLoaded", function () {
  console.log("Video stage script running!");

  let videoStage;

  // Define updateLayout as a global function
  window.updateLayout = function () {
    if (!videoStage) {
      console.log("updateLayout skipped: no video stage element present.");
      return;
    }

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
      console.log("updateLayout skipped: stage is not visible.");
      return;
    }

    const participants = Array.from(videoStage.children);
    const participantCount = participants.length;
    console.log(`updateLayout called with ${participantCount} participant(s).`);

    // Remove any existing child-count-X class
    videoStage.className = videoStage.className
      .replace(/\bchild-count-\d+\b/g, "")
      .trim();
    videoStage.classList.add(`child-count-${Math.min(participantCount, 9)}`);
  };

  // Check immediately on DOMContentLoaded
  let initialCheck = document.querySelector(
    ".video-stage, .video-stage-screenshare"
  );
  console.log("Check on DOMContentLoaded:", initialCheck);

  if (initialCheck) {
    videoStage = initialCheck;
    console.log("Found stage at DOMContentLoaded:", videoStage);
    window.updateLayout();
  } else {
    console.log(
      "Stage not found at DOMContentLoaded, starting MutationObserver..."
    );

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.classList &&
              (node.classList.contains("video-stage") ||
                node.classList.contains("video-stage-screenshare"))
            ) {
              videoStage = node;
              console.log(
                ".video-stage or .video-stage-screenshare has been added to the DOM:",
                videoStage
              );
              // You can disconnect if you don't need further observation, or keep observing if it might change again.
              observer.disconnect();
              window.updateLayout();
              return;
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("resize", window.updateLayout);
});
