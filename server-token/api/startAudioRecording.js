const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/", async (req, res) => {
  const { channelName, resourceId, uid, token, timestamp } = req.body;

  if (!channelName || !resourceId || !uid || !token || !timestamp) {
    console.error("Missing required parameters:", {
      channelName,
      resourceId,
      uid,
      token,
      timestamp,
    });
    return res.status(400).json({
      error: "channelName, resourceId, uid, token, and timestamp are required",
    });
  }

  console.log("Start audio recording request for:", {
    channelName,
    resourceId,
    uid,
    token,
    timestamp,
  });

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        token: token,
        recordingConfig: {
          audioProfile: 1,
          // For audio-only recording, specify audio file type
          recordingFileConfig: {
            avFileType: ["audio"],
          },
        },
        storageConfig: {
          vendor: 1,
          region: 0,
          bucket: process.env.S3_BUCKET_NAME,
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY,
          fileNamePrefix: ["recordings", channelName, timestamp],
        },
      },
    };

    console.log(
      "Payload sent to Agora for start audio recording:",
      JSON.stringify(payload, null, 2)
    );

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/mode/1/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Start audio recording response:", response.data);

    if (response.data.sid) {
      console.log("SID received:", response.data.sid);
      res.json({ resourceId, sid: response.data.sid, timestamp });
    } else {
      console.error("No SID in response:", response.data);
      res
        .status(500)
        .json({ error: "Failed to start audio recording: No SID received" });
    }
  } catch (error) {
    console.error("Error starting audio recording:", error);
    res.status(500).json({
      error: "Failed to start audio recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
