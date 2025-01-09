const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

async function renewCalendarWatch(
  channelId,
  resourceId,
  accessToken,
  webhookUrl
) {
  try {
    // Step 1: Stop the existing subscription
    const stopResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/channels/stop",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          resourceId: resourceId,
        }),
      }
    );

    if (!stopResponse.ok) {
      const stopError = await stopResponse.json();
      console.error("Error stopping subscription:", stopError);
      throw new Error("Failed to stop subscription");
    }
    console.log(`Stopped subscription for channel ${channelId}`);

    // Step 2: Start a new subscription
    const watchResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: `channel-${Date.now()}`, // Generate a new unique channel ID
          type: "webhook",
          address: webhookUrl, // Your webhook URL
        }),
      }
    );

    if (!watchResponse.ok) {
      const watchError = await watchResponse.json();
      console.error("Error starting new subscription:", watchError);
      throw new Error("Failed to start new subscription");
    }

    const newSubscription = await watchResponse.json();
    console.log("New subscription started:", newSubscription);

    // Return the new subscription details
    return {
      channelId: newSubscription.id,
      resourceId: newSubscription.resourceId,
      expiration: newSubscription.expiration, // New expiration timestamp
    };
  } catch (error) {
    console.error("Error renewing calendar watch:", error);
    throw error;
  }
}

router.post("/", async (req, res) => {
  const {
    channelId,
    resourceId,
    accessToken,
    refreshToken,
    webhookUrl,
    userId,
  } = req.body;

  if (!channelId || !resourceId || !refreshToken || !webhookUrl || !userId) {
    return res.status(400).send("Missing required parameters");
  }

  let validAccessToken = accessToken;
  let newAccessTokenExpiration = null; // To store new token expiration
  let updatedRefreshToken = refreshToken; // Default to the old refresh token

  try {
    // Step 1: Refresh the token if necessary
    try {
      const testResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" +
          validAccessToken
      );
      if (!testResponse.ok) {
        throw new Error("Access token expired or invalid.");
      }
    } catch (error) {
      console.warn("Access token expired. Refreshing token...");
      const tokenData = await refreshAccessToken(refreshToken); // Call refresh logic
      validAccessToken = tokenData.access_token; // Update the valid access token
      newAccessTokenExpiration = Date.now() + tokenData.expires_in * 1000; // Calculate new expiration time

      // Check if a new refresh token is provided
      if (tokenData.refresh_token) {
        updatedRefreshToken = tokenData.refresh_token;
      }
    }

    // Step 2: Renew the subscription
    const newSubscription = await renewCalendarWatch(
      channelId,
      resourceId,
      validAccessToken,
      webhookUrl
    );

    // Step 3: Send new data back to Bubble as query parameters
    const bubbleUrl = new URL(
      "https://startupcorners.com/api/1.1/wf/receiveNewInfo"
    );
    bubbleUrl.searchParams.append("userId", userId);
    bubbleUrl.searchParams.append("channelId", newSubscription.channelId);
    bubbleUrl.searchParams.append("resourceId", newSubscription.resourceId);
    bubbleUrl.searchParams.append("expiration", newSubscription.expiration);
    bubbleUrl.searchParams.append("accessToken", validAccessToken);
    bubbleUrl.searchParams.append(
      "accessTokenExpiration",
      newAccessTokenExpiration
    );
    bubbleUrl.searchParams.append("refreshToken", updatedRefreshToken);

    const bubbleResponse = await fetch(bubbleUrl.toString(), { method: "GET" });

    if (!bubbleResponse.ok) {
      const bubbleError = await bubbleResponse.json();
      console.error("Error sending data to Bubble:", bubbleError);
      throw new Error("Failed to send data to Bubble");
    }

    console.log("Data sent to Bubble successfully");

    // Send back the new subscription details to the original request
    res.status(200).json(newSubscription);
  } catch (error) {
    console.error("Error in renew-watch:", error.message);
    res.status(500).send(error.message);
  }
});

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

module.exports = router;
