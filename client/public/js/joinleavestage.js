import { updatePublishingList } from "./talkToBubble.js";
import { updateMicStatusElement } from "./uiHandlers.js";
import { addUserWrapper, removeUserWrapper } from "./wrappers.js";
import { startMic, endMic } from "./audio.js";
import { stopCamera, stopScreenShare } from "./video.js";




export const joinVideoStage = async (config) => {
  console.warn("joinVideoStage called");

  try {
    console.log("Creating and enabling audio track...");

    try {
      // Create and enable a new audio track using Agora's client.localTracks
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await audioTrack.setEnabled(true);

      console.log("Audio track created and enabled.");
      updateMicStatusElement(config.uid, false);

      // Publish the audio track
      console.log("Publishing audio track...");
      await config.client.publish([audioTrack]);
      console.log("Audio track published.");
      updatePublishingList(config.uid.toString(), "audio", "add");
    } catch (error) {
      // Handle specific microphone-related errors
      if (error.name === "NotAllowedError") {
        console.warn(
          "Microphone access denied by the user or browser settings."
        );
      } else if (error.name === "NotFoundError") {
        console.warn("No microphone found on this device.");
      } else {
        console.warn("Unexpected error creating microphone track:", error);
      }

      // Trigger the Bubble function with "yes" to indicate muted status
      console.log(
        "Triggering Bubble function: system muted (no audio available)."
      );
      bubble_fn_systemmuted("yes");
      updateMicStatusElement(config.uid, true);
    }

    console.log("User is host, performing additional setup");
    await addUserWrapper(config.uid, config);

    // Successfully joined the video stage, update the config state
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

