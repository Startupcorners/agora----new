const express = require("express");
const cors = require("cors");
const axios = require("axios");
const AWS = require("aws-sdk");
require("dotenv").config();

const allowedOrigins = [
  "https://startupcorners.com",
  "https://www.startupcorners.com",
];

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

const app = express();

// Apply nocache middleware if needed
app.use(nocache);


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
    origin: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

// JSON parser middleware
app.use(express.json());

// Handle preflight requests
app.options("*", cors());

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});


// Export the app
module.exports = app;

// Define allowed origins

