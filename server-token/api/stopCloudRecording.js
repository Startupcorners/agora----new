// server/routes/recording.js

const express = require("express");
const axios = require("axios");
const pollForMp4 = require("./pollForMp4"); // Ensure this utility is properly imported
const router = express.Router();

/**
 * Route to stop cloud recording.
 * This route handles:
 * - Stopping cloud recording via Agora's API
 * - Polling the S3 bucket for the MP4 file
 * - Sending the MP4 file URL to Bubble
 */
router.post("/", async (req, res) => {
  const { resourceId, sid, channelName, uid, timestamp } = req.body;

  // Validate required fields
  if (!resourceId || !sid || !channelName || !uid) {
    console.error("Missing required parameters:", {
      resourceId,
      sid,
      channelName,
      uid,
      timestamp,
    });
    return res.status(400).json({
      error: "resourceId, sid, channelName, uid, and timestamp are required",
    });
  }

  console.log("Stop cloud recording request for:", {
    resourceId,
    sid,
    channelName,
    uid,
    timestamp,
  });

  try {
    // Authorization for Agora Cloud Recording
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Payload for stopping recording (clientRequest may need fields if required by Agora)
    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };

    // Stop the cloud recording using Agora's Cloud Recording RESTful API
    const stopResponse = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Stop cloud recording response from Agora:", stopResponse.data);

    // Poll for MP4 recording file in S3
    const mp4Url = await pollForMp4(resourceId, channelName, timestamp);
    console.log("MP4 retrieved:", mp4Url);

    // Send the MP4 link to Bubble via an API call
    const bubbleResponse = await axios.post(
      "https://startupcorners.com/version-test/api/1.1/wf/receiveRecording",
      {
        resourceId: channelName,
        url: mp4Url,
      }
    );

    console.log("Recording file URL sent to Bubble:", bubbleResponse.data);

    // Return success response to the client with the MP4 URL
    return res.json({
      message: "Cloud recording stopped successfully",
      mp4Url,
    });
  } catch (error) {
    console.error("Error stopping cloud recording on server route:", error);
    return res.status(500).json({
      error: "Failed to stop cloud recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
