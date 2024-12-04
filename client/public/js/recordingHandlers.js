import { fetchTokens } from "./fetchTokens.js";

let audioRecordId,
  audioResourceId,
  audioTimestamp,
  audioSid,
  audioRecordingRTMClient,
  audioRecordingChannelRTM;
let recordId, resourceId, timestamp, sid;

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


export const acquireResource = async (config, scene, recordId) => {
  // Ensure scene is provided and valid
  const validScenes = ["composite", "web"];
  if (!scene || !validScenes.includes(scene)) {
    throw new Error(
      `Invalid scene. Please specify one of the following: ${validScenes.join(
        ", "
      )}`
    );
  }

  // Determine recordId based on scene
  if (scene === "web") {
    if (!recordId) {
      throw new Error("recordId is not set for web recording.");
    }
  } else if (scene === "composite") {
    if (!recordId) {
      throw new Error("recordId is not set for composite recording.");
    }
  } else {
    throw new Error(`Invalid scene: ${scene}`);
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

    const response = await fetch(`${config.serverUrl}/acquire`, {
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
// External variables


export const startCloudRecording = debounce(async (url, config) => {
  // Assign new recordId to external variable
  recordId = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Acquire resource and assign to external variable
    resourceId = await acquireResource(config, "web", recordId);
    console.log("Resource acquired:", resourceId);

    // Assign timestamp to external variable
    timestamp = Date.now().toString();

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${recordId}`,
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
        resourceId,
        channelName: config.channelName,
        uid: recordId,
        token: recordingToken,
        timestamp,
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

      // Assign SID to external variable
      sid = startData.sid;
    } else {
      console.log("SID not received in the response");
    }

    bubble_fn_isVideoRecording("yes");

    if (typeof bubble_fn_record === "function") {
      bubble_fn_videoRecord({
        output1: resourceId,  // Use the external resourceId
        output2: sid,         // Use the external sid
        output3: recordId,    // Use the external recordId
        output4: timestamp,   // Use the external timestamp
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
        resourceId, // Use the external variable
        sid, // Use the external variable
        channelName: config.channelName, // Assuming channelName is globally available or imported
        uid: recordId, // Use the external variable
        timestamp, // Use the external variable
      }),
    });

    const stopData = await response.json();

    if (response.ok) {
      console.log("Recording stopped successfully:", JSON.stringify(stopData));
      bubble_fn_isVideoRecording("no");

      // Optionally reset the external variables
      resourceId = null; // Reset resourceId
      sid = null;        // Reset sid
      recordId = null;   // Reset recordId
      timestamp = null;  // Reset timestamp

      // MP4 file handling and other tasks are now done in the backend
    } else {
      console.log("Error stopping recording:", stopData.error);
    }
  } catch (error) {
    console.log("Error stopping recording:", error.message);
  }
}, 3000); // 3-second debounce



// Debounced Start Audio Recording


export const startAudioRecording = debounce(async (config) => {
  // Assign new audioRecordId to external variable
  audioRecordId = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Acquire resource and assign to external variable
    audioResourceId = await acquireResource(config, "composite", audioResourceId );
    console.log("Resource acquired:", audioResourceId);

    // Assign timestamp to external variable
    audioTimestamp = Date.now().toString();

    // Wait for 2 seconds after acquiring the resource
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${audioRecordId}`,
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
        resourceId: audioResourceId, // Use the external variable
        channelName: config.channelName,
        uid: audioRecordId, // Use the external variable
        token: recordingToken,
        timestamp: audioTimestamp, // Use the external variable
      }),
    });

    const startData = await response.json();
    console.log("Response from start audio recording:", JSON.stringify(startData));

    if (!response.ok) {
      console.log("Error starting audio recording:", startData.error);
      throw new Error(`Failed to start audio recording: ${startData.error}`);
    }

    if (startData.sid) {
      console.log("SID received successfully:", startData.sid);
      audioSid = startData.sid; // Assign SID to external variable
    } else {
      console.log("SID not received in the response");
    }

    // Create and initialize the audio recording RTM client
    audioRecordingRTMClient = AgoraRTM.createInstance(config.appId, {
      enableLogUpload: false,
      logFilter: config.debugEnabled
        ? AgoraRTM.LOG_FILTER_INFO
        : AgoraRTM.LOG_FILTER_OFF,
    });

    const audioRtmUid = "3";
    const tokens = await fetchTokens(config, audioRtmUid);
    if (!tokens) throw new Error("Failed to fetch token");

    const audioRtmToken = tokens.rtmToken;

    await audioRecordingRTMClient.login({
      uid: audioRtmUid,
      token: audioRtmToken,
    });
    console.log("Audio recording RTM client logged in with UID:", audioRtmUid);

    audioRecordingChannelRTM = audioRecordingRTMClient.createChannel(
      config.channelName
    );
    await audioRecordingChannelRTM.join();
    console.log("Audio recording RTM client joined channel:", config.channelName);

    bubble_fn_isAudioRecording("yes");

    // Run the bubble function with the necessary parameters
    if (typeof bubble_fn_audioRecord === "function") {
      console.log("Running bubble_fn_audioRecord");
      bubble_fn_audioRecord({
        output1: audioResourceId, // Use the external variable
        output2: audioSid,        // Use the external variable
        output3: audioRecordId,   // Use the external variable
        output4: audioTimestamp,  // Use the external variable
      });
    }

    return startData;
  } catch (error) {
    console.log("Error starting audio recording:", error.message);
    throw error;
  }
}, 3000); // 3-second debounce


