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
    const expirationInSeconds = 3600;

    // Convert UID to integer for RTC and string for RTM
    const rtcUid = parseInt(uid); // RTC requires integer UID
    const rtmUid = uid.toString(); // RTM requires string UID

    console.log("RTC UID (Integer):", rtcUid);
    console.log("RTM UID (String):", rtmUid);

    // Generate RTC token
    const rtcRole =
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      rtcUid,
      rtcRole,
      expirationInSeconds
    );

    // Generate RTM token
    const rtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      rtmUid.toString(),
      expirationInSeconds
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
