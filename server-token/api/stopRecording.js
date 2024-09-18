const express = require("express");
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};
const axios = require("axios");
const pollForMp4 = require("./pollForMp4"); // Import the pollForMp4 function
const sendToAssemblyAiAndGetSummary = require("./assemblyai"); // Import AssemblyAI function
const router = express.Router();

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

    // Poll for MP4 in AWS S3
    const mp4Url = await pollForMp4(resourceId, channelName, timestamp);
    console.log("MP4 retrieved:", mp4Url);

    // Post the MP4 URL to Bubble's API
    const bubbleResponse = await axios.post(
      "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receiveawsvideo",
      {
        ressourceID: resourceId,
        url: mp4Url,
      }
    );
    console.log("MP4 URL sent to Bubble:", bubbleResponse.data);

    // Send MP4 URL to AssemblyAI for transcription and summary
    const summary = await sendToAssemblyAiAndGetSummary(mp4Url);
    console.log("Summary received:", summary);

    // Send summary to Bubble
    const bubbleSummaryResponse = await axios.post(
      "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receivesummary",
      {
        ressourceID: resourceId,
        summary: summary,
      }
    );
    console.log("Summary sent to Bubble:", bubbleSummaryResponse.data);

    // Respond to the frontend
    res.json({
      message: "Recording stopped, MP4 sent to Bubble, summary sent to Bubble",
      mp4Url: mp4Url,
      summary: summary,
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
