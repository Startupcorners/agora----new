const express = require("express");
const axios = require("axios");
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};
const pollForMp4 = require("./pollForMp4");
const router = express.Router();

// Stop recording endpoint
router.post("/", async (req, res) => {
  const { channelName, resourceId, sid, uid, timestamp} = req.body;

  // Validate required parameters
  if (!channelName || !resourceId || !sid || !uid || !timestamp) {
    return res.status(400).json({
      error:
        "channelName, resourceId, sid, uid, timestamp are required",
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
    // Check if there's already a log entry for this eventId (to avoid redundant actions)
    const logResponse = await axios.post(
      "https://startupcorners.com/version-test/api/1.1/wf/recording_logs",
      {
        resourceId: resourceID,
      }
    );

    // If the response is "yes", do nothing and return early
    if (logResponse.data === "yes") {
      console.log(
        `Log entry for eventId ${channelName} already exists, skipping stop recording.`
      );
      return res.json({
        message: "Recording stop request skipped, log entry exists",
      });
    }

    // If there's no log entry (response is "no"), proceed to stop the recording
    console.log(
      `No log entry for eventId ${channelName}, proceeding with stop recording...`
    );

    // Create the authorization token for Agora API
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };

    // Call Agora's Cloud Recording API to stop recording
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

    // Poll for the MP4 file from S3
    const mp4Url = await pollForMp4(resourceId, channelName, timestamp);
    console.log("MP4 retrieved:", mp4Url);

    // Send the MP4 URL to Bubble's API
    const bubbleResponse = await axios.post(
      "https://startupcorners.com/version-test/api/1.1/wf/receiveawsvideo",
      {
        ressourceID: resourceId,
        url: mp4Url,
      }
    );
    console.log("MP4 URL sent to Bubble:", bubbleResponse.data);


  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({
      error: "Failed to stop recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
