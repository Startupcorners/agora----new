const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/", async (req, res) => {
  const { channelName, resourceId, uid, token } = req.body;

  if (!channelName || !resourceId || !uid || !token) {
    console.error("Missing required parameters:", {
      channelName,
      resourceId,
      uid,
      token,
    });
    return res.status(400).json({
      error: "channelName, resourceId, uid, and token are required",
    });
  }

  console.log("Start cloud recording request for:", {
    channelName,
    resourceId,
    uid,
    token,
  });

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Construct the payload for Agora's start recording API
    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        token: token,
        recordingConfig: {
          maxIdleTime: 30,
          subscribeAudioUids: [], // Automatically subscribe to audio from all users
          subscribeVideoUids: [uid], // Only subscribe to video from UID (screen sharer)
          streamTypes: 2, // Record both audio and video
          audioProfile: 1, // Audio profile for recording (e.g., low quality for voice)
          channelType: 1, // Communication channel type
          videoStreamType: 0, // Default video stream
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"], // Recording formats
        },
        storageConfig: {
          vendor: 1, // Storage vendor (e.g., AWS S3)
          region: 0, // Storage region
          bucket: process.env.S3_BUCKET_NAME,
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY,
          fileNamePrefix: ["recordings", channelName, String(Date.now())], // File name prefix
        },
      },
    };

    console.log(
      "Payload sent to Agora for start cloud recording:",
      JSON.stringify(payload, null, 2)
    );

    // Make API call to Agora's start recording endpoint
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Start cloud recording response:", response.data);

    if (response.data.sid) {
      console.log("SID received:", response.data.sid);
      res.json({
        resourceId,
        sid: response.data.sid,
      });
    } else {
      console.error("No SID in response:", response.data);
      res
        .status(500)
        .json({ error: "Failed to start cloud recording: No SID received" });
    }
  } catch (error) {
    console.error("Error starting cloud recording:", error);
    res.status(500).json({
      error: "Failed to start cloud recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
