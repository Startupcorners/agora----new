const {
  RtcTokenBuilder,
  RtcRole,
  RtmTokenBuilder,
  RtmRole,
} = require("agora-access-token");

module.exports = async (req, res) => {
  const { channelName, uid, role } = req.query;

  // Set no-cache headers to prevent caching of token responses
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // Token expiration
    const expirationInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

    // Generate RTC token for the regular user
    const rtcRole =
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Since uid is always numeric, we only need to build tokens with UID
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      parseInt(uid, 10), // Ensure numeric uid
      rtcRole,
      privilegeExpiredTs
    );

    // Generate RTM token for the regular user
    const rtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      uid, // uid is numeric, convert to string automatically in the builder
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

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
};
