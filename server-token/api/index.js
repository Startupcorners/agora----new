const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const APP_ID = process.env.APP_ID;
const CUSTOMER_ID = process.env.CUSTOMER_ID;
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Middleware to prevent caching
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

// Acquire resource from Agora Cloud Recording API
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  // Agora Cloud Recording acquire URL
  const url = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`;

  try {
    const response = await axios.post(
      url,
      {
        cname: channelName,
        clientRequest: {},
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${CUSTOMER_ID}:${CUSTOMER_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );

    const resourceId = response.data.resourceId;
    console.log("Resource acquired with resourceId:", resourceId);
    res.json({ resourceId });
  } catch (error) {
    console.error(
      "Error acquiring resource:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to acquire resource" });
  }
});

// Handle the start recording request
app.post("/start", async (req, res) => {
  const { channelName, resourceId, uid, token } = req.body;

  if (!channelName || !resourceId || !uid || !token) {
    return res.status(400).json({
      error: "channelName, resourceId, uid, and token are required",
    });
  }

  try {
    // Add the actual authorization header using Customer ID and Secret
    const authorizationToken = Buffer.from(
      `${CUSTOMER_ID}:${CUSTOMER_SECRET}`
    ).toString("base64");

    // Prepare the payload for starting recording
    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        token: token,
        recordingConfig: {
          maxIdleTime: 30,
          streamTypes: 2,
          channelType: 0,
          videoStreamType: 0,
          transcodingConfig: {
            width: 1280,
            height: 720,
            bitrate: 1000,
            fps: 30,
            mixedVideoLayout: 1,
          },
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"],
        },
        storageConfig: {
          vendor: 2, // AWS S3
          region: 0, // Region (0 is for US East)
          bucket: process.env.S3_BUCKET_NAME, // Your S3 bucket name
          accessKey: process.env.S3_ACCESS_KEY, // Your AWS access key
          secretKey: process.env.S3_SECRET_KEY, // Your AWS secret key
        },
      },
    };

    console.log("Payload being sent to Agora for start recording:", payload);

    // Make the Agora cloud recording start API request
    const startRecordingResponse = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract the sid from Agora's response
    const { sid } = startRecordingResponse.data;
    console.log("Recording started with sid:", sid);

    // Send back the resourceId and sid
    res.json({ resourceId, sid });
  } catch (error) {
    console.error(
      "Error starting recording:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to start recording" });
  }
});

// Handle the stop recording request
app.post("/stop", (req, res) => {
  const { channelName, resourceId, sid } = req.body;

  if (!channelName || !resourceId || !sid) {
    return res.status(400).json({
      error: "channelName, resourceId, and sid are required",
    });
  }

  // Stop recording logic
  res.json({ message: "Recording stopped", resourceId, sid });
});

// Root endpoint to check server status
app.get("/", (req, res) => {
  const now = new Date();
  const formattedDate = now.toISOString().replace(/T/, " ").replace(/\..+/, "");

  return res.json({
    status: "up",
    time: formattedDate,
  });
});

// Token generation endpoint
app.get("/access_token", nocache, (req, res) => {
  const channelName = req.query.channelName;
  const uid = req.query.uid || 0;
  const role =
    req.query.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireTime = parseInt(req.query.expireTime || "3600", 10);
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpireTime
  );

  res.json({ token });
});

// Export the app as a module
module.exports = app;
