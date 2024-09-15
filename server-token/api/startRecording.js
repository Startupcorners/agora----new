const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    console.error("Invalid request method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resourceId, channelName, uid, token } = req.body;

  if (!resourceId || !channelName || !uid || !token) {
    console.error("Missing required parameters:", {
      resourceId,
      channelName,
      uid,
      token,
    });
    return res.status(400).json({
      error: "resourceId, channelName, uid, and token are required",
    });
  }

  // Log environment variables to ensure they're being loaded
  const APP_ID = process.env.APP_ID;
  const CUSTOMER_ID = process.env.CUSTOMER_ID;
  const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;

  console.log("Environment variables:");
  console.log("APP_ID:", APP_ID || "Not Defined");
  console.log("CUSTOMER_ID:", CUSTOMER_ID || "Not Defined");
  console.log("CUSTOMER_SECRET:", CUSTOMER_SECRET ? "Defined" : "Not Defined");

  if (!APP_ID || !CUSTOMER_ID || !CUSTOMER_SECRET) {
    console.error("Missing required environment variables");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const auth = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`).toString(
    "base64"
  );

  const payload = {
    cname: channelName,
    uid: uid,
    clientRequest: {
      token: token,
      recordingConfig: {
        maxIdleTime: 30,
        streamTypes: 2,
        channelType: 1,
        videoStreamType: 0,
        transcodingConfig: {
          height: 640,
          width: 360,
          bitrate: 500,
          fps: 15,
          mixedVideoLayout: 1,
        },
      },
      recordingFileConfig: {
        avFileType: ["hls", "mp4"],
      },
      storageConfig: {
        vendor: 2,
        region: parseInt(process.env.S3_REGION, 10),
        bucket: process.env.S3_BUCKET_NAME,
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        fileNamePrefix: ["recordings"],
      },
    },
  };

  // Log the full payload to ensure correctness
  console.log("Start recording payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Start recording response:", response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Start Recording Error:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: error.response ? error.response.data : error.message,
      details: error.response ? error.response.data : undefined,
    });
  }
};