export const stopAudioRecording = debounce(async (config) => {
  const requestId = Math.random().toString(36).substring(2); // Unique ID for this attempt
  console.log(`stopAudioRecording attempt started. Request ID: ${requestId}`);

  try {
    console.log("Request payload:", {
      resourceId: audioResourceId, // Use external variable
      channelName: config.channelName, // From config
      sid: audioSid, // Use external variable
      uid: audioRecordId, // Use external variable
      timestamp: audioTimestamp, // Use external variable
    });

    const response = await fetch(`${config.serverUrl}/stopAudioRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: audioResourceId,
        channelName: config.channelName,
        sid: audioSid,
        uid: audioRecordId,
        timestamp: audioTimestamp,
      }),
    });

    const stopData = await response.json();

    if (response.ok) {
      console.log(
        `Audio recording stopped successfully. Request ID: ${requestId}`,
        JSON.stringify(stopData)
      );
      if (typeof bubble_fn_isAudioRecording === "function") {
        bubble_fn_isAudioRecording("no");
      }
    } else {
      console.error(
        `Error stopping audio recording (Request ID: ${requestId}):`,
        stopData
      );
    }
  } catch (error) {
    console.error(
      `Unexpected error in stopAudioRecording (Request ID: ${requestId}):`,
      error.message
    );
  } finally {
    console.log(
      `Finalizing stopAudioRecording for Request ID: ${requestId}. Cleaning up RTM clients.`
    );

    // Cleanup audio recording RTM channel
    if (audioRecordingChannelRTM) {
      try {
        await audioRecordingChannelRTM.leave();
        console.log("Audio recording RTM client left the channel");
        audioRecordingChannelRTM = null; // Clear the RTM channel
      } catch (error) {
        console.error(
          "Failed to leave RTM channel for audio recording client:",
          error
        );
      }
    } else {
      console.log("No RTM channel to leave.");
    }

    // Cleanup audio recording RTM client
    if (audioRecordingRTMClient) {
      try {
        await audioRecordingRTMClient.logout();
        console.log("Audio recording RTM client logged out");
        audioRecordingRTMClient = null; // Clear the RTM client
      } catch (error) {
        console.error("Failed to logout audio recording RTM client:", error);
      }
    } else {
      console.log("No RTM client to logout.");
    }

    // Reset external variables
    audioSid = null;
    audioRecordId = null;
    audioResourceId = null;
    audioTimestamp = null;

    console.log(
      `stopAudioRecording cleanup completed for Request ID: ${requestId}`
    );
  }
}, 3000); // 3-second debounce
