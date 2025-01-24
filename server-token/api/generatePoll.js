const express = require("express");
const fetch = require("node-fetch"); // Required for external API calls
const router = express.Router();

const OPENAI_API_KEY = process.env.OPEN_AI_KEY;
const bubbleApiUrl = "https://sccopy-38403.bubbleapps.io/api/1.1/wf/newpoll";

if (!OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API Key in environment variables.");
}

// Function to send a POST request to Bubble API
async function sendRequest(slotsString, poll) {
  try {
    if (!slotsString.includes("_")) {
      throw new Error("Invalid slot format received.");
    }

    let slotPairs = slotsString.split(",").map((slot) => slot.trim());
    let slotsArray = slotPairs.flatMap((slot) =>
      slot.split("_").map((s) => s.trim())
    );

    slotsArray.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    console.log("Formatted slots for Bubble:", slotsArray);

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
  } catch (error) {
    console.error(`Error sending request for poll ${poll}:`, error.message);
  }
}

// Express route
router.post("/", async (req, res) => {
  console.log("Incoming request to /event with body:", req.body);

  const { slots, poll } = req.body;

  if (!slots || !poll) {
    console.error("Error: Missing required parameters");
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    await sendRequest(slots, poll);
    return res
      .status(200)
      .json({ message: "Slots successfully created", slots });
  } catch (err) {
    console.error("Error in event route:", err.message || err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
