// server-token/api/index.js

const express = require("express");
const cors = require("cors");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
require("dotenv").config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const app = express();
app.use(cors());

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
