const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fetch = require("node-fetch"); // Required to make HTTP requests from the backend
require("dotenv").config();
console.log('Customer ID:', process.env.CUSTOMER_ID);
console.log('Customer Secret:', process.env.CUSTOMER_SECRET);  // Only use this for debugging and remove it later for security reasons


const APP_ID = process.env.APP_ID;
const CUSTOMER_ID = process.env.CUSTOMER_ID;
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Acquire resource from Agora Cloud Recording API
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  // Agora Cloud Recording acquire URL
  const url = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${CUSTOMER_ID}:${CUSTOMER_SECRET}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cname: channelName,
        uid: uid, // UID for the recording service
        clientRequest: {},
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Successfully acquired the resource
      console.log("Acquired resource:", data);
      return res.json({ resourceId: data.resourceId });
    } else {
      // Handle errors returned by Agora
      console.error("Error acquiring resource from Agora:", data);
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error("Error making request to Agora:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Export the app as a module
module.exports = app;
