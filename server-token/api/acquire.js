const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // Required to make HTTP requests from the backend
require("dotenv").config();

const APP_ID = process.env.APP_ID;
const CUSTOMER_ID = process.env.CUSTOMER_ID;
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Middleware to prevent caching
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

// Acquire resource from Agora Cloud Recording API
app.post("/acquire", async (req, res) => {
  const { channelName } = req.body;

  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  // Agora Cloud Recording acquire URL
  const url = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`;

  // Make the request to acquire resource
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
        uid: "your-uid", // UID for the recording service, can be any unique ID
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

// Root endpoint to check server status
app.get("/", (req, res) => {
  const now = new Date();
  const formattedDate = now.toISOString().replace(/T/, " ").replace(/\..+/, "");

  return res.json({
    status: "up",
    time: formattedDate,
  });
});

module.exports = app;
