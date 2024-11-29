import { updatePublishingList } from "./talkToBubble.js";
import { updateMicStatusElement } from "./uiHandlers.js";

export const handleAudioPublished = async (user, userUid, config, client) => {
  console.log(`Handling audio published for user: ${userUid}`);
  console.log("config", config);

  try {
    // Check if the user's role is "waiting"
    if (config.user.roleInTheCall === "waiting") {
      console.warn(
        `User ${userUid} is in 'waiting' role. Subscribing but muting audio.`
      );

      // Subscribe to the audio track even if the user is waiting
      await client.subscribe(user, "audio");
      console.log(`Subscribed to audio track for user ${userUid}`);

      // Mute the audio track to prevent the waiting user from hearing anything
      user.audioTrack.setMuted(true);
      console.log(`Muted audio track for user ${userUid}`);

      return; // Exit, no need to proceed with playing audio or updating UI
    }

    // If the user is not in the "waiting" role, proceed as normal
    // Subscribe to the audio track using the client object
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
  } catch (error) {
    console.error(`Error subscribing to audio for user ${userUid}:`, error);
  }
};

export const handleAudioUnpublished = async (user, userUid) => {
  console.log(`Handling audio unpublishing for user: ${userUid}`);

  try {
    // Stop and remove the audio track
    if (user.audioTrack) {
      user.audioTrack.stop();
      console.log(`Stopped and removed audio track for user ${userUid}`);
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
  } catch (error) {
    console.error(
      `Error handling audio unpublishing for user ${userUid}:`,
      error
    );
  }
};

export const toggleMic = async () => {
  try {
    console.log("client.localTrack:", client.localTrack); // Log the local track

    const localAudioTrack = client.localTrack?.audioTrack; // Access the local audio track

    if (localAudioTrack && localAudioTrack.isPlaying()) {
      // Microphone is active and playing; mute it
      await endMic(); // Mute the microphone
    } else {
      // Microphone is not playing (muted); activate it
      await startMic(); // Start the microphone
    }
  } catch (error) {
    console.error("Error in toggleMic for user:", error);
  }
};

const startMic = async () => {
  try {
    console.log("Starting microphone for user:", config.uid);

    // Check if the microphone audio track already exists
    if (!client.localTrack || !client.localTrack.audioTrack) {
      // Create and assign a new microphone audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      // Publish the audio track
      await client.publish([audioTrack]);
      console.log("Microphone started and published");
    } else {
      console.log("Microphone already active, no need to create a new track.");
    }

    // Update UI to indicate the microphone is active
    updateMicStatusElement(config.uid, false); // Mic is unmuted
    bubble_fn_isMicOff(false);

    // If usersPublishingAudio is not initialized, initialize it
    if (!config.usersPublishingAudio) {
      config.usersPublishingAudio = [];
    }

    if (!config.usersPublishingAudio.includes(config.uid.toString())) {
      config.usersPublishingAudio.push(config.uid.toString());
    }

    console.log(
      "Updated usersPublishingAudio list:",
      config.usersPublishingAudio
    );

    // Notify Bubble with the updated list
    if (typeof bubble_fn_usersPublishingAudio === "function") {
      bubble_fn_usersPublishingAudio(config.usersPublishingAudio);
    } else {
      console.warn("bubble_fn_usersPublishingAudio is not defined.");
    }
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

const endMic = async () => {
  try {
    console.log("Ending microphone for user:", config.uid);

    // Ensure the local audio track exists
    const localAudioTrack = client.localTrack?.audioTrack;

    if (localAudioTrack) {
      // Unpublish and stop the audio track
      await client.unpublish([localAudioTrack]);
      localAudioTrack.stop();
      localAudioTrack.close();

      console.log("Microphone ended and unpublished");
      updatePublishingList(config.uid.toString(), "audio", "remove");
    } else {
      console.error("No audio track found for the user.");
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
