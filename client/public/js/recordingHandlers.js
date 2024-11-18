import {
  fetchTokens,
} from "./helperFunctions.js";

const debounce = (func, delay) => {
  let inProgress = false;
  return async (...args) => {
    if (inProgress) {
      console.log("Function call ignored due to debounce.");
      return;
    }
    inProgress = true;
    try {
      await func(...args);
    } finally {
      setTimeout(() => {
        inProgress = false;
      }, delay);
    }
  };
};


export const acquireResource = async (config, scene) => {
  // Generate a 6-digit recordId
  const recordId = Math.floor(100000 + Math.random() * 900000).toString();

  // Ensure scene is provided and valid
  const validScenes = ["composite", "web"];
  if (!scene || !validScenes.includes(scene)) {
    throw new Error(
      `Invalid scene. Please specify one of the following: ${validScenes.join(
        ", "
      )}`
    );
  }

  try {
    console.log(
      "Payload for acquire resource:",
      JSON.stringify({
        channelName: config.channelName,
        uid: recordId,
        recordingType: scene,
      })
    );

    const response = await fetch(config.serverUrl + "/acquire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName: config.channelName,
        uid: recordId,
        recordingType: scene, // Pass scene dynamically
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log("Error acquiring resource:", JSON.stringify(errorData));
      throw new Error(`Failed to acquire resource: ${errorData.error}`);
    }

    const data = await response.json();
    console.log("Resource acquired:", data.resourceId);
    return data.resourceId;
  } catch (error) {
    console.log("Error acquiring resource:", error.message);
    throw error;
  }
};


// Debounced Start Cloud Recording
export const startCloudRecording = debounce(async (config, url) => {
  const recordId = Math.floor(100000 + Math.random() * 900000).toString();
  config.recordId = recordId;
  try {
    const resourceId = await acquireResource(config, "web");
    console.log("Resource acquired:", resourceId);

    config.resourceId = resourceId;

    const timestamp = Date.now().toString();
    config.timestamp = timestamp;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${config.recordId}`,
      { method: "GET" }
    );

    const tokenData = await recordingTokenResponse.json();
    const recordingToken = tokenData.token;

    console.log("Recording token received:", recordingToken);

    // Use the `url` argument passed to the function
    const recordingServiceUrl = url;

    const response = await fetch(config.serverUrl + "/startCloudRecording", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: config.resourceId,
        channelName: config.channelName,
        uid: config.recordId,
        token: recordingToken,
        timestamp: config.timestamp,
        serviceUrl: recordingServiceUrl,
        serverUrl: config.serverUrl, // Pass the `url` to the backend
      }),
    });

    const startData = await response.json();
    console.log("Response from start recording:", JSON.stringify(startData));

    if (!response.ok) {
      console.log("Error starting recording:", startData.error);
      throw new Error(`Failed to start recording: ${startData.error}`);
    }

    if (startData.sid) {
      console.log("SID received successfully:", startData.sid);
      config.sid = startData.sid;
    } else {
      console.log("SID not received in the response");
    }
    bubble_fn_isVideoRecording("yes");

    if (typeof bubble_fn_record === "function") {
      bubble_fn_videoRecord({
        output1: resourceId,
        output2: config.sid,
        output3: config.recordId,
        output4: config.timestamp,
      });
    }

    return startData;
  } catch (error) {
    console.log("Error starting recording:", error.message);
    throw error;
  }
}, 3000); // 3-second debounce

// Debounced Stop Cloud Recording
export const stopCloudRecording = debounce(async (config) => {
  try {
    const response = await fetch(`${config.serverUrl}/stopCloudRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: config.resourceId,
        sid: config.sid,
        channelName: config.channelName,
        uid: config.recordId,
        timestamp: config.timestamp,
      }),
    });

    const stopData = await response.json();

    if (response.ok) {
      console.log("Recording stopped successfully:", JSON.stringify(stopData));
      bubble_fn_isVideoRecording("no");
      // MP4 file handling and other tasks are now done in the backend
    } else {
      console.log("Error stopping recording:", stopData.error);    }
  } catch (error) {
    console.log("Error stopping recording:", error.message);
  }
}, 3000); // 3-second debounce

