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
async function handleRecordingTimeout(
  channelName,
  recordingId,
  resourceId,
  uid
) {
  console.log(
    `Processing timed-out recording: ${channelName}, ID: ${recordingId}`
  );

  try {
    // Call your Bubble workflow to process the recording
    const response = await axios.post(
      "https://startupcorners.com/api/1.1/wf/processTimedOutRecording",
      {
        channelName,
        sid: recordingId,
        resourceId,
        uid,
        reason: "timeout",
      }
    );

    console.log("Recording processing initiated:", response.data);
  } catch (error) {
    console.error("Error processing timed-out recording:", error);
  }
}

module.exports = router;
