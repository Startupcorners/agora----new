const express = require("express");
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};
const { RtcTokenBuilder, Role } = require("./RtcTokenBuilder2"); // Make sure this is correctly imported
const router = express.Router(); // Use the router to modularize the routes

router.get("/generate_recording_token", (req, res) => {
  const channelName = req.query.channelName;

  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  // Log the APP_ID and APP_CERTIFICATE (partially masked for security)
  console.log(
    `APP_ID: ${
      process.env.APP_ID
        ? process.env.APP_ID.substring(0, 5) + "..."
        : "Not Set"
    }`
  );
  console.log(
    `APP_CERTIFICATE: ${
      process.env.APP_CERTIFICATE
        ? process.env.APP_CERTIFICATE.substring(0, 5) + "..."
        : "Not Set"
    }`
  );

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const role = Role.PUBLISHER; // Use PUBLISHER role for recording

  console.log(
    `Generating token for channel: ${channelName}, UID: 0, Role: ${role}`
  );

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      "0", // UID set to "0" for recording
      role,
      Math.floor(Date.now() / 1000) + 3600 // Token valid for 1 hour
    );

    // Log a portion of the generated token for verification
    console.log(
      `Generated token (first 10 characters): ${token.substring(0, 10)}...`
    );

    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

module.exports = router; // Export the router for use in index.js
