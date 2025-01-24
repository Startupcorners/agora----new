const express = require("express");
const fetch = require("node-fetch"); // Required for external API calls
const router = express.Router();

// OpenAI API key (replace with your own)
const OPENAI_API_KEY = process.env.OPEN_AI_KEY;
const bubbleApiUrl = "https://sccopy-38403.bubbleapps.io/api/1.1/wf/newpoll";

// Function to call OpenAI API
async function getSuggestedSlots(availabilities, bookedSlots, duration) {
  const apiUrl = "https://api.openai.com/v1/chat/completions";

  // Define the request payload
  const requestData = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that processes availability data to suggest suitable time slots. Your task is to provide exactly 20 slots of ${duration} that align as closely as possible with user availability settings while avoiding the provided booked slots. Ensure that all suggested slots fall within the next 7 days from today.
        
        Your response must strictly follow this format without any additional comments or explanations:
        2025-02-01T09:00:00Z_2025-02-01T10:00:00Z,2025-02-01T13:00:00Z_2025-02-01T14:00:00Z,...
        
        Each date should be represented in ISO 8601 format and separated by commas, ensuring there are exactly 20 entries.`,
      },
      {
        role: "user",
        content: `Here are the availability settings of the users: ${availabilities}. 
        Slots that should not be suggested (already booked): ${bookedSlots}. 
        
        Please suggest exactly 20 possible ${duration} slots that best fit the availability settings while avoiding the booked slots and ensuring they fall within the next 7 days. Provide the response in the specified format.`,
      },
    ],
    max_tokens: 16384,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    // Extract and return the response text
    return data.choices[0]?.message?.content || "No response received";
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

// Function to send a POST request to Bubble API
async function sendRequest(slotsString, poll) {
  try {
    // Step 1: Split the OpenAI response string into individual date ranges
    let slotPairs = slotsString.split(",").map((slot) => slot.trim());

    // Step 2: Flatten the slot pairs into a single array of individual dates
    let slotsArray = slotPairs.flatMap((slot) =>
      slot.split("_").map((s) => s.trim())
    );

    // Step 3: Sort the dates from earliest to latest
    slotsArray.sort((a, b) => new Date(a) - new Date(b));

    console.log("Formatted slots for Bubble:", slotsArray);

    // Step 4: Send the reformatted array to Bubble
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
    console.error(
      `Error sending request with slots: ${JSON.stringify(slotsArray)}`
    );
    console.error(error);
  }
}




// Express route
router.post("/", async (req, res) => {
  console.log("Incoming request to /event with body:", req.body);

  const { availabilities, bookedSlots, duration, poll } = req.body;

  // Check for required parameters
  if (!availabilities || !bookedSlots || !duration || !poll) {
    console.error("Error: Missing required parameters");
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const slots = await getSuggestedSlots(
      availabilities,
      bookedSlots,
      duration
    );
    if (!slots || slots === "No response received") {
      throw new Error("Failed to get slots from OpenAI");
    }

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
