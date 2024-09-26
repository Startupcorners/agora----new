const express = require("express");
const cors = require("cors");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();

// AWS S3 setups
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Define allowed origins
const allowedOrigins = [
  "https://startupcorners.com",
  "https://www.startupcorners.com",
];

// CORS configuration using cors middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); // Allow the request if origin is allowed
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);


app.use(
  cors({
    origin: ["https://startupcorners.com", "https://www.startupcorners.com"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

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
