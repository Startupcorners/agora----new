const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const APP_ID = process.env.APP_ID;
const CUSTOMER_ID = process.env.CUSTOMER_ID;
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Acquire resource from Agora Cloud Recording API
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  // Validate the request body
  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  // Log the request data for debugging
  console.log("Acquiring resource for channel:", channelName, "with uid:", uid);

  // Agora Cloud Recording acquire URL
  const url = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`;

  try {
    // Send the POST request to Agora to acquire the resource
    const response = await axios.post(
      url,
      {
        cname: channelName, // Channel name
        uid: uid, // Recording service UID
        clientRequest: {}, // No additional parameters required here
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${CUSTOMER_ID}:${CUSTOMER_SECRET}`
          ).toString("base64")}`, // Base64-encoded authorization header
          "Content-Type": "application/json",
        },
      }
    );

    // Log the response from Agora
    console.log("Acquired resource with resourceId:", response.data.resourceId);

    // Send the acquired resourceId to the client
    res.json({ resourceId: response.data.resourceId });
  } catch (error) {
    // Log the error for debugging
    console.error(
      "Error acquiring resource:",
      error.response ? error.response.data : error.message
    );

    // Handle specific Agora API error response
    if (error.response && error.response.data) {
      return res.status(error.response.status).json({
        error: error.response.data,
      });
    }

    // Fallback for other errors
    res.status(500).json({ error: "Failed to acquire resource" });
  }
});

// Export the app as a module
module.exports = app;
