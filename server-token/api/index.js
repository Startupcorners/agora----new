const express = require("express");
const cors = require("cors");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();

// Allowed origins
const allowedOrigins = [
  "https://startupcorners.com",
  "https://www.startupcorners.com",
];

// Debug incoming origins
app.use((req, res, next) => {
  console.log("Request Headers:", req.headers);
  console.log("Request Body:", req.body);
  next();
});

console.log("I'm here");

// CORS configurations
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); // Allow request
      } else {
        callback(new Error("Not allowed by CORS")); // Reject request
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  })
);

// No-cache headers
app.use((req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
});

// Middleware
app.use(express.json());

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Debug environment variables
console.log("Environment Variables:");
console.log("APP_ID:", process.env.APP_ID || "Not Defined");
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE || "Not Defined");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");

// Import routes
const accessTokenGeneration = require("./access_token_generation");
const acquire = require("./acquire");
const generateRecordingToken = require("./generate_recording_token");
const startCloudRecording = require("./startCloudRecording");
const stopCloudRecording = require("./stopCloudRecording");
const startAudioRecording = require("./startAudioRecording");
const stopAudioRecording = require("./stopAudioRecording");
const exchangeToken = require("./exchangeToken");

// IMPORTANT: refresh-token exports { router, refreshAccessToken }
const refreshTokenModule = require("./refresh-token");

const webhooks = require("./webhooks");
const renewWatch = require("./renew-watch");

// Apply routes
app.use("/generateTokens", accessTokenGeneration);
app.use("/acquire", acquire);
app.use("/generate_recording_token", generateRecordingToken);
app.use("/startCloudRecording", startCloudRecording);
app.use("/stopCloudRecording", stopCloudRecording);
app.use("/startAudioRecording", startAudioRecording);
app.use("/stopAudioRecording", stopAudioRecording);
app.use("/exchange-token", exchangeToken);

// Use .router here instead of the entire object
app.use("/refresh-token");

app.use("/webhook", webhooks);
app.use("/renew-watch", renewWatch);

// Error handler
app.use((err, req, res, next) => {
  console.error("Error Details:", err);
  // Set CORS headers for error responses
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.status(err.status || 500).send(err.message || "Something broke!");
});

// Export app
module.exports = app;
