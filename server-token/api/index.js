// server-token/api/index.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

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

// Token generation endpoint (if needed)
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

  let role = "publisher"; // Default to publisher for recording
  if (req.query.role === "subscriber") {
    role = "subscriber";
  }

  let expireTime = req.query.expireTime;
  if (!expireTime || expireTime === "") {
    expireTime = 3600; // seconds
  } else {
    expireTime = parseInt(expireTime, 10);
  }

  // Token generation logic (Implement as per Agora SDK)
  // For simplicity, returning a placeholder token
  const token = "YOUR_GENERATED_TOKEN";

  return res.json({ token });
};

// Acquire Resource Endpoint
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  // Validate input
  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  try {
    const authorization = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid.toString(),
      clientRequest: {}, // Empty as per documentation
    };

    // Log the payload being sent to Agora
    console.log("Payload for /acquire:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/acquire`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log Agora's response
    console.log("Agora acquire response:", response.data);

    const { resourceId } = response.data;
    res.json({ resourceId });
  } catch (error) {
    console.error(
      "Error in /acquire:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    res
      .status(error.response ? error.response.status : 500)
      .json({ error: "Failed to acquire resource" });
  }
});

// Start Recording Endpoint
app.post("/start", async (req, res) => {
  const { channelName, resourceId, uid, token } = req.body;

  // Validate input
  if (!channelName || !resourceId || !uid || !token) {
    return res
      .status(400)
      .json({ error: "channelName, resourceId, uid, and token are required" });
  }

  try {
    const authorization = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid.toString(),
      clientRequest: {
        token: token,
        recordingConfig: {
          channelType: 0, // 0 for Live Broadcast, 1 for Communication
        },
        storageConfig: {
          vendor: 0, // Replace with 2 for Amazon S3 as per your needs
          region: 0, // 0 for us-east-1, adjust if necessary
          bucket: process.env.S3_BUCKET_NAME,
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY,
        },
      },
    };

    // Log the payload being sent to Agora
    console.log("Payload for /start:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/mode/individual/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log Agora's response
    console.log("Agora start recording response:", response.data);

    const { sid } = response.data;
    res.json({ resourceId, sid });
  } catch (error) {
    console.error(
      "Error in /start:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    res
      .status(error.response ? error.response.status : 500)
      .json({ error: "Failed to start recording" });
  }
});

// Stop Recording Endpoint
app.post("/stop", async (req, res) => {
  const { channelName, resourceId, sid } = req.body;

  // Validate input
  if (!channelName || !resourceId || !sid) {
    return res
      .status(400)
      .json({ error: "channelName, resourceId, and sid are required" });
  }

  try {
    const authorization = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: "0",
      clientRequest: {},
    };

    // Log the payload being sent to Agora
    console.log("Payload for /stop:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/individual/stop`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log Agora's response
    console.log("Agora stop recording response:", response.data);

    res.json({ message: "Recording stopped successfully" });
  } catch (error) {
    console.error(
      "Error in /stop:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    res
      .status(error.response ? error.response.status : 500)
      .json({ error: "Failed to stop recording" });
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

// Token generation endpoint (if needed)
app.get("/access_token", nocache, generateAccessToken);

// Export the app as a module
module.exports = app;
