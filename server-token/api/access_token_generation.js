const functions = require("firebase-functions");
const express = require("express");
const { RtcTokenBuilder, Role: RtcRole } = require("./RtcTokenBuilder2");
const { RtmTokenBuilder } = require("./RtmTokenBuilder");
const cors = require("cors");

// Initialize the Express app
const app = express();
app.use(cors({ origin: true })); // Enable CORS for all origins (optional, you can restrict this if needed)

// Middleware to disable caching
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

app.get("/", nocache, (req, res) => {
  const { channelName, uid, role } = req.query;

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // Set token expiration to 1 hour (3600 seconds)
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Generate RTC token
    const rtcRole =
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      uid,
      rtcRole,
      privilegeExpiredTs
    );

    // Generate RTM token
    const rtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      uid,
      privilegeExpiredTs
    );

    console.log("Generated RTC Token:", rtcToken);
    console.log("Generated RTM Token:", rtmToken);

    // Return both tokens in the response
    return res.json({
      rtcToken: rtcToken,
      rtmToken: rtmToken,
    });
  } catch (error) {
    console.error("Token generation failed:", error);
    return res.status(500).json({
      error: "Token generation failed",
      details: error.message,
    });
  }
});

// Export the function as a Firebase Cloud Function
exports.generateTokens = functions.https.onRequest(app);
