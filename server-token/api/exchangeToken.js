const express = require("express");
const fetch = require("node-fetch"); // Required for external API calls
const router = express.Router();

// POST /exchange-token
router.post("/", async (req, res) => {
  const { code } = req.body; // Extract authorization code from the request body

  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Authorization code is required" });
  }

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Add this to your .env file
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // Add this to your .env file
  const REDIRECT_URI = "https://www.startupcorners.com/oauth-callback"; // Update as needed
  const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await response.json();

    if (tokenData.access_token) {
      // Success: Send the tokens back to the frontend
      res.json({ success: true, token: tokenData });
    } else {
      // Error from Google
      res.status(400).json({ success: false, error: tokenData });
    }
  } catch (error) {
    console.error("Error exchanging token:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
