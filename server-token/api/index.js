const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { S3Client } = require("@aws-sdk/client-s3");
const WebSocket = require("ws");
require("dotenv").config();

const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

const app = express();

// Use port 443 for WebSocket over wss://
const port = 443;

// AWS S3 setup
const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

// Log environment variables for debugging
console.log("APP_ID:", process.env.APP_ID || "Not Defined");
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE || "Not Defined");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");

// CORS setup for Bubble and WebSocket connections
app.use(
  cors({
    origin: [
      "https://www.startupcorners.com",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval'; connect-src * wss://* https://*;"
  );
  next();
});




// JSON parser middleware
app.use(express.json());

// Handle preflight requests
app.options("*", cors());

// Health check route for Elastic Beanstalk to check if the app is running
app.get("/", (req, res) => {
  res.status(200).send("Health check passed");
});

// Importing route files
const accessTokenGeneration = require("./access_token_generation");
const acquire = require("./acquire");
const generateRecordingToken = require("./generate_recording_token");
const startRecording = require("./startRecording");
const stopRecording = require("./stopRecording");

// Using routes
app.use("/generateTokens", accessTokenGeneration);
app.use("/acquire", acquire);
app.use("/generate_recording_token", generateRecordingToken);
app.use("/start", startRecording);
app.use("/stop", stopRecording);

// Start the HTTP server and listen on port 443 for secure WebSocket connections
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});

// WebSocket Server setup
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("A new WebSocket client connected");

  ws.send("Welcome to the WebSocket server!");

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
    // Broadcast the received message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`Broadcast: ${message}`);
      }
    });
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

module.exports = app;
