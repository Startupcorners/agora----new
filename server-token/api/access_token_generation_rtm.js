const express = require("express");
const { RtmTokenBuilder } = require("./RtmTokenBuilder"); // Import your RtmTokenBuilder
const router = express.Router(); // Create the router
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

router.get("/", nocache, (req, res) => {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    console.log(`Generating RTM token for UID: ${uid}`);

    // Set the expiration time to 1 hour (3600 seconds)
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Build the RTM token using your RtmTokenBuilder
    const token = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      uid,
      privilegeExpiredTs
    );

    console.log("Generated RTM Token:", token);
    return res.json({ token });
  } catch (error) {
    console.error("RTM Token generation failed:", error);
    return res.status(500).json({
      error: "RTM Token generation failed",
      details: error.message,
    });
  }
});

module.exports = router;
