export const startCloudRecording = async (config) => {
  try {
    // Step 1: Acquire a resource ID for cloud recording
    const resourceId = await acquireResource(config, "cloud");
    console.log("Resource acquired:", resourceId);

    // Setting a timestamp to identify the recording session
    const timestamp = Date.now().toString();
    config.timestamp = timestamp;

    // Storing the acquired resource ID
    config.resourceId = resourceId;

    // Step 2: Create a new screenshare user (UID 2) and join the channel
    await createAndPublishScreenshareUser(config);

    // Step 3: Generate a recording token for the screenshare UID (UID = 2)
    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=2`,
      { method: "GET" }
    );
    const tokenData = await recordingTokenResponse.json();
    const recordingToken = tokenData.token;
    console.log("Recording token received for UID 2:", recordingToken);

    // Step 4: Start cloud recording using the acquired resource and token for UID 2
    const response = await fetch(`${config.serverUrl}/startCloudRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: config.resourceId,
        channelName: config.channelName,
        uid: 2, // Focus on the screenshare user
        token: recordingToken,
        timestamp: config.timestamp,
      }),
    });

    const startData = await response.json();
    console.log("Response from start cloud recording:", startData);

    if (!response.ok) {
      console.error("Error starting cloud recording:", startData.error);
      throw new Error(`Failed to start cloud recording: ${startData.error}`);
    }

    if (startData.sid) {
      console.log("SID received successfully:", startData.sid);
      config.sid = startData.sid;
    } else {
      console.warn(
        "SID not received in the response for cloud recording:",
        startData
      );
    }

    console.log(
      "Cloud recording started successfully. Resource ID:",
      resourceId,
      "SID:",
      config.sid
    );

    // Update the UI and store relevant states
    if (typeof bubble_fn_record === "function") {
      bubble_fn_record({
        output1: resourceId,
        output2: config.sid,
        output3: 2, // Screenshare UID
      });
      console.log("Called bubble_fn_record (cloud) with:", {
        output1: resourceId,
        output2: config.sid,
        output3: 2,
      });
      bubble_fn_isRecording("yes");
    } else {
      console.warn("bubble_fn_record is not defined");
      bubble_fn_isRecording("no");
    }

    return startData;
  } catch (error) {
    console.error("Error starting cloud recording:", error.message);
    throw error;
  }
};

export const stopCloudRecording = async (config) => {
  try {
    // Step 1: Stop the cloud recording on the server side
    const response = await fetch(`${config.serverUrl}/stopCloudRecording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: config.resourceId,
        sid: config.sid,
        channelName: config.channelName,
        uid: 2, // Screenshare UID
        timestamp: config.timestamp,
      }),
    });

    const stopData = await response.json();

    if (response.ok) {
      console.log("Cloud recording stopped successfully:", stopData);
      bubble_fn_isRecording("no");

      // Step 2: Cleanup the screenshare client and resources (UID 2)
      if (config.screenShareClient) {
        console.log(
          "Stopping and cleaning up the screenshare client (UID 2)..."
        );

        // Unpublish the screenshare track(s)
        const localTracks = config.screenShareClient.getLocalTracks();
        localTracks.forEach((track) => {
          track.stop();
          track.close();
        });

        // Leave the screenshare channel
        await config.screenShareClient.leave();
        config.screenShareClient = null;
        console.log(
          "Screenshare client (UID 2) left the channel and cleaned up."
        );
      } else {
        console.log("No screenshare client found to stop.");
      }

      // If needed, handle any returned MP4 URL here (optional)
      // e.g., console.log("MP4 URL from server:", stopData.mp4Url);
    } else {
      console.error("Error stopping cloud recording:", stopData.error);
    }
  } catch (error) {
    console.error("Error stopping cloud recording:", error.message);
  }
};


export const startAudioRecording = async (config) => {
  try {
    const resourceId = await acquireResource(config, "audio");
    console.log("Resource acquired: " + resourceId);

    config.resourceId = resourceId;

    const timestamp = Date.now().toString();
    config.timestamp = timestamp;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=${config.recordId}`,
      {
        method: "GET",
      }
    );

    const tokenData = await recordingTokenResponse.json();
    const recordingToken = tokenData.token;

    console.log("Recording token received: " + recordingToken);

    const response = await fetch(config.serverUrl + "/startAudioRecording", {
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
    console.log("Response from start audio recording: ", startData);

    if (!response.ok) {
      console.error("Error starting audio recording: ", startData.error);
      throw new Error(`Failed to start audio recording: ${startData.error}`);
    }

    if (startData.sid) {
      console.log("SID received successfully: " + startData.sid);
      config.sid = startData.sid;
    } else {
      console.warn(
        "SID not received in the response for audio recording: ",
        startData
      );
    }

    console.log(
      "Audio recording started successfully. Resource ID: " +
        resourceId +
        ", SID: " +
        config.sid
    );

    bubble_fn_isAiNote("yes");

    return startData;
  } catch (error) {
    console.error("Error starting audio recording: " + error.message);
    throw error;
  }
};

export const stopAudioRecording = async (config) => {
  try {
    const response = await fetch(`${config.serverUrl}/stopAudioRecording`, {
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
      console.log("Audio recording stopped successfully: ", stopData);
      bubble_fn_isAiNote("no");
    } else {
      console.error("Error stopping audio recording: ", stopData.error);
    }
  } catch (error) {
    console.error("Error stopping audio recording: " + error.message);
  }
};

const acquireResource = async (config, mode) => {
  config.recordId = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    console.log("Payload for acquire resource: ", {
      channelName: config.channelName,
      uid: config.recordId,
    });

    const response = await fetch(config.serverUrl + "/acquire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName: config.channelName,
        uid: config.recordId,
        mode: mode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error acquiring resource: ", errorData);
      throw new Error(`Failed to acquire resource: ${errorData.error}`);
    }

    const data = await response.json();
    console.log("Resource acquired: " + data.resourceId);
    return data.resourceId;
  } catch (error) {
    console.error("Error acquiring resource: " + error.message);
    throw error;
  }
};

// Helper function to create and publish a screenshare user with UID 2
export const createAndPublishScreenshareUser = async (config) => {
  // Step 1: Create a new Agora RTC client for screenshare
  config.screenShareClient = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8",
  });
  console.log("New screenshare client created.");

  // Step 2: Generate an RTC token for the screenshare UID (UID 2) to join the channel
  console.log("Fetching RTC token for screenshare UID 2...");
  const screenshareTokenResponse = await fetch(
    `${config.serverUrl}/generate_rtc_token?channelName=${config.channelName}&uid=2`,
    { method: "GET" }
  );
  const screenshareTokenData = await screenshareTokenResponse.json();
  const screenshareToken = screenshareTokenData.token;
  console.log("RTC token for screenshare UID 2 received:", screenshareToken);

  // Step 3: Join the channel with the screenshare client
  await config.screenShareClient.join(
    config.appId,
    config.channelName,
    screenshareToken,
    2
  );
  console.log("Screenshare client (UID 2) joined the channel.");

  // Step 4: Create and publish the screenshare track
  const screenTrack = await AgoraRTC.createScreenVideoTrack();
  await config.screenShareClient.publish(screenTrack);
  console.log("Screenshare track published for UID 2.");
};
