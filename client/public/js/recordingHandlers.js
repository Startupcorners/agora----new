// recordingHandlers.js

// Import the helper functions you need
import { log } from "./helperFunctions.js";

export const acquireResource = async (config) => {
  config.recordId = Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit recordId
  try {
    log(
      config,
      "Payload for acquire resource:" +
        JSON.stringify({
          channelName: config.channelName,
          uid: config.recordId,
        })
    );

    const response = await fetch(config.serverUrl + "/acquire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName: config.channelName,
        uid: config.recordId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      log(config, "Error acquiring resource:" + JSON.stringify(errorData));
      throw new Error(`Failed to acquire resource: ${errorData.error}`);
    }

    const data = await response.json();
    log(config, "Resource acquired: " + data.resourceId);
    return data.resourceId;
  } catch (error) {
    log(config, "Error acquiring resource:" + error.message);
    throw error;
  }
};

export const startRecording = async (config) => {
  try {
    const resourceId = await acquireResource(config);
    log(config, "Resource acquired: " + resourceId);

    config.resourceId = resourceId;

    const timestamp = Date.now().toString(); // Generate timestamp in the frontend
    config.timestamp = timestamp; // Save the timestamp in config for later use

    await new Promise((resolve) => setTimeout(resolve, 2000));
    log(config, "Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${config.recordId}`,
      {
        method: "GET",
      }
    );

    const tokenData = await recordingTokenResponse.json();
    const recordingToken = tokenData.token;

    log(config, "Recording token received: " + recordingToken);

    // Log the parameters before sending the request to ensure they're correct
    log(
      config,
      "Sending the following data to the backend:" +
        JSON.stringify({
          resourceId: config.resourceId,
          channelName: config.channelName,
          uid: config.recordId,
          token: recordingToken,
          timestamp: config.timestamp,
        })
    );

    const response = await fetch(config.serverUrl + "/start", {
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
      }),
    });

    const startData = await response.json();
    log(config, "Response from start recording: " + JSON.stringify(startData));

    if (!response.ok) {
      log(config, "Error starting recording: " + startData.error);
      throw new Error(`Failed to start recording: ${startData.error}`);
    }

    if (startData.sid) {
      log(config, "SID received successfully: " + startData.sid);
      config.sid = startData.sid;
    } else {
      log(
        config,
        "SID not received in the response: " + JSON.stringify(startData)
      );
    }

    log(
      config,
      "Recording started successfully. Resource ID: " +
        resourceId +
        ", SID: " +
        config.sid
    );

    if (typeof bubble_fn_record === "function") {
      bubble_fn_record({
        output1: resourceId,
        output2: config.sid,
        output3: config.recordId,
        output4: config.timestamp,
      });
      log(
        config,
        "Called bubble_fn_record with: " +
          JSON.stringify({
            output1: resourceId,
            output2: config.sid,
            output3: config.recordId,
            output4: config.timestamp,
          })
      );
    } else {
      log(config, "bubble_fn_record is not defined");
    }

    return startData;
  } catch (error) {
    log(config, "Error starting recording: " + error.message);
    throw error;
  }
};

export const stopRecording = async (config) => {
  try {
    // Stop the recording via backend
    const response = await fetch(`${config.serverUrl}/stop`, {
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
      log(
        config,
        "Recording stopped successfully: " + JSON.stringify(stopData)
      );
      // MP4 file handling and other tasks are now done in the backend
    } else {
      log(config, "Error stopping recording: " + stopData.error);
    }
  } catch (error) {
    log(config, "Error stopping recording: " + error.message);
  }
};
