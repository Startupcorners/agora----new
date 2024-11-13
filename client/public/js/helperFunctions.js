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

export const switchCamera = async (config, newCameraDeviceId) => {
  try {
    console.log(`Switching to new camera with deviceId: ${newCameraDeviceId}`);

    const { client, uid } = config;

    // Check if there is an existing video track
    const wasPublishing =
      config.localVideoTrack && !config.localVideoTrack.muted;

    if (config.localVideoTrack) {
      // Unpublish and stop the current video track if it was being published
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
      cameraId: newCameraDeviceId,
    });
    config.selectedCam = newCameraDeviceId; // Update selected camera in config

    // Send the updated camera to Bubble
    if (typeof bubble_fn_selectedCam === "function") {
      bubble_fn_selectedCam({
        output1: newCameraDeviceId,
        output2: config.localVideoTrack.getTrackLabel() || "No label",
      });
    }

    // If the user was using a virtual background, apply it to the new track
    if (config.isVirtualBackGroundEnabled) {
      console.log("Applying virtual background to new video track.");
      if (config.currentVirtualBackground === "blur") {
        await enableVirtualBackgroundBlur(config);
      } else if (config.currentVirtualBackground) {
        await enableVirtualBackgroundImage(
          config,
          config.currentVirtualBackground
        );
      }
    }

    if (wasPublishing) {
      // Publish the new video track if the previous track was being published
      await client.publish(config.localVideoTrack);
      console.log("New video track published successfully.");

      // Update userTracks with the new video track
      userTracks[uid] = {
        ...userTracks[uid],
        videoTrack: config.localVideoTrack,
        isVideoMuted: false, // Reflect that video is on
      };

      // Update the video player element with the new video feed
      const videoPlayer = document.querySelector(`#stream-${uid}`);
      if (videoPlayer) {
        config.localVideoTrack.play(videoPlayer);
        console.log("Video player updated with new camera feed.");
      }
    } else {
      // If the video was previously muted, keep the videoTrack as null
      userTracks[uid] = {
        ...userTracks[uid],
        videoTrack: null,
        isVideoMuted: true, // Reflect that video is off
      };
      await config.localVideoTrack.setEnabled(false);
      console.log("New video track created but kept muted and unpublished.");
    }

    console.log(`Switched to new camera: ${newCameraDeviceId}`);
  } catch (error) {
    console.error("Error switching camera:", error);
  }
};

export const switchMicrophone = async (config, newMicDeviceId) => {
  try {
    console.log(`Switching to new microphone with deviceId: ${newMicDeviceId}`);

    const { client, uid } = config;

    // Check if there is an existing audio track
    const wasPublishing =
      config.localAudioTrack && !config.localAudioTrack.muted;

    if (config.localAudioTrack) {
      // Unpublish and stop the current audio track if it was being published
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
      microphoneId: newMicDeviceId,
    });
    config.selectedMic = newMicDeviceId; // Update selected microphone in config

    // Send the updated microphone to Bubble
    if (typeof bubble_fn_selectedMic === "function") {
      bubble_fn_selectedMic({
        output1: newMicDeviceId,
        output2: config.localAudioTrack.getTrackLabel() || "No label",
      });
    }

    // If the previous track was being published, publish the new audio track
    if (wasPublishing) {
      await client.publish(config.localAudioTrack);
      console.log("New audio track published successfully.");

      // Update userTracks with the new audio track
      userTracks[uid] = {
        ...userTracks[uid],
        audioTrack: config.localAudioTrack,
      };
    } else {
      // If the audio was previously muted, keep the audio track muted
      await config.localAudioTrack.setEnabled(false);
      console.log("New audio track created but kept muted and unpublished.");
    }

    console.log(`Switched to new microphone: ${newMicDeviceId}`);
  } catch (error) {
    console.error("Error switching microphone:", error);
  }
};

export const switchSpeaker = async (config, newSpeakerDeviceId) => {
  try {
    console.log(
      `Switching to new speaker with deviceId: ${newSpeakerDeviceId}`
    );

    // Find all audio elements managing playback
    const audioElements = document.querySelectorAll("audio");

    audioElements.forEach((audioElement) => {
      if (typeof audioElement.setSinkId !== "undefined") {
        audioElement
          .setSinkId(newSpeakerDeviceId)
          .then(() => {
            console.log(
              `Speaker output changed to deviceId: ${newSpeakerDeviceId}`
            );
            config.selectedSpeaker = newSpeakerDeviceId; // Update selected speaker in config

            // Send the updated speaker to Bubble
            if (typeof bubble_fn_selectedSpeaker === "function") {
              bubble_fn_selectedSpeaker({
                output1: newSpeakerDeviceId,
                output2: audioElement.label || "No label",
              });
            }
          })
          .catch((error) =>
            console.error("Error setting speaker output:", error)
          );
      } else {
        console.warn(
          "This browser does not support setting sinkId for audio output."
        );
      }
    });
  } catch (error) {
    console.error("Error switching speaker:", error);
  }
};
