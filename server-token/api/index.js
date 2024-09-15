// server-token/api/index.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
require("dotenv").config();
console.log("Customer ID:", process.env.CUSTOMER_ID || "Not Found");
console.log("Customer Secret:", process.env.CUSTOMER_SECRET || "Not Found");


const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const app = express();

// CORS configuration to allow your Bubble app's domain
const corsOptions = {
  origin: "https://sccopy-38403.bubbleapps.io", // Replace with your Bubble app's domain
  methods: "GET,POST,OPTIONS",
  allowedHeaders: "Content-Type,Authorization", // Do NOT include 'Access-Control-Allow-Origin' here
  optionsSuccessStatus: 200,
};


app.use(cors(corsOptions));
app.use(express.json()); // To parse JSON request bodies

// Handle preflight requests
app.options("*", cors(corsOptions));

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
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  // Log payload to verify what's being received
  console.log(
    "Received acquire request with channelName and uid:",
    channelName,
    uid
  );

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Log the payload before making the request to Agora
    console.log("Payload being sent to Agora for acquire:", {
      cname: channelName,
      uid: uid,
    });

    const acquireResponse = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`,
      {
        cname: channelName,
        uid: "0", // UID for the recording service, typically "0" for cloud recording
        clientRequest: {}, // Required by Agora API, even if empty
      },
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log Agora's response
    console.log("Agora acquire response:", acquireResponse.data);

    const resourceId = acquireResponse.data.resourceId;
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
  const { channelName, resourceId, uid } = req.body;

  if (!channelName || !resourceId || !uid) {
    return res.status(400).json({
      error: "channelName, resourceId, and uid are required",
    });
  }

  try {
    // Add the actual authorization header using Customer ID and Secret
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Make the Agora cloud recording start API request
    const startRecordingResponse = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      {
        cname: channelName,
        uid: uid,
        clientRequest: {
          token: req.body.token, // Include the correct token
          recordingConfig: {
            channelType: 0,
          },
          storageConfig: {
            vendor: 0, // AWS S3
            region: process.env.S3_REGION, // AWS region
            bucket: process.env.S3_BUCKET_NAME, // S3 bucket name
            accessKey: process.env.S3_ACCESS_KEY, // AWS access key
            secretKey: process.env.S3_SECRET_KEY, // AWS secret key
          },
        },
      },
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
app.get("/access_token", nocache, generateAccessToken);

// Export the app as a module
module.exports = app;
