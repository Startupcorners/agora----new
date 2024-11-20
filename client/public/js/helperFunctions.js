import { enableVirtualBackgroundBlur, enableVirtualBackgroundImage } from "./virtualBackgroundHandlers.js";

export const log = (config, arg) => {
  if (config.debugEnabled) {
    console.log(arg);
  }
};

export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const sendMessageToPeer = (clientRTM, data, uid) => {
  clientRTM
    .sendMessageToPeer(
      {
        text: JSON.stringify(data),
      },
      `${uid}` // Ensuring uid is passed as a string
    )
    .then(() => {
      console.log("Message sent successfully");
    })
    .catch((error) => {
      console.error("Failed to send message:", error);
    });
};

export const fetchTokens = async (config, uidToFetch) => {
  console.log(config)
  console.log(uidToFetch);
  try {
    const uid = uidToFetch || config.uid; // Use screenShareUid if provided, otherwise default to main UID

    const res = await fetch(
      `${config.serverUrl}/generateTokens?channelName=${config.channelName}&uid=${uid}&role=${config.user.role}`,
      {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
    const data = await res.json();

    // Log fetched tokens for debugging
    console.log(`Fetched RTC Token for UID ${uid}:`, data.rtcToken);
    console.log(`Fetched RTM Token for UID ${uid}:`, data.rtmToken);

    return {
      rtcToken: data.rtcToken,
      rtmToken: data.rtmToken,
    };
  } catch (err) {
    console.error("Failed to fetch tokens:", err);
    throw err;
  }
};

export const sendBroadcast = (config, data) => {
  const messageObj = {
    ...data,
    type: "broadcast",
    sender: config.user,
  };
  sendMessage(config.channelRTM, messageObj);
  config.onMessageReceived(messageObj);
};

export const getCameras = async () => {
  return await AgoraRTC.getCameras();
};

export const getMicrophones = async () => {
  return await AgoraRTC.getMicrophones();
};

export const sendMessage = (channelRTM, data) => {
  channelRTM
    .sendMessage({
      text: JSON.stringify(data),
    })
    .then(() => {
      // success
    })
    .catch((error) => {
      console.error(error);
    });
};

export const sendChat = (config, data) => {
  const messageObj = {
    ...data,
    type: "chat",
    sender: config.user,
  };
  sendMessage(config.channelRTM, messageObj);
  config.onMessageReceived(messageObj);
};




// Function to fetch and send the full list of devices to Bubble
export const fetchAndSendDeviceList = async () => {
  try {
    console.log("Fetching available media devices...");
    const devices = await AgoraRTC.getDevices();
    console.log("Devices enumerated by Agora:", devices);

    const microphones = devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    const cameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    const speakers = devices
      .filter((device) => device.kind === "audiooutput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    // Send all device lists to Bubble
    console.log("Sending device lists to Bubble.");
    sendDeviceDataToBubble("microphone", microphones);
    sendDeviceDataToBubble("camera", cameras);
    sendDeviceDataToBubble("speaker", speakers);

    return { microphones, cameras, speakers };
  } catch (error) {
    console.error("Error fetching available devices:", error);
    return { microphones: [], cameras: [], speakers: [] };
  }
};

// Function to update selected devices in the config and notify Bubble when user joins
export const updateSelectedDevices = async (config) => {
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
    if (!config.selectedMic && microphones.length > 0) {
      config.selectedMic = microphones[0];
      console.log("Selected microphone set to:", config.selectedMic.label);

      // Notify Bubble of the selected microphone
      if (typeof bubble_fn_selectedMic === "function") {
        bubble_fn_selectedMic(config.selectedMic.label);
      }
    }

    // Set selected camera if not already set
    if (!config.selectedCam && cameras.length > 0) {
      config.selectedCam = cameras[0];
      console.log("Selected camera set to:", config.selectedCam.label);

      // Notify Bubble of the selected camera
      if (typeof bubble_fn_selectedCam === "function") {
        bubble_fn_selectedCam(config.selectedCam.label);
      }
    }

    // Set selected speaker if not already set
    if (!config.selectedSpeaker && speakers.length > 0) {
      config.selectedSpeaker = speakers[0];
      console.log("Selected speaker set to:", config.selectedSpeaker.label);

      // Notify Bubble of the selected speaker
      if (typeof bubble_fn_selectedSpeaker === "function") {
        bubble_fn_selectedSpeaker(config.selectedSpeaker.label);
      }
    }
  } catch (error) {
    console.error("Error fetching and updating selected devices:", error);
  }
};



export const switchMic = async (config, micInfo) => {
  try {
    // Check if micInfo is a string and try to parse it as JSON
    if (typeof micInfo === "string") {
      try {
        micInfo = JSON.parse(micInfo);
      } catch (e) {
        // If parsing fails, assume micInfo is a deviceId string
        micInfo = { deviceId: micInfo, label: "Unknown label" };
      }
    }

    console.log(
      `Switching to new microphone with deviceId: ${micInfo.deviceId}`
    );

    const { client } = config;

    // Check if the audio track was actively publishing before switching
    const wasPublishing =
      config.localAudioTrack && !config.localAudioTrack.muted;

    // If there's an existing audio track, unpublish, stop, and close it
    if (config.localAudioTrack) {
      if (wasPublishing) {
        await client.unpublish(config.localAudioTrack);
        console.log("Previous audio track unpublished.");
      }
      config.localAudioTrack.stop();
      config.localAudioTrack.close();
      console.log("Previous audio track stopped and closed.");
    }

    // Create a new audio track with the selected microphone device
    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: micInfo.deviceId,
    });
    config.selectedMic = micInfo;

    // Send the updated microphone to Bubble with deviceId and label
    if (typeof bubble_fn_selectedMic === "function") {
      bubble_fn_selectedMic(
        config.localAudioTrack.getTrackLabel() || "No label"
      );
    }

    // Republish the new audio track if it was publishing before the switch
    if (wasPublishing) {
      await client.publish(config.localAudioTrack);
      console.log("New audio track published successfully.");
    } else {
      // Mute and keep the new track unpublished if it was muted
      await config.localAudioTrack.setEnabled(false);
      console.log("New audio track created but kept muted and unpublished.");
    }

    console.log(`Switched to new microphone: ${micInfo.deviceId}`);
  } catch (error) {
    console.error("Error switching microphone:", error);
  }
};



