const express = require("express");
const router = express.Router();
const axios = require("axios");

// Agora webhook handler
router.post("/", async (req, res) => {
  try {
    console.log("Received Agora webhook:", JSON.stringify(req.body, null, 2));

    // Return 200 OK immediately to acknowledge receipt (important!)
    res.status(200).json({ success: true });

    // Process the event asynchronously
    processAgoraEvent(req.body);
  } catch (error) {
    console.error("Error processing Agora webhook:", error);
    // Still return 200 to acknowledge receipt to Agora
    if (!res.headersSent) {
      res.status(200).json({ success: false, error: error.message });
    }
  }
});

// Process Agora events
async function processAgoraEvent(event) {
  try {
    // Check if this is a recording ended event (event type 31 = recorder_leave)
    if (event.eventType === 31) {
      const details = event.details || {};
      const leaveCode = details.leaveCode;

      // Log the leave code for debugging
      console.log(
        `Recording leave event detected with leave code: ${leaveCode}`
      );

      // Check if the leave was due to timeout (no users)
      // LEAVE_CODE_NO_USERS = 4 (binary 100)
      if (leaveCode && (leaveCode & 4) !== 0) {
        console.log("Recording stopped due to timeout (no users in channel)");

        // Extract recording details from the event
        const channelName = event.cname;
        const recordingId = event.sid;
        const resourceId = event.resourceId;
        const uid = event.uid;

        // Trigger your custom function to handle the recording
        await handleRecordingTimeout(channelName, recordingId, resourceId, uid);
      }
    }
  } catch (error) {
    console.error("Error processing Agora event:", error);
  }
}

// Handle recording timeout
// Handle recording timeout
async function handleRecordingTimeout(channelName, recordingId, resourceId, uid) {
  console.log(`Processing timed-out recording: ${channelName}, ID: ${recordingId}`);
  const timestamp = Date.now().toString();
  
  try {
    // 1. Try to stop cloud recording
    console.log("Attempting to stop cloud recording via API...");
    try {
      const stopCloudResponse = await axios.post(`${process.env.MY_SERVER_URL || "https://agora-new.vercel.app"}/stopCloudRecording`, {
        resourceId: resourceId,
        sid: recordingId,
        channelName: channelName,
        uid: uid,
        timestamp: timestamp
      });
      
      console.log("Cloud recording stopped via API:", stopCloudResponse.data);
    } catch (cloudError) {
      console.error("Error stopping cloud recording:", cloudError.message);
    }
    
    // 2. Try to stop audio recording using the same information
    console.log("Attempting to stop audio recording via API...");
    try {
      const stopAudioResponse = await axios.post(`${process.env.MY_SERVER_URL || "https://agora-new.vercel.app"}/stopAudioRecording`, {
        resourceId: resourceId,
        sid: recordingId,
        channelName: channelName,
        uid: uid,
        timestamp: timestamp
      });
      
      console.log("Audio recording stopped via API:", stopAudioResponse.data);
    } catch (audioError) {
      console.error("Error stopping audio recording:", audioError.message);
    }
  } catch (error) {
    console.error("Error processing timed-out recording:", error);
  }
}

module.exports = router;
