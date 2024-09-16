// server-token/api/index.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { RtcTokenBuilder2, Role } = require("agora-access-token"); // Using RtcTokenBuilder2 for 007 token
require("dotenv").config();

// Log important environment variables
console.log("APP_ID:", process.env.APP_ID || "Not Defined");
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE || "Not Defined");
console.log("Customer ID:", process.env.CUSTOMER_ID || "Not Defined");
console.log("Customer Secret:", process.env.CUSTOMER_SECRET || "Not Defined");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");
console.log("S3_ACCESS_KEY:", process.env.S3_ACCESS_KEY || "Not Defined");
console.log("S3_SECRET_KEY:", process.env.S3_SECRET_KEY || "Not Defined");
console.log("S3_REGION:", process.env.S3_REGION || "Not Defined");

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const app = express();

app.use(cors());
app.use(express.json());

// Handle preflight requests
app.options("*", cors());

const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

// Token generation using RtcTokenBuilder2 (007 token)
app.get("/access_token", nocache, (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  const channelName = req.query.channelName;
  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  // For recording, always use UID "0"
  const uid = 0;
  const role = Role.PUBLISHER; // Use PUBLISHER role for recording
  const tokenExpirationInSeconds = parseInt(req.query.expireTime, 10) || 3600;
  const privilegeExpirationInSeconds = tokenExpirationInSeconds; // Use the same expiration for privileges

  try {
    // Generate 007 token with UID
    const token = RtcTokenBuilder2.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      tokenExpirationInSeconds,
      privilegeExpirationInSeconds
    );

    console.log("Generated 007 Token:", token); // Log the new token for debugging
    return res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error.message);
    return res.status(500).json({ error: "Failed to generate token" });
  }
});

// Acquire resource
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  console.log("Acquire request for channel:", channelName, "UID:", uid);

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: "0", // For recording, always use UID "0"
      clientRequest: {},
    };

    console.log("Payload sent to Agora for acquire:", payload);

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Acquire response:", response.data);
    const resourceId = response.data.resourceId;
    res.json({ resourceId });
  } catch (error) {
    console.error(
      "Error acquiring resource:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to acquire resource" });
  }
});

// Start recording
app.post("/start", async (req, res) => {
  const { channelName, resourceId, token } = req.body;

  // Set uid to "0" for Agora recording
  let uid = "0";

  if (!channelName || !resourceId || !token) {
    return res.status(400).json({
      error: "channelName, resourceId, and token are required",
    });
  }

  console.log("Start recording request for:", {
    channelName,
    resourceId,
    uid,
    token,
  });

  // Convert environment variables to numbers
  const vendor = parseInt(process.env.S3_VENDOR, 10) || 2;
  const region = parseInt(process.env.S3_REGION, 10) || 0;

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid, // Always "0" for Agora recording
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
          vendor: vendor,
          region: region,
          bucket: process.env.S3_BUCKET_NAME,
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY,
        },
      },
    };

    console.log(
      "Payload sent to Agora for start recording:",
      JSON.stringify(payload, null, 2)
    );

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Start recording response:", response.data);
    const { sid } = response.data;
    res.json({ resourceId, sid });
  } catch (error) {
    console.error(
      "Error starting recording:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to start recording" });
  }
});

// Stop recording endpoint
app.post("/stop", (req, res) => {
  const { channelName, resourceId, sid } = req.body;

  if (!channelName || !resourceId || !sid) {
    return res.status(400).json({
      error: "channelName, resourceId, and sid are required",
    });
  }

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

module.exports = app;
