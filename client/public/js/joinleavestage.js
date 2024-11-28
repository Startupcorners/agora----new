import { getConfig, updateConfig } from "./config.js";
import {updateMicStatusElement, updatePublishingList} from "./uiHandlers.js";
import { addUserWrapper } from "./wrappers.js";

export const joinVideoStage = async (config) => {
  console.warn("joinVideoStage called");

  try {
    console.log("Creating and enabling audio track...");

    try {
      // Create and enable a new audio track
      config.userTracks[config.uid].audioTrack =
        await AgoraRTC.createMicrophoneAudioTrack();
      await config.userTracks[config.uid].audioTrack.setEnabled(true);

      console.log("Audio track created and enabled.");
      updateMicStatusElement(config.uid, false);

      // Publish the audio track
      console.log("Publishing audio track...");
      await config.client.publish([config.userTracks[config.uid].audioTrack]);
      console.log("Audio track published.");
      updatePublishingList(config.uid.toString(), "audio", "add", config);
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

    updateLayout();

    // Successfully joined the video stage, update the config state
    console.log("Joined the video stage with audio status updated.");

    // Mark user as on stage in the config
    config.isOnStage = true;

    // Update the config with the new state
    updateConfig(config, "joinVideoStage");
  } catch (error) {
    console.error("Error in joinVideoStage:", error);
  }
};


// Function to leave the video stage
export const leaveVideoStage = async () => {
  console.warn("leaveVideoStage called");

  try {
    // Unpublish and close audio track
    if (config.userTracks[config.uid]?.audioTrack) {
      console.log("Unpublishing audio track...");
      await config.client.unpublish([config.userTracks[config.uid].audioTrack]);
      config.userTracks[config.uid].audioTrack.close();
      config.userTracks[config.uid].audioTrack = null;
      console.log("Audio track unpublished and closed");
    }

    // Unpublish and close video track
    if (config.userTracks[config.uid]?.videoTrack) {
      console.log("Unpublishing video track...");
      await config.client.unpublish([config.userTracks[config.uid].videoTrack]);
      config.userTracks[config.uid].videoTrack.close();
      config.userTracks[config.uid].videoTrack = null;
      console.log("Video track unpublished and closed");
    }

    // Update stage status to false, as the user has left the stage
    config.isOnStage = false;
    console.log("Left the video stage successfully");

    // Update the config state
    updateConfig(config, "leaveVideoStage");
  } catch (error) {
    console.error("Error in leaveVideoStage:", error);
  }
};
