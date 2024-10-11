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

    const isNumericUid = /^\d+$/.test(uid);

    // Generate RTC token for the regular user
    const rtcRole =
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    let rtcToken;
    if (isNumericUid) {
      rtcToken = RtcTokenBuilder.buildTokenWithUid(
        process.env.APP_ID,
        process.env.APP_CERTIFICATE,
        channelName,
        parseInt(uid, 10),
        rtcRole,
        privilegeExpiredTs
      );
    } else {
      rtcToken = RtcTokenBuilder.buildTokenWithAccount(
        process.env.APP_ID,
        process.env.APP_CERTIFICATE,
        channelName,
        uid,
        rtcRole,
        privilegeExpiredTs
      );
    }

    // Generate RTM token for the regular user
    const rtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      uid,
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    // Generate separate tokens for screen share UID
    const screenShareUid = isNumericUid
      ? parseInt(uid) + 10000 // Modify for uniqueness
      : `${uid}-screen`;

    const screenShareRtcToken = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      parseInt(screenShareUid, 10),
      rtcRole,
      privilegeExpiredTs
    );

    const screenShareRtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      screenShareUid.toString(),
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    // Log the tokens and UIDs for troubleshooting
    console.log("Screen Share UID:", screenShareUid);
    console.log("Generated Screen Share RTC Token:", screenShareRtcToken);
    console.log("Generated Screen Share RTM Token:", screenShareRtmToken);

    // Return both tokens in the response
    return res.json({
      rtcToken: rtcToken,
      rtmToken: rtmToken,
      screenShareRtcToken: screenShareRtcToken,
      screenShareRtmToken: screenShareRtmToken,
    });
  } catch (error) {
    console.error("Token generation failed:", error);
    return res.status(500).json({
      error: "Token generation failed",
      details: error.message,
    });
  }
};
