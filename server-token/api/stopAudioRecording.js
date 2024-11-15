const express = require("express");
const axios = require("axios");
const router = express.Router();
const pollForMp4 = require("./pollForMp4");
const sendToAssemblyAiAndGetSummary = require("./assemblyai");

router.post("/", async (req, res) => {
  const { channelName, resourceId, sid, uid, timestamp } = req.body;

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
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };

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

    // Poll for MP4 (or audio file) in AWS S3
    const mp4Url = await pollForMp4(resourceId, channelName, timestamp);
    console.log("Audio file retrieved:", mp4Url);

    // Post the audio file URL to Bubble's API
    const bubbleResponse = await axios.post(
      "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receiveawsvideo",
      {
        ressourceID: resourceId,
        url: mp4Url,
      }
    );
    console.log("Audio file URL sent to Bubble:", bubbleResponse.data);

    // Send audio file URL to AssemblyAI for transcription and summary
    const assemblyResponse = await sendToAssemblyAiAndGetSummary(mp4Url);
    console.log("AssemblyAI Response received:", assemblyResponse);

    // Check if a valid summary is present before sending to Bubble
    if (assemblyResponse.summary && assemblyResponse.summary !== null) {
      // Send summary to Bubble
      const bubbleSummaryResponse = await axios.post(
        "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receivesummary",
        {
          ressourceID: resourceId,
          summary: assemblyResponse.summary,
        }
      );
      console.log("Summary sent to Bubble:", bubbleSummaryResponse.data);
    } else {
      // Handle cases where there is no summary available
      console.log("No summary available from AssemblyAI.");
      await axios.post(
        "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receivesummary",
        {
          ressourceID: resourceId,
          summary: "No summary available for this audio.",
        }
      );
    }

    // Respond to the frontend
    res.json({
      message:
        "Audio recording stopped, file sent to Bubble, summary sent to Bubble",
      mp4Url: mp4Url,
      summary: assemblyResponse.summary || "No summary available",
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
