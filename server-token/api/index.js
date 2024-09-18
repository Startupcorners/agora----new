const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { SpeechClient } = require("@google-cloud/speech");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();

// OpenAI configuration
const { Configuration, OpenAIApi } = require("openai");
const openaiClient = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Log environment variables for debugging
console.log("APP_ID:", process.env.APP_ID || "Not Defined");
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE || "Not Defined");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");

// CORS setup for Bubble
app.use(
  cors({
    origin: "https://sccopy-38403.bubbleapps.io",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

// JSON parser middleware
app.use(express.json());

// Handle preflight requests
app.options("*", cors());

// Disable caching
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

// Importing route files
const accessTokenGeneration = require("./access_token_generation");
const acquire = require("./acquire");
const generateRecordingToken = require("./generate_recording_token");
const startRecording = require("./startRecording");
const stopRecording = require("./stopRecording");
const pollForMp4 = require("./pollForMp4");
const { transcriptSummaryEndpoint } = require("./summarizeTranscript");

// Using routes
app.use("/access-token", accessTokenGeneration);
app.use("/acquire", acquire);
app.use("/generate_recording_token", generateRecordingToken);
app.use("/start", startRecording);
app.use("/stop", stopRecording);
app.post("/transcript-summary", transcriptSummaryEndpoint);

// Export the app
module.exports = app;
