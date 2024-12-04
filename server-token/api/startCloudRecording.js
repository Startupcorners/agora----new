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

  const requiredParams = {
    channelName,
    resourceId,
    uid,
    token,
    timestamp,
    serviceUrl,
    serverUrl,
  };

  const missingParams = Object.entries(requiredParams)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingParams.length > 0) {
    console.error("Missing required parameters:", missingParams);
    return res.status(400).json({
      error: `Missing required parameters: ${missingParams.join(", ")}`,
    });
  }

  console.log(
    "Start recording request received with parameters:",
    requiredParams
  );

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
                url: serviceUrl,
                audioProfile: 1,
                videoWidth: 1280,
                videoHeight: 720,
                maxRecordingHour: 1,
              },
            },
          ],
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"],
        },
        storageConfig: {
          vendor: 1,
          region: 0,
          bucket: process.env.S3_BUCKET_NAME,
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY,
          fileNamePrefix: ["recordings", channelName, timestamp],
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

    if (response.data.sid) {
      console.log("Recording successfully started. SID:", response.data.sid);

      const stopPayload = {
        resourceId: resourceId,
        sid: response.data.sid,
        channelName: channelName,
        uid: uid,
        timestamp: timestamp,
      };

      console.log("Data to send to Bubble:", stopPayload);

      try {
        const bubbleResponse = await axios.post(
          "https://startupcorners.com/api/1.1/wf/scheduleend",
          stopPayload
        );

        console.log("Bubble response:", bubbleResponse.data);
      } catch (bubbleError) {
        console.error("Error scheduling stop in Bubble:", bubbleError.message);
      }

      res.json({
        resourceId,
        sid: response.data.sid,
        timestamp,
      });
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
