// helperFunctions.js

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

export const fetchTokens = async (config) => {
  try {
    const res = await fetch(
      `${config.serverUrl}/generateTokens?channelName=${config.channelName}&uid=${config.uid}&role=${config.user.role}`,
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

export const switchCamera = async (config, client, deviceId) => {
  if (config.localVideoTrack) {
    config.localVideoTrack.stop();
    config.localVideoTrack.close();
    await client.unpublish([config.localVideoTrack]);

    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      cameraId: deviceId,
    });
    await client.publish([config.localVideoTrack]);
    config.localVideoTrack.play(`stream-${config.uid}`);
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

export const getProcessorInstance = async (config) => {
  if (!config.processor && config.localVideoTrack) {
    config.processor = config.extensionVirtualBackground.createProcessor();

    try {
      await config.processor.init();
    } catch (e) {
      console.error("Fail to load WASM resource!");
      return null;
    }
    config.localVideoTrack
      .pipe(config.processor)
      .pipe(config.localVideoTrack.processorDestination);
  }
  return config.processor;
};

export const imageUrlToBase64 = async (url) => {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
    reader.onerror = reject;
  });
};
