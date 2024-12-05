import { updatePublishingList } from "./talkToBubble.js";
import { updateMicStatusElement } from "./uiHandlers.js";
import { getPreviousRoleInTheCall } from "./roleChange.js";

export const handleAudioPublished = async (user, userUid, config) => {
  const client = config.client;
  console.log(`Handling audio published for user: ${userUid}`);
  console.log("config", config);

  try {
    // Check if the current role is "waiting"
    if (config.user.role === "waiting") {
      const previousRole = getPreviousRoleInTheCall();

      console.log(
        `Current role is 'waiting'. Previous role retrieved: ${previousRole}`
      );

      // If the previous role is null or "waiting", subscribe but mute
      if (previousRole === null || previousRole === "waiting") {
        console.warn(
          `User ${userUid} is in 'waiting' or had a previous role of 'waiting'. Subscribing but muting audio.`
        );

        // Subscribe to the audio track
        await client.subscribe(user, "audio");
        console.log(`Subscribed to audio track for user ${userUid}`);

        // Do not play the audio
        console.log(
          `Audio for user ${userUid} is muted due to role: ${config.user.role} and previous role: ${previousRole}`
        );
        return; // Exit, no need to proceed with playing audio or updating UI
      }
    }

    // If not in "waiting" or if the previous role allows it, proceed as normal
    await client.subscribe(user, "audio");
    console.log(`Subscribed to audio track for user ${userUid}`);

    // Play audio track directly (they are now allowed to hear it)
    user.audioTrack.play();
    console.log(`Playing audio track for user ${userUid}.`);

    // Update the mic status element to show unmuted state
    const micStatusElement = document.getElementById(`mic-status-${userUid}`);
    if (micStatusElement) {
      micStatusElement.classList.add("hidden"); // Hide the muted icon
      console.log(
        `Added 'hidden' class to mic-status-${userUid} to indicate unmuted status`
      );
    } else {
      console.warn(`Mic status element not found for user ${userUid}`);
    }

    // Update the publishing list
    updatePublishingList(userUid.toString(), "audio", "add");
    console.log("config:", config);
  } catch (error) {
    console.error(`Error subscribing to audio for user ${userUid}:`, error);
  }
};


export const handleAudioUnpublished = async (user, userUid, config) => {
    const client = config.client;
  console.log(`Handling audio unpublishing for user: ${userUid}`);

  try {
    // Stop and remove the audio track
    if (user.audioTrack) {
      user.audioTrack.stop();
      console.log(`Stopped and removed audio track for user ${userUid}`, user.audioTrack);

    }

    // Update the mic status element to show muted state
    const micStatusElement = document.getElementById(`mic-status-${userUid}`);
    if (micStatusElement) {
      micStatusElement.classList.remove("hidden"); // Show the muted icon
      console.log(
        `Removed 'hidden' class from mic-status-${userUid} to indicate muted status`
      );
    } else {
      console.warn(`Mic status element not found for user ${userUid}`);
    }

    // Update the wrapper's border style to indicate no active audio
    const wrapper = document.querySelector(`#video-wrapper-${userUid}`);
    if (wrapper) {
      wrapper.style.borderColor = "transparent"; // Transparent when audio is unpublished
      console.log(`Set border to transparent for user ${userUid}`);
    }

    // Remove the 'animated' class from all bars
    const waveElement = document.querySelector(`#wave-${userUid}`);
    if (waveElement) {
      const audioBars = waveElement.querySelectorAll(".bar");
      if (audioBars.length > 0) {
        audioBars.forEach((bar) => bar.classList.remove("animated"));
        console.log(`Removed 'animated' class from bars for user ${userUid}`);
      } else {
        console.warn(`No bars found in wave-${userUid}`);
      }
    } else {
      console.warn(`Wave element not found for user ${userUid}`);
    }

    // Update the publishing list
    updatePublishingList(userUid.toString(), "audio", "remove");
    console.log("config:", config);
  } catch (error) {
    console.error(
      `Error handling audio unpublishing for user ${userUid}:`,
      error
    );
  }
};