export const switchSpeaker = async (config, speakerInfo) => {
  try {
    // Set the selected speaker in config
    config.selectedSpeaker = speakerInfo;
    console.log("Switched to new speaker:", speakerInfo.label);

    // Notify Bubble of the new selected speaker
    if (typeof bubble_fn_selectedSpeaker === "function") {
      bubble_fn_selectedSpeaker(speakerInfo.label);
    }
  } catch (error) {
    console.error("Error switching speaker:", error);
  }
};


export const switchCam = async (config, userTracks, camInfo) => {
  try {
    // Check if camInfo is a string and try to parse it as JSON
    if (typeof camInfo === "string") {
      try {
        camInfo = JSON.parse(camInfo);
      } catch (e) {
        // If parsing fails, assume camInfo is a deviceId string
        camInfo = { deviceId: camInfo, label: "Unknown label" };
      }
    }

    console.log(`Switching to new camera with deviceId: ${camInfo.deviceId}`);

    const { client, uid } = config;
    let userTrack = userTracks[uid] || {}; // Get or initialize the user track

    // Check if the video track was actively publishing before switching
    const wasPublishing =
      config.localVideoTrack && !config.localVideoTrack.muted;

    // If there's an existing video track, unpublish, stop, and close it
    if (config.localVideoTrack) {
      if (wasPublishing) {
        await client.unpublish(config.localVideoTrack);
        console.log("Previous video track unpublished.");
      }
      config.localVideoTrack.stop();
      config.localVideoTrack.close();
      console.log("Previous video track stopped and closed.");
    }

    // Create a new video track with the selected camera device
    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      cameraId: camInfo.deviceId,
    });
    config.selectedCam = camInfo;

    // Notify Bubble of the new selected camera with deviceId and label
    if (typeof bubble_fn_selectedCam === "function") {
      bubble_fn_selectedCam(
        config.localVideoTrack.getTrackLabel() || "No label"
      );
    }

    // Re-enable virtual background if it was enabled
    if (config.isVirtualBackGroundEnabled) {
      if (config.currentVirtualBackground === "blur") {
        await enableVirtualBackgroundBlur(config);
      } else if (config.currentVirtualBackground) {
        await enableVirtualBackgroundImage(
          config,
          config.currentVirtualBackground
        );
      }
    }

    // Republish the new video track if it was publishing before the switch
    if (wasPublishing) {
      await client.publish(config.localVideoTrack);
      console.log("New video track published successfully.");

      userTracks[uid] = {
        ...userTrack,
        videoTrack: config.localVideoTrack,
      };

      // Update the video player element with the new video feed
      const videoPlayer = document.querySelector(`#stream-${uid}`);
      if (videoPlayer) {
        config.localVideoTrack.play(videoPlayer);
        console.log("Video player updated with new camera feed.");
      }
    } else {
      // If the track was muted, keep the new track muted and unpublished
      userTracks[uid] = {
        ...userTrack,
        videoTrack: null,
      };
      await config.localVideoTrack.setEnabled(false);
      console.log("New video track created but kept muted and unpublished.");
    }

    console.log(`Switched to new camera: ${camInfo.deviceId}`);
  } catch (error) {
    console.error("Error switching camera:", error);
  }
};



// Helper function to format and send device data to Bubbleexport const sendDeviceDataToBubble = (deviceType, devices) => {
  export const sendDeviceDataToBubble = (deviceType, devices) => {
    const formattedData = {
      outputlist1: devices.map((d) => d.deviceId),
      outputlist2: devices.map((d) => d.label || "No label"),
      outputlist3: devices.map((d) => d.kind || "Unknown"),
      outputlist4: devices.map((d) => JSON.stringify(d)), // Converts each device to a JSON string in an array
    };

    // Determine the appropriate Bubble function to call based on device type
    if (
      deviceType === "microphone" &&
      typeof bubble_fn_micDevices === "function"
    ) {
      bubble_fn_micDevices(formattedData);
    } else if (
      deviceType === "camera" &&
      typeof bubble_fn_camDevices === "function"
    ) {
      bubble_fn_camDevices(formattedData);
    } else if (
      deviceType === "speaker" &&
      typeof bubble_fn_speakerDevices === "function"
    ) {
      bubble_fn_speakerDevices(formattedData);
    }
  };