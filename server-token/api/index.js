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
  allowedHeaders: "Content-Type,Authorization",
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

// Acquire resource endpoint
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  console.log(
    "Received acquire request with channelName and uid:",
    channelName,
    uid
  );

  if (!channelName || !uid) {
    console.error("Missing channelName or uid");
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    console.log("Payload being sent to Agora for acquire:", {
      cname: channelName,
      uid: uid.toString(),
    });

    const acquireResponse = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`,
      {
        cname: channelName,
        uid: "0", // UID for the recording service, typically "0" for cloud recording
        clientRequest: {},
      },
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

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

// Start recording endpoint with additional logs
app.post("/start", async (req, res) => {
  const { channelName, resourceId, uid, token } = req.body;

  // Log the request to start recording
  console.log("Start recording request for:", {
    channelName,
    resourceId,
    uid,
    token,
  });

  if (!channelName || !resourceId || !uid || !token) {
    console.error("Missing required parameters");
    return res.status(400).json({
      error: "channelName, resourceId, uid, and token are required",
    });
  }

  // Convert environment variables to numbers
  const vendor = parseInt(process.env.S3_VENDOR, 10) || 2; // Vendor for S3 (2 is default)
  const region = parseInt(process.env.S3_REGION, 10) || 0; // AWS region, 0 = us-east-1

  console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");
  console.log("S3_ACCESS_KEY:", process.env.S3_ACCESS_KEY || "Not Defined");
  console.log("S3_SECRET_KEY:", process.env.S3_SECRET_KEY || "Not Defined");

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Define the payload to Agora for starting recording
    const payload = {
      cname: channelName,
      uid: uid.toString(), // Ensure UID is sent as a string
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
          vendor: vendor, // Make sure vendor is a number
          region: region, // Make sure region is a number
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

    console.log("Agora start recording response:", startRecordingResponse.data);

    const { sid } = startRecordingResponse.data;
    console.log("Recording started with sid:", sid);

    res.json({ resourceId, sid });
  } catch (error) {
    console.error(
      "Error starting recording:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );

    // Log the full error details, including the payload and response
    console.error(
      "Full error response:",
      error.response
        ? JSON.stringify(error.response, null, 2)
        : "No response data"
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

// Token generation endpoint
app.get("/access_token", nocache, generateAccessToken);

// Export the app as a module
module.exports = app;
