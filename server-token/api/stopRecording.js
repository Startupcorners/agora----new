const express = require("express");
const axios = require("axios");
const router = express.Router();
const { pollForMp4 } = require("./pollForMp4"); // Import the polling function

// Stop recording endpoint
router.post("/stop", async (req, res) => {
  const { channelName, resourceId, sid, uid, timestamp } = req.body;

  if (!channelName || !resourceId || !sid || !uid || !timestamp) {
    return res.status(400).json({
      error: "channelName, resourceId, sid, uid, and timestamp are required",
    });
  }

  console.log("Stopping recording with details:", {
    channelName,
    resourceId,
    sid,
    uid,
    timestamp,
  });

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/web/stop`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Recording stopped on Agora");

    // Poll for MP4 in AWS S3 and return MP4 URL
    const mp4Url = await pollForMp4(resourceId, channelName, timestamp);

    res.json({
      message: "Recording stopped and MP4 retrieved successfully",
      mp4Url: mp4Url,
    });
  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({
      error: "Failed to stop recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
