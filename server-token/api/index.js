const express = require("express");
const cors = require("cors");
const axios = require("axios");
const AWS = require("aws-sdk");
require("dotenv").config();

const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

const app = express();

// AWS S3 setups
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Log environment variables for debugging
console.log("APP_ID:", process.env.APP_ID || "Not Defined");
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE || "Not Defined");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");

// Dynamic CORS setup, allowing both startupcorners.com and www.startupcorners.com
const allowedOrigins = [
  "https://startupcorners.com",
  "https://www.startupcorners.com",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Middleware to redirect non-www to www (optional, for consistency)
app.use((req, res, next) => {
  if (req.headers.host === "startupcorners.com") {
    return res.redirect(
      301,
      `https://www.startupcorners.com${req.originalUrl}`
    );
  }
  next();
});

// JSON parser middleware
app.use(express.json());

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

// Export the app
module.exports = app;
