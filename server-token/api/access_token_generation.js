const { RtcTokenBuilder, Role: RtcRole } = require("./RtcTokenBuilder2");
const { RtmTokenBuilder } = require("./RtmTokenBuilder2");

module.exports = async (req, res) => {
  const { channelName, uid, role } = req.query;

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
};
