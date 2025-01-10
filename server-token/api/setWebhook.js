// setWebhook.js
const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Missing accessToken" });
    }

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: `channel-${Date.now()}`, // unique channel ID
          type: "webhook",
          address: "https://agora-new.vercel.app/webhook",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error || "Failed to set up watch",
        details: result,
      });
    }

    // Return the successful response data
    return res.status(200).json({
      message: "Push Notification Watch Set Up Successfully",
      googleResponse: result,
    });
  } catch (error) {
    console.error("Error in /setWebhook:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

module.exports = router;