export const toggleMic = async (config) => {
  const client = config.client;

  try {
    console.log("client.localTracks:", client.localTracks); // Log the local tracks array

    // Find the local audio track
    const localAudioTrack = client.localTracks?.find(
      (track) => track.trackMediaType === "audio"
    );
    console.log("Local audio track:", localAudioTrack);

    if (localAudioTrack && localAudioTrack.enabled) {
      // Microphone is active; mute it
      console.log("Microphone is active; muting...");
      await endMic(config);
    } else {
      // Microphone is muted or does not exist; activate it
      console.log("Microphone is muted or does not exist; activating...");
      await startMic(config);
    }
  } catch (error) {
    console.error("Error in toggleMic for user:", error);
  }
};





export const startMic = async (config) => {
  const client = config.client;

  try {
    console.log("Starting microphone for user:", config.uid);

    // Get the updated selected microphone
    const updatedSelectedMic = await checkAndUpdateSelectedMic();

    if (!updatedSelectedMic) {
      console.error("No microphone available to start audio track.");
      // Update UI to indicate the microphone is off
      updateMicStatusElement(config.uid, true); // Mic is muted/off
      bubble_fn_isMicOff(true);
      return;
    }

    // Check if the microphone audio track already exists
    let audioTrack = client.localTracks?.find(
      (track) => track.trackMediaType === "audio"
    );

    if (!audioTrack) {
      // Create and assign a new microphone audio track using the selected microphone
      console.log("No active microphone track found. Creating a new one...");
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: updatedSelectedMic.deviceId,
      });

      console.log("New audio track created:", audioTrack);
    } else {
      console.log("Microphone already active, enabling the existing track...");

      // Check if the audio track is using the correct microphone
      const currentDeviceId = audioTrack.getTrackLabel();
      if (currentDeviceId !== updatedSelectedMic.deviceId) {
        console.log("Switching to the selected microphone...");
        await audioTrack.setDevice(updatedSelectedMic.deviceId);
      }

      await audioTrack.setEnabled(true); // Unmute the existing track
    }

    // Publish the audio track globally
    console.log("Publishing audio track globally...");
    await client.publish([audioTrack]);
    console.log("Microphone started and published.");

    // Update the publishing list
    updatePublishingList(config.uid.toString(), "audio", "add");

    // Update UI to indicate the microphone is active
    updateMicStatusElement(config.uid, false); // Mic is unmuted
    bubble_fn_isMicOff(false);
  } catch (error) {
    console.warn(
      "Error accessing or creating microphone track, setting mic to off.",
      error
    );

    // Trigger muted status in the UI
    updateMicStatusElement(config.uid, true);
    bubble_fn_isMicOff(true);
  }
};




export const endMic = async (config) => {
  const client = config.client;

  try {
    console.log("Ending microphone for user:", config.uid);

    // Find the local audio track
    const localAudioTrack = client.localTracks?.find(
      (track) => track.trackMediaType === "audio"
    );
    if (!localAudioTrack) {
      console.log("No audio tracks to stop");
      return;
    }

    if (localAudioTrack) {
      // Mute the track locally
      console.log("Muting audio track locally...");
      await localAudioTrack.setEnabled(false);

      // Unpublish the track globally
      console.log("Unpublishing audio track globally...");
      await client.unpublish([localAudioTrack]);

      console.log("Microphone muted and unpublished.");
      updatePublishingList(config.uid.toString(), "audio", "remove");
    } else {
      console.warn("No local audio track found. Microphone is not active.");
    }

    // Update UI to indicate the microphone is muted
    updateMicStatusElement(config.uid, true); // Mic is muted

    // Set wrapper border to transparent
    const wrapper = document.querySelector(`#video-wrapper-${config.uid}`);
    if (wrapper) {
      wrapper.style.borderColor = "transparent"; // Transparent when muted
      console.log(`Set border to transparent for user ${config.uid}`);
    }

    // Remove the 'animated' class from all bars
    const waveElement = document.querySelector(`#wave-${config.uid}`);
    if (waveElement) {
      const audioBars = waveElement.querySelectorAll(".bar");
      if (audioBars.length > 0) {
        audioBars.forEach((bar) => bar.classList.remove("animated"));
        console.log(
          `Removed 'animated' class from bars for user ${config.uid}`
        );
      } else {
        console.warn(`No bars found in wave-${config.uid}`);
      }
    } else {
      console.warn(`Wave element not found for user ${config.uid}`);
    }

    // Notify Bubble that the microphone is off
    bubble_fn_isMicOff(true);
  } catch (error) {
    console.error("Error in endMic for user:", config.uid, error);
  }
};


