// server-token/api/startRecording.js
const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resourceId, channelName, uid, token } = req.body;

  // Agora Credentials from Environment Variables
  const APP_ID = process.env.AGORA_APP_ID;
  const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
  const CUSTOMER_CERTIFICATE = process.env.AGORA_CUSTOMER_CERTIFICATE;

  const auth = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_CERTIFICATE}`).toString(
    "base64"
  );

  try {
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      {
        cname: channelName,
        uid: uid,
        clientRequest: {
          token: token, // Include if your channel uses tokens
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
            vendor: 2, // Example: 2 for Amazon S3
            region: parseInt(process.env.STORAGE_REGION, 10),
            bucket: process.env.S3_BUCKET_NAME,
            accessKey: process.env.S3_ACCESS_KEY,
            secretKey: process.env.S3_SECRET_KEY,
            fileNamePrefix: ["recordings"],
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Start Recording Error:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({ error: error.response ? error.response.data : error.message });
  }
};
