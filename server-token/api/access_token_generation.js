const { RtmTokenBuilder } = require("./RtmTokenBuilder2");

module.exports = async (req, res) => {
  const { uid } = req.query;

  // Set no-cache headers to prevent caching of token responses
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate", // HTTP 1.1
    Pragma: "no-cache", // HTTP 1.0
    Expires: "0", // Force immediate expiration
  });

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // Set token expiration to 1 hour (3600 seconds)
    const expirationInSeconds = 3600;

    // Convert UID to string for RTM
    const rtmUid = uid.toString(); // RTM requires string UID

    console.log("RTM UID (String):", rtmUid);

    // Generate RTM token
    const rtmToken = RtmTokenBuilder.buildToken(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      rtmUid,
      expirationInSeconds
    );

    console.log("APP ID:", process.env.APP_ID);
    console.log("APP Certificate:", process.env.APP_CERTIFICATE);
    console.log("UID (RTM):", rtmUid);
    console.log("Expiration (seconds):", expirationInSeconds);
    console.log("Generated RTM Token:", rtmToken);

    // Return RTM token in the response
    return res.json({
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
