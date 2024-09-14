// server-token/api/index.js

const express = require("express");
const cors = require("cors");
const axios = require("axios"); // To make HTTP requests to Agora's API
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
require("dotenv").config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const REGION = process.env.STORAGE_REGION;
const ACCESS_KEY = process.env.S3_ACCESS_KEY;
const SECRET_KEY = process.env.S3_SECRET_KEY;

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

// Generate Agora RTC token
const generateAccessToken = (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  const channelName = req.query.channelName;
  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  let uid = req.query.uid;
  if (!uid || uid === "") {
    uid = 0;
  }

  let role = RtcRole.SUBSCRIBER;
  if (req.query.role === "publisher") {
    role = RtcRole.PUBLISHER;
  }

  let expireTime = req.query.expireTime;
  if (!expireTime || expireTime === "") {
    expireTime = 3600; // seconds
  } else {
    expireTime = parseInt(expireTime, 10);
  }

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

  return res.json({ token });
};

// Acquire resource for cloud recording
app.post("/acquire", async (req, res) => {
  const { channelName } = req.body;

  try {
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`,
      {
        cname: channelName,
        uid: "1", // Use any UID here for recording
        clientRequest: {},
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${APP_ID}:${APP_CERTIFICATE}`
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start recording
app.post("/start", async (req, res) => {
  const { channelName, resourceId, uid } = req.body;

  try {
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      {
        cname: channelName,
        uid: uid,
        clientRequest: {
          recordingConfig: {
            maxIdleTime: 30,
            streamTypes: 2,
            audioProfile: 1,
            channelType: 1,
            videoStreamType: 0,
            transcodingConfig: {
              height: 640,
              width: 360,
              bitrate: 500,
              fps: 15,
              mixedVideoLayout: 1,
            },
          },
          storageConfig: {
            vendor: 2, // Amazon S3
            region: REGION,
            bucket: S3_BUCKET,
            accessKey: ACCESS_KEY,
            secretKey: SECRET_KEY,
            fileNamePrefix: ["recordings"],
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${APP_ID}:${APP_CERTIFICATE}`
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop recording
app.post("/stop", async (req, res) => {
  const { channelName, resourceId, sid } = req.body;

  try {
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      {
        cname: channelName,
        uid: "1", // The same UID used for starting the recording
        clientRequest: {},
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${APP_ID}:${APP_CERTIFICATE}`
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
app.get("/access_token", nocache, generateAccessToken);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export the app as a module
module.exports = app;
