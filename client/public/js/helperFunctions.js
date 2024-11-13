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

export const switchMicrophone = async (config, client, deviceId) => {
  if (config.localAudioTrack) {
    config.localAudioTrack.stop();
    config.localAudioTrack.close();
    await client.unpublish([config.localAudioTrack]);

    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: deviceId,
    });
    await client.publish([config.localAudioTrack]);
  }
};
