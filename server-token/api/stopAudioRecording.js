// Required modules
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
  console.log("Incoming request to stopAudioRecording");
  console.log("Request Headers:", req.headers);
  console.log("Request Body:", req.body);

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
    console.log("Step 1: Checking for existing log entry for resourceId");
    const logResponse = await axios.post(
      "https://startupcorners.com/version-test/api/1.1/wf/recording_logs",
      {
        resourceId: resourceId,
      }
    );
    console.log("Response from /recording_logs:", logResponse.data);

    if (logResponse.data === "yes") {
      console.log(
        `Log entry for resourceId ${resourceId} already exists, skipping stop recording.`
      );
      return res.json({
        message: "Recording stop request skipped, log entry exists",
      });
    }

    console.log("Step 2: Creating Agora authorization token");
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");
    console.log("Authorization token created");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };
    console.log("Payload for Agora API:", payload);

    console.log("Step 3: Sending request to Agora Cloud Recording API");
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
    console.log("Agora API Response:", response.data);

    console.log("Step 4: Polling for audio file URL");
    const audioUrl = await pollForAudio(resourceId, channelName, timestamp);
    console.log("Audio file retrieved:", audioUrl);

    console.log("Step 5: Sending audio file to AssemblyAI for transcription");
    const assemblyAiResponse = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: audioUrl,
      },
      {
        headers: {
          Authorization: process.env.ASSEMBLY_AI_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("AssemblyAI Response:", assemblyAiResponse.data);

    const assemblyId = assemblyAiResponse.data.id;

    console.log("Step 6: Sending AssemblyAI ID and resourceId to Bubble API");
    const bubbleResponse = await axios.post(
      "https://startupcorners.com/version-test/api/1.1/wf/pollfortext",
      {
        resourceId: resourceId,
        assemblyId: assemblyId,
      }
    );
    console.log("Response from /pollfortext:", bubbleResponse.data);

    console.log("Final Step: Sending response back to frontend");
    res.json({
      message: "Audio recording stopped and AssemblyAI ID sent to Bubble",
      audioUrl: audioUrl,
      assemblyId: assemblyId,
    });
  } catch (error) {
    console.error("Error encountered:", error.message);
    console.error("Error Response Data:", error.response?.data || error);

    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );

    res.status(500).json({
      error: "Failed to stop recording",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
