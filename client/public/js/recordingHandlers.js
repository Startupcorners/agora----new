import { fetchTokens } from "./fetchTokens.js";
import audioRecordingManager from "./audioRecordingManager.js";

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

    console.log("Running videoRecord");

    bubble_fn_videoRecord({
        output1: resourceId,  // Use the external resourceId
        output2: sid,         // Use the external sid
        output3: recordId,    // Use the external recordId
        output4: timestamp,   // Use the external timestamp
      });

      console.log("Ran videoRecord");

    return startData;
  } catch (error) {
    console.log("Error starting recording:", error.message);
    throw error;
  }
}, 3000); // 3-second debounce

// Debounced Stop Cloud Recording


export const stopCloudRecording = debounce(
  async (config, resourceId, sid, recordId, timestamp) => {
    console.log(resourceId, sid, recordId, timestamp);
    try {
      const response = await fetch(`${config.serverUrl}/stopCloudRecording`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceId: resourceId, // Use the external variable
          sid: sid, // Use the external variable
          channelName: config.channelName, // Assuming channelName is globally available or imported
          uid: recordId, // Use the external variable
          timestamp: timestamp, // Use the external variable
        }),
      });

      const stopData = await response.json();

      if (response.ok) {
        console.log(
          "Recording stopped successfully:",
          JSON.stringify(stopData)
        );
        bubble_fn_isVideoRecording("no");

        // Optionally reset the external variables
        resourceId = null; // Reset resourceId
        sid = null; // Reset sid
        recordId = null; // Reset recordId
        timestamp = null; // Reset timestamp

        // MP4 file handling and other tasks are now done in the backend
      } else {
        console.log("Error stopping recording:", stopData.error);
      }
    } catch (error) {
      console.log("Error stopping recording:", error.message);
    }
  },
  3000
); // 3-second debounce




// Updated startAudioRecording function
export const startAudioRecording = debounce(async (config) => {
  // Assign new audioRecordId
  audioRecordingManager.recordId = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Acquire resource
    audioRecordingManager.resourceId = await acquireResource(config, "composite", audioRecordingManager.recordId);
    console.log("Resource acquired:", audioRecordingManager.resourceId);

    // Assign timestamp
    audioRecordingManager.timestamp = Date.now().toString();

    // Wait for 2 seconds after acquiring the resource
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${audioRecordingManager.recordId}`,
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
        resourceId: audioRecordingManager.resourceId,
        channelName: config.channelName,
        uid: audioRecordingManager.recordId,
        token: recordingToken,
        timestamp: audioRecordingManager.timestamp,
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
      audioRecordingManager.sid = startData.sid;
    } else {
      console.log("SID not received in the response");
    }

    // Initialize and join RTM
    await audioRecordingManager.initRTM(config, fetchTokens);
    await audioRecordingManager.joinChannel(config);
    audioRecordingManager.isActive = true;

    bubble_fn_isAudioRecording("yes");

    console.log("Running bubble_fn_audioRecord");
    bubble_fn_audioRecord({
      output1: audioRecordingManager.resourceId,
      output2: audioRecordingManager.sid,
      output3: audioRecordingManager.recordId,
      output4: audioRecordingManager.timestamp,
    });

    return startData;
  } catch (error) {
    console.log("Error starting audio recording:", error.message);
    throw error;
  }
}, 3000);

// Updated stopAudioRecording function
export const stopAudioRecording = debounce(async (config) => {
  const requestId = Math.random().toString(36).substring(2); // Unique ID for this attempt
  console.log(`stopAudioRecording attempt started. Request ID: ${requestId}`);

  try {
    // Check if we have active recording data
    if (!audioRecordingManager.resourceId || !audioRecordingManager.sid) {
      console.warn("No active audio recording to stop");
      return;
    }

    console.log("Request payload:", {
      resourceId: audioRecordingManager.resourceId,
      channelName: config.channelName,
      sid: audioRecordingManager.sid,
      uid: audioRecordingManager.recordId,
      timestamp: audioRecordingManager.timestamp,
    });

    const response = await fetch(`${config.serverUrl}/stopAudioRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: audioRecordingManager.resourceId,
        channelName: config.channelName,
        sid: audioRecordingManager.sid,
        uid: audioRecordingManager.recordId,
        timestamp: audioRecordingManager.timestamp,
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

    // Properly clean up using the manager
    await audioRecordingManager.cleanup();

    // Reset manager's state
    audioRecordingManager.isActive = false;
    audioRecordingManager.sid = null;
    audioRecordingManager.recordId = null;
    audioRecordingManager.resourceId = null;
    audioRecordingManager.timestamp = null;

    console.log(
      `stopAudioRecording cleanup completed for Request ID: ${requestId}`
    );
  }
}, 3000);