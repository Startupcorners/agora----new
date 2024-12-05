import {sendNotification} from "./helperFunctions.js"

// Internal variables to store the selected devices
let selectedMic = null;
let selectedCam = null;
let selectedSpeaker = null;

/**
 * Get the current value of the selected microphone.
 * @returns {string|null} The selected microphone ID, or null if not set.
 */
export const getSelectedMic = () => selectedMic;

/**
 * Update the value of the selected microphone.
 * @param {string} mic - The new microphone ID to set.
 */
export const setSelectedMic = (mic) => {
  console.log(`Updating selectedMic from ${selectedMic} to ${mic}`);
  selectedMic = mic;
};

/**
 * Get the current value of the selected camera.
 * @returns {string|null} The selected camera ID, or null if not set.
 */
export const getSelectedCam = () => selectedCam;

/**
 * Update the value of the selected camera.
 * @param {string} cam - The new camera ID to set.
 */
export const setSelectedCam = (cam) => {
  console.log(`Updating selectedCam from ${selectedCam} to ${cam}`);
  selectedCam = cam;
};

/**
 * Get the current value of the selected speaker.
 * @returns {string|null} The selected speaker ID, or null if not set.
 */
export const getSelectedSpeaker = () => selectedSpeaker;

/**
 * Update the value of the selected speaker.
 * @param {string} speaker - The new speaker ID to set.
 */
export const setSelectedSpeaker = (speaker) => {
  console.log(`Updating selectedSpeaker from ${selectedSpeaker} to ${speaker}`);
  selectedSpeaker = speaker;
};


export const switchCam = async (camInfo, config) => {
    sendNotification("log", "switching camera", config); 
    const client = config.client
  try {
    // Parse camInfo if it is a string
    if (typeof camInfo === "string") {
      try {
        camInfo = JSON.parse(camInfo);
      } catch (e) {
        camInfo = { deviceId: camInfo, label: "Unknown label" };
      }
    }

    console.log(`Switching to new camera with deviceId: ${camInfo.deviceId}`);

    const videoTrack = client.localTracks?.find(
      (track) => track.trackMediaType === "video"
    );

    if (!videoTrack) {
      console.error("No video track found. Unable to switch camera.");
      return;
    }

    // Use the setDevice method to switch the camera
    await videoTrack.setDevice(camInfo.deviceId);
    console.log(`Switched to new camera: ${camInfo.deviceId}`);

    // Update the selected camera
    selectedCam = camInfo;

    // Notify Bubble of the new selected camera with deviceId and label
    if (typeof bubble_fn_selectedCam === "function") {
      bubble_fn_selectedCam(videoTrack.getTrackLabel() || "No label");
    }
  } catch (error) {
    console.error("Error switching camera:", error);
    sendNotification("log", error, config); 
  }
};

export const handleCameraDeactivation = async (deactivatedDevice, config) => {
  console.log("Handling camera deactivation...");

  // If the selected camera is deactivated, set it to null
  if (selectedCam && selectedCam.deviceId === deactivatedDevice.deviceId) {
    selectedCam = null; // Use the external variable

    // Get the updated list of devices and select the first available camera
    const devices = await AgoraRTC.getDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");

    if (cameras.length > 0) {
      console.log("Camera removed, switching to the first available camera...");
      await switchCam(cameras[0], config);
    } else {
      console.log("No cameras available to switch to after removal.");
    }
  }
};

// Function to update selected devices in the config and notify Bubble when user joins
export const updateSelectedDevices = async () => {
  try {
    // Fetch devices using Agora's getDevices
    const devices = await AgoraRTC.getDevices();

    // Separate devices into microphones, cameras, and speakers
    const microphones = devices.filter(
      (device) => device.kind === "audioinput"
    );
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const speakers = devices.filter((device) => device.kind === "audiooutput");

    // Set selected microphone if not already set
    if (!selectedMic && microphones.length > 0) {
      selectedMic = microphones[0];
      console.log("Selected microphone set to:", selectedMic.label);

      // Notify Bubble of the selected microphone
      if (typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic(selectedMic.label);
      }
    }

    // Set selected camera if not already set
    if (!selectedCam && cameras.length > 0) {
      selectedCam = cameras[0];
      console.log("Selected camera set to:", selectedCam.label);

      // Notify Bubble of the selected camera
      if (typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam(selectedCam.label);
      }
    }

    // Set selected speaker if not already set
    if (!selectedSpeaker && speakers.length > 0) {
      selectedSpeaker = speakers[0];
      console.log("Selected speaker set to:", selectedSpeaker.label);

      // Notify Bubble of the selected speaker
      if (typeof bubble_fn_selectedSpeaker === "function") {
        bubble_fn_selectedSpeaker(selectedSpeaker.label);
      }
    }
  } catch (error) {
    console.error("Error fetching and updating selected devices:", error);
  }
};

