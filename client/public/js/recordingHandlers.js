
export const acquireResource = async (config) => {
  config.recordId = Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit recordId
  try {
    console.log(
      "Payload for acquire resource:",
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

export const startCloudRecording = async (config, url) => {
  try {
    const resourceId = await acquireResource(config);
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

    if (typeof bubble_fn_record === "function") {
      bubble_fn_record({
        output1: resourceId,
        output2: config.sid,
        output3: config.recordId,
        output4: config.timestamp,
      });
    }
    bubble_fn_isRecording("yes")

    return startData;
  } catch (error) {
    console.log("Error starting recording:", error.message);
    bubble_fn_isRecording("no");
    throw error;
  }
};

export const stopCloudRecording = async (config) => {
  try {
    // Stop the recording via backend
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
      bubble_fn_isRecording("no");
      // MP4 file handling and other tasks are now done in the backend
    } else {
      console.log("Error stopping recording:", stopData.error);
      bubble_fn_isRecording("yes");
    }
  } catch (error) {
    console.log("Error stopping recording:", error.message);
    bubble_fn_isRecording("yes");
  }
};









export const acquireAudioResource = async (config) => {
  config.audioRecordId = Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit recordId
  try {
    console.log(
      "Payload for acquire resource:",
      JSON.stringify({
        channelName: config.channelName,
        uid: config.audioRecordId,
      })
    );

    const response = await fetch(config.serverUrl + "/acquire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName: config.channelName,
        uid: config.audioRecordId,
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


export const startAudioRecording = async (config) => {
  try {
    const resourceId = await acquireAudioResource(config);
    console.log("Resource acquired:", resourceId);

    config.audioResourceId = resourceId;

    const timestamp = Date.now().toString();
    config.audioTimestamp = timestamp;

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
        serverUrl: config.serverUrl, // Pass the `url` to the backend
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

    if (typeof bubble_fn_record === "function") {
      bubble_fn_audiorecord({
        output1: resourceId,
        output2: config.audioSid,
        output3: config.audioRecordId,
        output4: config.audioTimestamp,
      });
    }
    bubble_fn_isAudioRecording("yes");

    return startData;
  } catch (error) {
    console.log("Error starting audio recording:", error.message);
    bubble_fn_isAudioRecording("no");
    throw error;
  }
};

export const stopAudioRecording = async (config) => {
  try {
    // Stop the recording via backend
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
      // Audio file handling and other tasks are now done in the backend
    } else {
      console.log("Error stopping audio recording:", stopData.error);
      bubble_fn_isAudioRecording("yes");
    }
  } catch (error) {
    console.log("Error stopping audio recording:", error.message);
    bubble_fn_isAudioRecording("yes");
  }
};