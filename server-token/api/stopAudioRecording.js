const express = require("express");
const axios = require("axios");
const router = express.Router();
const pollForAudioFile = require("./pollForMp4"); // Adjusted poll function for audio

router.post("/", async (req, res) => {
  const { channelName, resourceId, sid, uid, timestamp } = req.body;

  // Validate required parameters
  if (!channelName || !resourceId || !sid || !uid || !timestamp) {
    return res.status(400).json({
      error: "channelName, resourceId, sid, uid, and timestamp are required",
    });
  }

  console.log("Stopping audio recording with details:", {
    channelName,
    resourceId,
    sid,
    uid,
    timestamp,
  });

  try {
    // Create the authorization token for Agora API
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };

    // Stop the audio recording using Agora's Cloud Recording API
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/1/stop`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Audio recording stopped on Agora", response.data);

    // Poll for the audio file (AWS S3 or other storage location)
    const audioUrl = await pollForAudioFile(resourceId, channelName, timestamp);
    console.log("Audio file retrieved:", audioUrl);

    // Send the audio file URL to WebAssembly (instead of Bubble)
    const webAssemblyResponse = await axios.post(
      "https://your-webassembly-endpoint.com/api/upload-audio", // Change this URL to the actual WebAssembly endpoint
      {
        ressourceID: resourceId,
        url: audioUrl,
      }
    );
    console.log(
      "Audio file URL sent to WebAssembly:",
      webAssemblyResponse.data
    );

    // Respond to the frontend (without sending anything to Bubble)
    res.json({
      message: "Audio recording stopped, file sent to WebAssembly",
      audioUrl: audioUrl,
    });
  } catch (error) {
    console.error("Error stopping audio recording:", error);
    res.status(500).json({
      error: "Failed to stop audio recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
