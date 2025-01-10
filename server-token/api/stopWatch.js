const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// Function to stop the subscription
async function stopWatch(channelId, resourceId) {
  try {
    // Step 1: Stop the existing subscription
    const stopResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/channels/stop",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          resourceId: resourceId,
        }),
      }
    );

    if (!stopResponse.ok) {
      const stopError = await stopResponse.json();
      console.error("Error stopping subscription:", stopError);
      throw new Error("Failed to stop subscription");
    }

    console.log(`Stopped subscription for channel ${channelId}`);
    return {
      success: true,
      message: `Stopped subscription for channel ${channelId}`,
    };
  } catch (error) {
    console.error("Error in stopWatch:", error.message);
    return { success: false, message: error.message };
  }
}

// Router endpoint to handle the stop request
router.post("/", async (req, res) => {
  const { channelId, resourceId } = req.body;

  if (!channelId || !resourceId) {
    return res.status(400).send("Missing required parameters");
  }

  try {
    const result = await stopWatch(channelId, resourceId);

    if (result.success) {
      return res.status(200).json({ message: result.message });
    } else {
      return res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error("Error in /stopWatch:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

module.exports = router;
