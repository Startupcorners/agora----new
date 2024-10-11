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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // Set token expiration to 1 hour (3600 seconds)
    const expirationInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000); // Get current time in seconds
    const privilegeExpiredTs = currentTimestamp + expirationInSeconds; // Set expiration time

    // Determine if UID is numeric
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

    // Generate separate tokens for screen share UID (modify the UID slightly)
    const screenShareUid = isNumericUid
      ? parseInt(uid.toString().slice(0, -1), 10) // For numeric UIDs
      : uid + "-screen"; // For string UIDs, append '-screen'

    const screenShareRtcToken = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      parseInt(screenShareUid, 10), // Use screenShareUid
      rtcRole,
      privilegeExpiredTs
    );

    const screenShareRtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      screenShareUid.toString(), // Convert to string if necessary
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    console.log("Generated RTC Token for Screen Share:", screenShareRtcToken);
    console.log("Generated RTM Token for Screen Share:", screenShareRtmToken);

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
