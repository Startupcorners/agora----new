const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// --------------------------------------
// 1) REFRESH ACCESS TOKEN IF NECESSARY
//    (COMBINED WITH TOKEN VALIDATION)
// --------------------------------------
async function getValidAccessTokenAndNotifyBubble(
  currentAccessToken,
  refreshToken,
  userId
) {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
  // Bubble endpoint to notify about new token data, if refreshed
  const BUBBLE_TOKEN_ENDPOINT =
    "https://startupcorners.com/api/1.1/wf/receiveTokenInfo";

  // 1) TEST CURRENT ACCESS TOKEN
  try {
    const testResponse = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${currentAccessToken}`
    );

    if (testResponse.ok) {
      // Token is still valid; return early with existing token info
      console.log("Access token is valid. No need to refresh.");
      return {
        accessToken: currentAccessToken,
        refreshToken, // keep existing
        accessTokenExpiration: null, // We don't have a new expiration
      };
    } else {
      console.warn("Access token invalid or expired. Will refresh now...");
    }
  } catch (error) {
    console.warn("Error verifying token. Will refresh now...", error);
  }

  // 2) TOKEN IS INVALID -> REFRESH
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

    if (!tokenData.access_token) {
      console.error("Error refreshing token:", tokenData);
      throw new Error("Failed to refresh access token");
    }

    // Calculate new expiration
    const newAccessTokenExpiration = Date.now() + tokenData.expires_in * 1000;
    // If Google returns a new refresh token, use it; otherwise keep the old one
    const updatedRefreshToken = tokenData.refresh_token || refreshToken;

    // 2a) (Optional) Notify Bubble about the new token
    const bubblePayload = {
      userId,
      accessToken: tokenData.access_token,
      accessTokenExpiration: newAccessTokenExpiration,
      refreshToken: updatedRefreshToken,
    };

    const bubbleResponse = await fetch(BUBBLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bubblePayload),
    });

    if (!bubbleResponse.ok) {
      const bubbleError = await bubbleResponse.json();
      console.error("Error sending new token info to Bubble:", bubbleError);
      throw new Error("Failed to notify Bubble about new token");
    }

    console.log("Successfully refreshed token and notified Bubble.");

    return {
      accessToken: tokenData.access_token,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    };
  } catch (error) {
    console.error("Error in getValidAccessTokenAndNotifyBubble:", error);
    throw error;
  }
}

// --------------------------------------
// 2) STOP SUBSCRIPTION
// --------------------------------------
async function stopSubscription(channelId, resourceId, accessToken) {
  try {
    const response = await fetch(
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

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Error stopping subscription:", errorBody);
      throw new Error("Failed to stop subscription");
    }

    console.log(`Stopped subscription for channel ${channelId}`);
  } catch (error) {
    console.error("Error in stopSubscription:", error);
    throw error;
  }
}


// --------------------------------------
// ROUTE HANDLER
// --------------------------------------
router.post("/", async (req, res) => {
  const {
    channelId,
    resourceId,
    accessToken,
    refreshToken,
    userId,
  } = req.body;

  if (!channelId || !resourceId || !refreshToken || !userId) {
    return res.status(400).send("Missing required parameters");
  }

  try {
    // 1) Get valid access token (refresh if necessary, else early return)
    const {
      accessToken: validAccessToken,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    } = await getValidAccessTokenAndNotifyBubble(
      accessToken,
      refreshToken,
      userId
    );

    // 2) Stop existing subscription
    await stopSubscription(channelId, resourceId, validAccessToken);

    // 3) Respond to the original requester with the new subscription
    res.status(200).json({
      channelId: newSubscription.channelId,
      resourceId: newSubscription.resourceId,
      expiration: newSubscription.expiration,
      validAccessToken,
      newAccessTokenExpiration,
      updatedRefreshToken,
    });
  } catch (err) {
    console.error("Error in renew-watch route:", err.message);
    res.status(500).send(err.message);
  }
});

module.exports = router;
