const express = require("express");
const { RtcTokenBuilder, Role } = require("./RtcTokenBuilder2"); // Assuming the RtcTokenBuilder2.js file is in the same directory
const router = express.Router();

// Define nocache function to disable caching
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

router.get("/access_token", nocache, (req, res) => {
  const { channelName, uid, role } = req.query;

  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    console.log(
      `Generating token for channel: ${channelName}, UID: ${uid}, Role: ${role}`
    );

    const tokenRole = role === "publisher" ? Role.PUBLISHER : Role.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      uid,
      tokenRole,
      Math.floor(Date.now() / 1000) + 3600 // Token valid for 1 hour
    );

    console.log("Generated Token:", token);
    return res.json({ token });
  } catch (error) {
    console.error("Token generation failed:", error);
    return res.status(500).json({
      error: "Token generation failed",
      details: error.message,
    });
  }
});

module.exports = router;
