const {
  RtcTokenBuilder,
  RtcRole,
  RtmTokenBuilder,
  RtmRole,
} = require("agora-access-token");

module.exports = async (req, res) => {
  const { channelName, uid, role } = req.query;

  // Define allowed origins
  const allowedOrigins = [
    "https://startupcorners.com",
    "https://www.startupcorners.com",
  ];

  // Get the origin of the request
  const origin = req.headers.origin;

  // Set CORS headers if the origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(204).send(""); // Respond to OPTIONS requests with no content
  }

  console.log(
    `Request received: channelName=${channelName}, uid=${uid}, role=${role}`
  );

  if (!channelName || !uid) {
    console.error("Error: channelName and uid are required");
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("Error: APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    console.log("Generating tokens...");

    // Token expiration
    const expirationInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

    console.log(`Current timestamp: ${currentTimestamp}`);
    console.log(`Token expiration timestamp: ${privilegeExpiredTs}`);

    // Role assignment
    const rtcRole =
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    console.log(`Assigned RTC Role: ${rtcRole}`);

    // UID parsing and validation
    const numericUid = parseInt(uid, 10);
    if (isNaN(numericUid)) {
      console.error(`Error: UID is not a valid number. Received UID: ${uid}`);
      return res.status(400).json({ error: "UID must be a valid number" });
    }
    console.log(`Parsed numeric UID: ${numericUid}`);

    // Generate RTC token for the regular user
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      numericUid, // Ensure numeric uid
      rtcRole,
      privilegeExpiredTs
    );

    console.log(`Generated RTC Token: ${rtcToken}`);

    // Generate RTM token for the regular user
    const rtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      numericUid.toString(), // Ensure UID is passed as a string for RTM
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    console.log(`Generated RTM Token: ${rtmToken}`);

    // Return both tokens in the response
    console.log("Returning tokens...");
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