export const switchMic = async (micInfo, config) => {
    const client = config.client
  try {
    // Parse micInfo if it is a string
    if (typeof micInfo === "string") {
      try {
        micInfo = JSON.parse(micInfo);
      } catch (e) {
        micInfo = { deviceId: micInfo, label: "Unknown label" };
      }
    }

    console.log(
      `Switching to new microphone with deviceId: ${micInfo.deviceId}`
    );

    const audioTrack = client.localTracks?.find(
      (track) => track.trackMediaType === "audio"
    );

    const wasPublishing = audioTrack && !audioTrack.muted; // Check if the audio track was actively publishing

    // If there's an existing audio track, unpublish, stop, and close it
    if (audioTrack) {
      if (wasPublishing) {
        await client.unpublish(audioTrack);
        console.log("Previous audio track unpublished.");
      }
      audioTrack.stop();
      audioTrack.close();
      console.log("Previous audio track stopped and closed.");
    }

    // Create a new audio track with the selected microphone device
    const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: micInfo.deviceId,
    });

    // Update the selected microphone
    selectedMic = micInfo;

    // Send the updated microphone to Bubble
    if (typeof bubble_fn_selectedMic === "function") {
      bubble_fn_selectedMic(newAudioTrack.getTrackLabel() || "No label");
    }

    // Republish the new audio track if it was publishing before the switch
    if (wasPublishing) {
      await client.publish(newAudioTrack);
      console.log("New audio track published successfully.");
    } else {
      // Mute and keep the new track unpublished if it was muted
      await newAudioTrack.setEnabled(false);
      console.log("New audio track created but kept muted and unpublished.");
    }

    console.log(`Switched to new microphone: ${micInfo.deviceId}`);
  } catch (error) {
    console.error("Error switching microphone:", error);
  }
};

export const handleMicDeactivation = async (deactivatedDevice) => {
  console.log("Handling microphone deactivation...");

  // If the selected mic is deactivated, set it to null
  if (selectedMic && selectedMic.deviceId === deactivatedDevice.deviceId) {
    selectedMic = null;

    // Get the updated list of devices and select the first available microphone
    const devices = await AgoraRTC.getDevices();
    const microphones = devices.filter(
      (device) => device.kind === "audioinput"
    );

    if (microphones.length > 0) {
      // Switch to the first available microphone
      await switchMic(microphones[0], config);
    } else {
      console.log("No microphones available to switch to after deactivation.");
    }
  }
};


export const switchSpeaker = async (speakerInfo, config) => {
    const client = config.client
  try {
    // Set the selected speaker in config
    config.selectedSpeaker = speakerInfo;
    console.log("Switched to new speaker:", speakerInfo.label);

    // Notify Bubble of the new selected speaker
    if (typeof bubble_fn_selectedSpeaker === "function") {
      bubble_fn_selectedSpeaker(speakerInfo.label);
    }

    // Update the config to persist the speaker change
    updateConfig(config, "switchSpeaker");
  } catch (error) {
    console.error("Error switching speaker:", error);
  }
};

export const handleSpeakerDeactivation = async (deactivatedDevice, config) => {
  console.log("Handling speaker deactivation...");

  // If the selected speaker is deactivated, set it to null
  if (
    selectedSpeaker &&
    selectedSpeaker.deviceId === deactivatedDevice.deviceId
  ) {
    selectedSpeaker = null;

    // Get the updated list of devices and select the first available speaker
    const devices = await AgoraRTC.getDevices();
    const speakers = devices.filter((device) => device.kind === "audiooutput");

    if (speakers.length > 0) {
      // Switch to the first available speaker
      await switchSpeaker(speakers[0], config);
    } else {
      console.log("No speakers available to switch to after deactivation.");
    }
  }
};



// In your device management file
export const checkAndUpdateSelectedCam = async () => {
  // Fetch the list of available devices
  const devices = await AgoraRTC.getDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");

  // Check if selectedCam is still available
  if (
    selectedCam &&
    !cameras.find((cam) => cam.deviceId === selectedCam.deviceId)
  ) {
    if (cameras.length > 0) {
      // Select the first available camera
      selectedCam = cameras[0];

      // Notify Bubble of the selected camera
      if (typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam(selectedCam.label);
      }
    } else {
      // No cameras available
      selectedCam = null;
    }
  }
  // Return selectedCam
  return selectedCam;
};

export const checkAndUpdateSelectedMic = async () => {
  // Fetch the list of available devices
  const devices = await AgoraRTC.getDevices();
  const mics = devices.filter((device) => device.kind === "audioinput");

  // Check if selectedMic is still available
  if (
    selectedMic &&
    !mics.find((mic) => mic.deviceId === selectedMic.deviceId)
  ) {
    if (mics.length > 0) {
      // Select the first available microphone
      selectedMic = mics[0];

      // Notify Bubble of the selected microphone
      if (typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic(selectedMic.label);
      }
    } else {
      // No microphones available
      selectedMic = null;
    }
  }
  // Return selectedMic
  return selectedMic;
};

