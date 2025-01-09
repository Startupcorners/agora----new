const fetch = require("node-fetch");
const express = require("express");
const router = express.Router();

// Core function for refreshing tokens
async function refreshAccessToken(refreshToken) {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await response.json();

    if (tokenData.access_token) {
      return tokenData; // Return the full token data (access_token, expires_in, etc.)
    } else {
      console.error("Error refreshing token:", tokenData);
      throw new Error("Failed to refresh access token");
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
}

// Route for refreshing tokens via POST request
router.post("/", async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res
      .status(400)
      .json({ success: false, error: "Refresh token is required" });
  }

  try {
    const tokenData = await refreshAccessToken(refresh_token);
    res.json({ success: true, token: tokenData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; // Export both the route and the core function
