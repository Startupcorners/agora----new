const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const app = express();

app.use(bodyParser.json());

// Use environment variables for secure access
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://www.startupcorners.com/oauth-callback";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Endpoint to handle token exchange
app.post("/exchange-token", async (req, res) => {
  const { code } = req.body;

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
      console.log("Tokens received:", tokenData);
      res.json({ success: true, token: tokenData });
    } else {
      res.status(400).json({ success: false, error: tokenData });
    }
  } catch (error) {
    console.error("Error exchanging token:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Vercel automatically manages the port; no need to specify one
module.exports = app;
