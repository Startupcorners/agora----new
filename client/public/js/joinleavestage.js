import {updatePublishingList} from "./talkToBubble"
import { updateMicStatusElement } from "./uiHandlers";
import { addUserWrapper, removeUserWrapper } from "./wrappers";



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
export const leaveVideoStage = async () => {
  console.warn("leaveVideoStage called");

  try {
    // Disable the audio track if it exists
    if (config.client.localTracks.audioTrack) {
      console.log("Disabling audio track...");
      await config.client.localTracks.audioTrack.setEnabled(false);
      console.log("Audio track disabled");
    }

    // Disable the video track if it exists
    if (config.client.localTracks.videoTrack) {
      console.log("Disabling video track...");
      await config.client.localTracks.videoTrack.setEnabled(false);
      console.log("Video track disabled");
    }

    await removeUserWrapper(config.uid);

    // Update stage status to false, as the user has left the stage
    console.log("Left the video stage successfully");
  } catch (error) {
    console.error("Error in leaveVideoStage:", error);
  }
};

