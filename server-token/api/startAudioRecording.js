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
  console.log("Incoming Request Body:", req.body); // Add this log
  const { channelName, resourceId, uid, token, timestamp } = req.body;

  const requiredParams = {
    channelName,
    resourceId,
    uid,
    token,
    timestamp,
  };

  console.log("I'm here", requiredParams);

  console.log(
    "Start recording request received with parameters:",
    requiredParams
  );

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
      uid: uid, // The UID used to identify the recorder in the channel
      cname: channelName, // The channel name
      clientRequest: {
        token: token, // Token if required; otherwise, null
        recordingConfig: {
          maxIdleTime: 120, // Optional: Stop recording if no active audio/video streams after 30 seconds
          streamTypes: 1, // 1 for audio only, 2 for both audio and video
          channelType: 0, // 0 for communication, 1 for live broadcasting
          videoStreamType: 0, // Use 0 for high-quality video (not relevant for audio-only)
          subscribeAudioUids: [], // Optional: List of UIDs to record audio from (leave empty for all audio)
        },
        storageConfig: {
          accessKey: process.env.S3_ACCESS_KEY,
          region: 3, // Region 3 for AWS S3 (check Agora docs for other vendors)
          bucket: process.env.S3_BUCKET_NAME,
          secretKey: process.env.S3_SECRET_KEY,
          vendor: 1, // 1 for AWS S3
          fileNamePrefix: ["recordings", channelName], // Folder structure in the S3 bucket
        },
      },
    };

    console.log("Payload for Agora API:", JSON.stringify(payload, null, 2));

    // Call Agora's Cloud Recording API to start recording
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
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
          "https://startupcorners.com/version-test/api/1.1/wf/scheduleaudioend",
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
    console.error("Errorrrr starting recording:", error.message);
    res.status(500).json({
      error: "Failed to starttttt recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
