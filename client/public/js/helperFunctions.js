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

// Helper function to trim and normalize labels
export const switchCamera = async (config, userTracks, newCameraDeviceId) => {
  try {
    console.log(`Switching to new camera with deviceId: ${newCameraDeviceId}`);

    const { client, uid } = config;

    const wasPublishing =
      config.localVideoTrack && !config.localVideoTrack.muted;

    if (config.localVideoTrack) {
      if (wasPublishing) {
        await client.unpublish(config.localVideoTrack);
        console.log("Previous video track unpublished.");
      }
      config.localVideoTrack.stop();
      config.localVideoTrack.close();
      console.log("Previous video track stopped and closed.");
    }

    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      cameraId: newCameraDeviceId,
    });
    config.selectedCam = newCameraDeviceId;

    // Send the updated camera to Bubble with full label
    if (typeof bubble_fn_selectedCam === "function") {
      bubble_fn_selectedCam({
        output1: newCameraDeviceId,
        output2: config.localVideoTrack.getTrackLabel() || "No label",
      });
    }

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

    if (wasPublishing) {
      await client.publish(config.localVideoTrack);
      console.log("New video track published successfully.");

      userTracks[uid] = {
        ...userTracks[uid],
        videoTrack: config.localVideoTrack,
        isVideoMuted: false,
      };

      const videoPlayer = document.querySelector(`#stream-${uid}`);
      if (videoPlayer) {
        config.localVideoTrack.play(videoPlayer);
        console.log("Video player updated with new camera feed.");
      }
    } else {
      userTracks[uid] = {
        ...userTracks[uid],
        videoTrack: null,
        isVideoMuted: true,
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

    const { client } = config;

    const wasPublishing =
      config.localAudioTrack && !config.localAudioTrack.muted;

    if (config.localAudioTrack) {
      if (wasPublishing) {
        await client.unpublish(config.localAudioTrack);
        console.log("Previous audio track unpublished.");
      }
      config.localAudioTrack.stop();
      config.localAudioTrack.close();
      console.log("Previous audio track stopped and closed.");
    }

    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: newMicDeviceId,
    });
    config.selectedMic = newMicDeviceId;

    // Send the updated microphone to Bubble with full label
    if (typeof bubble_fn_selectedMic === "function") {
      bubble_fn_selectedMic({
        output1: newMicDeviceId,
        output2: config.localAudioTrack.getTrackLabel() || "No label",
      });
    }

    if (wasPublishing) {
      await client.publish(config.localAudioTrack);
      console.log("New audio track published successfully.");
    } else {
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

    const audioElements = document.querySelectorAll("audio");

    // Log the audio elements to check if they are found
    console.log("Found audio elements:", audioElements);

    // If no audio elements are found, log a warning
    if (audioElements.length === 0) {
      console.warn("No audio elements found to change the speaker.");
    }

    audioElements.forEach((audioElement) => {
      console.log("Checking audio element:", audioElement);

      // Check if the element supports setSinkId
      if (typeof audioElement.setSinkId !== "undefined") {
        console.log("setSinkId is supported on this audio element");

        audioElement
          .setSinkId(newSpeakerDeviceId)
          .then(() => {
            console.log(
              `Speaker output changed to deviceId: ${newSpeakerDeviceId}`
            );
            config.selectedSpeaker = newSpeakerDeviceId;

            // Send the updated speaker to Bubble with full label
            if (typeof bubble_fn_selectedSpeaker === "function") {
              console.log(
                "Sending selected speaker to Bubble:",
                newSpeakerDeviceId,
                audioElement.label
              );
              bubble_fn_selectedSpeaker({
                output1: newSpeakerDeviceId,
                output2: audioElement.label || "No label",
              });
            }
          })
          .catch((error) => {
            console.error("Error setting speaker output:", error);
          });
      } else {
        console.warn("This audio element does not support setSinkId.");
      }
    });
  } catch (error) {
    console.error("Error switching speaker:", error);
  }
};