// Debounced Start Audio Recording
export const startAudioRecording = debounce(async (config) => {
 const recordId = Math.floor(100000 + Math.random() * 900000).toString();
 config.audioRecordId = recordId;
 try {
   const resourceId = await acquireResource(config, "composite");
   console.log("Resource acquired:", resourceId);

   config.audioResourceId = resourceId;

   const timestamp = Date.now().toString();
   config.timestamp = timestamp;

   await new Promise((resolve) => setTimeout(resolve, 2000));
   console.log("Waited 2 seconds after acquiring resource");

   const recordingTokenResponse = await fetch(
     `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${config.audioRecordId}`,
     { method: "GET" }
   );

   const tokenData = await recordingTokenResponse.json();
   const recordingToken = tokenData.token;

   console.log("Recording token received:", recordingToken);

   const response = await fetch(config.serverUrl + "/startAudioRecording", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       resourceId: config.audioResourceId,
       channelName: config.channelName,
       uid: config.audioRecordId,
       token: recordingToken,
       timestamp: config.audioTimestamp,
     }),
   });

   const startData = await response.json();
   console.log(
     "Response from start audio recording:",
     JSON.stringify(startData)
   );

   if (!response.ok) {
     console.log("Error starting audio recording:", startData.error);
     throw new Error(`Failed to start audio recording: ${startData.error}`);
   }

   if (startData.sid) {
     console.log("SID received successfully:", startData.sid);
     config.audioSid = startData.sid;
   } else {
     console.log("SID not received in the response");
   }

   config.audioRecordingRTMClient = AgoraRTM.createInstance(config.appId, {
     enableLogUpload: false,
     logFilter: config.debugEnabled
       ? AgoraRTM.LOG_FILTER_INFO
       : AgoraRTM.LOG_FILTER_OFF,
   });

   const audioRtmUid = "3";
   const tokens = await fetchTokens(config, audioRtmUid);
   if (!tokens) throw new Error("Failed to fetch token");

   // Ensure the user has a role assigned
   if (!config.user.role) {
     throw new Error("User does not have a role assigned.");
   }

   const audioRtmToken = tokens.rtmToken;

   await config.audioRecordingRTMClient.login({
     uid: audioRtmUid,
     token: audioRtmToken,
   });
   console.log("Audio recording RTM client logged in with UID:", audioRtmUid);

   config.audioRecordingChannelRTM =
     config.audioRecordingRTMClient.createChannel(config.channelName);
   await config.audioRecordingChannelRTM.join();
   console.log(
     "Audio recording RTM client joined channel:",
     config.channelName
   );
   bubble_fn_isAudioRecording("yes");

   if (typeof bubble_fn_audiorecord === "function") {
     bubble_fn_audiorecord({
       output1: resourceId,
       output2: config.audioSid,
       output3: config.audioRecordId,
       output4: config.timestamp,
     });
   }

   return startData;
 } catch (error) {
   console.log("Error starting audio recording:", error.message);
   throw error;
 }
}, 3000); // 3-second debounce

// Debounced Stop Audio Recording
export const stopAudioRecording = debounce(async (config) => {
  try {
    const response = await fetch(`${config.serverUrl}/stopAudioRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: config.audioResourceId,
        sid: config.audioSid,
        channelName: config.channelName,
        uid: config.audioRecordId,
        timestamp: config.audioTimestamp,
      }),
    });

    const stopData = await response.json();

    if (response.ok) {
      console.log(
        "Audio recording stopped successfully:",
        JSON.stringify(stopData)
      );
      bubble_fn_isAudioRecording("no");
      if (typeof bubble_fn_isAudioRecording === "function") {
        bubble_fn_isAudioRecording("no");
      }
    } else {
      console.log("Error stopping audio recording:", stopData.error);
    }
  } catch (error) {
    console.log("Error stopping audio recording:", error.message);
  } finally {
    if (config.audioRecordingChannelRTM) {
      try {
        await config.audioRecordingChannelRTM.leave();
        console.log("Audio recording RTM client left the channel");
        config.audioRecordingChannelRTM = null;
      } catch (error) {
        console.error(
          "Failed to leave RTM channel for audio recording client:",
          error
        );
      }
    }

    if (config.audioRecordingRTMClient) {
      try {
        await config.audioRecordingRTMClient.logout();
        console.log("Audio recording RTM client logged out");
        config.audioRecordingRTMClient = null;
      } catch (error) {
        console.error("Failed to logout audio recording RTM client:", error);
      }
    }
  }
}, 3000); // 3-second debounce
