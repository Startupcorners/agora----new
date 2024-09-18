const express = require("express");
const { nocache } = require("./index");
const router = express.Router(); // Create the router

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
      Math.floor(Date.now() / 1000) + 3600
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
