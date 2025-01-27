const express = require("express");
const fetch = require("node-fetch"); // Required for external API calls
const router = express.Router();

const OPENAI_API_KEY = process.env.OPEN_AI_KEY;
const bubbleApiUrl = "https://sccopy-38403.bubbleapps.io/api/1.1/wf/newpoll";

if (!OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API Key in environment variables.");
}

// Function to send a POST request to Bubble API
async function sendRequest(slotsArray, poll) {
  try {
    if (!Array.isArray(slotsArray) || slotsArray.length === 0) {
      throw new Error("Invalid slots format received.");
    }

    // Sort the slots chronologically
    slotsArray.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    console.log(
      `[${new Date().toISOString()}] Formatted slots for Bubble:`,
      slotsArray
    );

    const response = await fetch(bubbleApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slots: slotsArray,
        poll: poll,
        iteration: 1,
        iteration_plus_one: 2,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully sent slots: ${JSON.stringify(slotsArray)}`);
    console.log(`Response: ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    console.error(
      `Error sending request for poll ${poll.title || poll}:`,
      error.message
    );
    throw error;
  }
}

// Express route
router.post("/", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] Incoming request to /event with body:`,
    req.body
  );

  const { slots, poll } = req.body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    console.error("Error: Missing or invalid slots data");
    return res.status(400).json({ error: "Missing or invalid slots data" });
  }

  if (!poll || typeof poll !== "object") {
    console.error("Error: Missing or invalid poll data");
    return res.status(400).json({ error: "Missing or invalid poll data" });
  }

  try {
    const result = await sendRequest(slots, poll);
    return res.status(200).json({
      success: true,
      message: "Slots successfully created",
      slots,
      response: result,
    });
  } catch (err) {
    console.error("Error in event route:", err.message || err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
