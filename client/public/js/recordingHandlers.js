import { newMainApp } from "./main.js";
import { fetchTokens } from "./helperFunctions.js";

let app;
document.addEventListener("DOMContentLoaded", () => {
  app = newMainApp();
  console.log("App initialized after DOMContentLoaded:", app);
});

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

const acquireResource = async (config, scene) => {
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
  let recordId;
  if (scene === "web") {
    recordId = config.recordId;
  } else if (scene === "composite") {
    recordId = config.audioRecordId;
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
export const startCloudRecording = debounce(async (url) => {
  const config = app.getConfig();
  const recordId = Math.floor(100000 + Math.random() * 900000).toString();

  // Update recordId
  app.updateConfig({ recordId });

  try {
    const resourceId = await acquireResource(config, "web");
    console.log("Resource acquired:", resourceId);

    // Update resourceId
    app.updateConfig({ resourceId });

    const timestamp = Date.now().toString();

    // Update timestamp
    app.updateConfig({ timestamp });

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
        serverUrl: config.serverUrl,
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

      // Update sid
      app.updateConfig({ sid: startData.sid });
    } else {
      console.log("SID not received in the response");
    }

    bubble_fn_isVideoRecording("yes");

    if (typeof bubble_fn_record === "function") {
      bubble_fn_videoRecord({
        output1: resourceId,
        output2: config.sid,
        output3: recordId,
        output4: timestamp,
      });
    }

    return startData;
  } catch (error) {
    console.log("Error starting recording:", error.message);
    throw error;
  }
}, 3000); // 3-second debounce


// Debounced Stop Cloud Recording
export const stopCloudRecording = debounce(async () => {
  const config = app.getConfig();
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

      // Update recording-related fields in config
      app.updateConfig({
        resourceId: null,
        sid: null,
        recordId: null,
        timestamp: null,
      });
    } else {
      console.log("Error stopping recording:", stopData.error);
    }
  } catch (error) {
    console.log("Error stopping recording:", error.message);
  }
}, 3000); // 3-second debounce


// Debounced Start Audio Recording
export const startAudioRecording = debounce(async () => {
  const config = app.getConfig();
  const audioRecordId = Math.floor(100000 + Math.random() * 900000).toString();

  // Update audioRecordId in config
  app.updateConfig({ audioRecordId });

  try {
    const resourceId = await acquireResource(config, "composite");
    console.log("Resource acquired:", resourceId);

    const audioTimestamp = Date.now().toString();

    // Update resourceId and timestamp in config
    app.updateConfig({
      audioResourceId: resourceId,
      audioTimestamp,
    });

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
        resourceId,
        channelName: config.channelName,
        uid: audioRecordId,
        token: recordingToken,
        timestamp: audioTimestamp,
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

      // Update audioSid in config
      app.updateConfig({ audioSid: startData.sid });
    } else {
      console.log("SID not received in the response");
    }

    // Initialize and configure audio recording RTM client
    const audioRecordingRTMClient = AgoraRTM.createInstance(config.appId, {
      enableLogUpload: false,
      logFilter: config.debugEnabled
        ? AgoraRTM.LOG_FILTER_INFO
        : AgoraRTM.LOG_FILTER_OFF,
    });

    const audioRtmUid = "3";
    const tokens = await fetchTokens(audioRtmUid);
    if (!tokens) throw new Error("Failed to fetch token");

    await audioRecordingRTMClient.login({
      uid: audioRtmUid,
      token: tokens.rtmToken,
    });

    const audioRecordingChannelRTM =
      audioRecordingRTMClient.createChannel(config.channelName);
    await audioRecordingChannelRTM.join();

    // Update RTM client and channel in config
    app.updateConfig({
      audioRecordingRTMClient,
      audioRecordingChannelRTM,
    });

    bubble_fn_isAudioRecording("yes");

    if (typeof bubble_fn_audioRecord === "function") {
      console.log("Running bubble_fn_audioRecord");
      bubble_fn_audioRecord({
        output1: resourceId,
        output2: config.audioSid,
        output3: audioRecordId,
        output4: audioTimestamp,
      });
    }

    return startData;
  } catch (error) {
    console.log("Error starting audio recording:", error.message);
    throw error;
  }
}, 3000); // 3-second debounce


// Debounced Stop Audio Recording
export const stopAudioRecording = debounce(async () => {
  const config = app.getConfig();
  const requestId = Math.random().toString(36).substring(2); // Unique ID for this attempt
  console.log(`stopAudioRecording attempt started. Request ID: ${requestId}`);

  try {
    console.log("Request payload:", {
      resourceId: config.audioResourceId,
      channelName: config.channelName,
      sid: config.audioSid,
      uid: config.audioRecordId,
      timestamp: config.audioTimestamp,
    });

    const response = await fetch(`${config.serverUrl}/stopAudioRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: config.audioResourceId,
        channelName: config.channelName,
        sid: config.audioSid,
        uid: config.audioRecordId,
        timestamp: config.audioTimestamp,
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

    // Leave the RTM channel and nullify it
    if (config.audioRecordingChannelRTM) {
      try {
        await config.audioRecordingChannelRTM.leave();
        console.log("Audio recording RTM client left the channel");
      } catch (error) {
        console.error(
          "Failed to leave RTM channel for audio recording client:",
          error
        );
      } finally {
        app.updateConfig({ audioRecordingChannelRTM: null });
      }
    } else {
      console.log("No RTM channel to leave.");
    }

    // Logout the RTM client and nullify it
    if (config.audioRecordingRTMClient) {
      try {
        await config.audioRecordingRTMClient.logout();
        console.log("Audio recording RTM client logged out");
      } catch (error) {
        console.error("Failed to logout audio recording RTM client:", error);
      } finally {
        app.updateConfig({ audioRecordingRTMClient: null });
      }
    } else {
      console.log("No RTM client to logout.");
    }

    console.log(
      `stopAudioRecording cleanup completed for Request ID: ${requestId}`
    );
  }
}, 3000); // 3-second debounce
