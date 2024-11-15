const express = require("express");
const axios = require("axios");
const router = express.Router();

const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

router.post("/", nocache, async (req, res) => {
  const {
    channelName,
    resourceId,
    uid,
    token,
    timestamp,
    serviceUrl,
    serverUrl,
  } = req.body;

  // Validate required parameters
  if (
    !channelName ||
    !resourceId ||
    !uid ||
    !token ||
    !timestamp ||
    !serviceUrl ||
    !serverUrl
  ) {
    console.error("Missing required parameters:", {
      channelName,
      resourceId,
      uid,
      token,
      timestamp,
      serviceUrl,
      serverUrl,
    });
    return res.status(400).json({
      error:
        "channelName, resourceId, uid, token, timestamp, serviceUrl, and serverUrl are required",
    });
  }

  console.log("Start recording request received with parameters:", {
    channelName,
    resourceId,
    uid,
    token,
    timestamp,
    serviceUrl,
    serverUrl,
  });

  try {
    // Create the authorization token for Agora API
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Payload for Agora Cloud Recording API
    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        token: token,
        extensionServiceConfig: {
          errorHandlePolicy: "error_abort",
          extensionServices: [
            {
              serviceName: "web_recorder_service",
              errorHandlePolicy: "error_abort",
              serviceParam: {
                url: serviceUrl, // Dynamic URL from frontend
                audioProfile: 1,
                videoWidth: 1280,
                videoHeight: 720,
                maxRecordingHour: 0.0333, // You can change this duration or make it dynamic
              },
            },
          ],
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"], // Types of recordings to generate
        },
        storageConfig: {
          vendor: 1, // S3
          region: 0, // Region (0 = Global)
          bucket: process.env.S3_BUCKET_NAME,
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY,
          fileNamePrefix: ["recordings", channelName, timestamp], // Folder structure in S3
        },
      },
    };

    console.log("Payload for Agora API:", JSON.stringify(payload, null, 2));

    // Call Agora's Cloud Recording API to start recording
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/mode/web/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Agora API response:", response.data);

    // Check if SID (Session ID) is in the response
    if (response.data.sid) {
      console.log("Recording successfully started. SID:", response.data.sid);

      // Send success response back to the frontend
      res.json({
        resourceId,
        sid: response.data.sid,
        timestamp,
      });

      // Set a timeout to trigger the stop request after a certain duration
      const MAX_RECORDING_DURATION = 2 * 60 * 1000; // Example: 2 minutes in milliseconds

      setTimeout(async () => {
        console.log(
          `Max recording duration reached for ${channelName}, scheduling stop request...`
        );

        try {
          // Schedule a call to the backend to stop the recording
          const stopPayload = {
            resourceId: resourceId,
            sid: response.data.sid,
            channelName: channelName,
            uid: uid,
            timestamp: timestamp,
          };

          const stopResponse = await axios.post(
            `${serverUrl}/stopCloudRecording`,
            stopPayload
          );

          if (stopResponse.data === "success") {
            console.log("Stop recording request sent successfully");
          } else {
            console.error("Failed to stop recording:", stopResponse.data);
          }
        } catch (error) {
          console.error("Error scheduling stop recording:", error.message);
        }
      }, MAX_RECORDING_DURATION);
    } else {
      console.error("Failed to start recording: No SID in response");
      res.status(500).json({
        error: "Failed to start recording: No SID in response",
      });
    }
  } catch (error) {
    console.error("Error starting recording:", error.message);
    res.status(500).json({
      error: "Failed to start recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
