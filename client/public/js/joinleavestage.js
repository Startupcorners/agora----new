import { updatePublishingList } from "./talkToBubble.js";
import { updateMicStatusElement } from "./uiHandlers.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { startMic, endMic } from "./audio.js";
import { stopCamera, stopScreenShare } from "./video.js";




export const joinVideoStage = async (config) => {
  console.warn("joinVideoStage called");

  try {
    // Start the microphone using the startMic helper function
    console.log("Starting microphone for video stage...");
    await startMic(config); // startMic will handle mic setup, publishing, and errors

    // Perform additional setup as a host
    console.log("User is host, performing additional setup...");
    await addUserWrapper(config.uid, config);

    // Successfully joined the video stage
    console.log("Joined the video stage with audio status updated.");
  } catch (error) {
    console.error("Error in joinVideoStage:", error);
  }
};




// Function to leave the video stage
export const leaveVideoStage = async (config) => {
  console.warn("leaveVideoStage called");

  try {
    // Turn off mic, camera, and stop screen sharing
    await endMic(config); // Disable and clean up the microphone
    await stopCamera(config); // Disable and clean up the camera
    await stopScreenShare(config); // Stop screen sharing if active

    // Remove user wrapper (UI cleanup)
    if (config.uid) {
      await removeUserWrapper(config.uid);
      console.log(`Removed user wrapper for UID: ${config.uid}`);
    } else {
      console.warn("No UID provided for removeUserWrapper.");
    }

    // Update stage status to reflect that the user has left
    console.log("Left the video stage successfully.");
  } catch (error) {
    console.error("Error in leaveVideoStage:", error);
  }
};

