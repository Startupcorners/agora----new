const express = require("express");
const axios = require("axios");
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};
const pollForAudio = require("./pollForAudio");
const router = express.Router();

// Stop recording endpoint
router.post("/", nocache, async (req, res) => {
  const { channelName, resourceId, sid, uid, timestamp } = req.body;

  // Validate required parameters
  if (!channelName || !resourceId || !sid || !uid || !timestamp) {
    console.error("Missing required parameters:", {
      channelName,
      resourceId,
      sid,
      uid,
      timestamp,
    });
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
    // Check if there's already a log entry for this resourceId to avoid redundant actions
    const logResponse = await axios.post(
      "https://startupcorners.com/version-test/api/1.1/wf/recording_logs",
      {
        resourceId: resourceId, // Ensure the parameter is correctly passed in the body
      }
    );

    console.log(
      "Response from /recording_logs (POST):",
      JSON.stringify(logResponse.data, null, 2)
    );

    if (logResponse.data === "yes") {
      console.log(
        `Log entry for resourceId ${resourceId} already exists, skipping stop recording.`
      );
      return res.json({
        message: "Recording stop request skipped, log entry exists",
      });
    }

    console.log(
      `No log entry for resourceId ${resourceId}, proceeding with stop recording...`
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
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Recording stopped on Agora. Response:",
      JSON.stringify(response.data, null, 2)
    );

    // Poll for the audio file from S3
    const audioUrl = await pollForAudio(resourceId, channelName, timestamp);
    console.log("Audio file retrieved:", audioUrl);

    // Send the audio file URL to WebAssembly (instead of Bubble)
    const webAssemblyResponse = await axios.post(
      "https://your-webassembly-endpoint.com/api/upload-audio", // Replace with your actual WebAssembly endpoint
      {
        resourceId: resourceId,
        url: audioUrl,
      }
    );
    console.log(
      "Audio file URL sent to WebAssembly:",
      webAssemblyResponse.data
    );

    // Respond to the frontend
    res.json({
      message: "Audio recording stopped, file sent to WebAssembly",
      audioUrl: audioUrl,
    });
  } catch (error) {
    console.error("Error stopping recording:", error.message);
    console.error("Full error details:", error.response?.data || error);

    res.status(500).json({
      error: "Failed to stop recording",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
