const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();
import { handleAccessTokenFlow } from "./googleTokenUtils.js";
// --------------------------------------
// 1) REFRESH ACCESS TOKEN IF NECESSARY
//    (COMBINED WITH TOKEN VALIDATION)
// --------------------------------------
async function getValidAccessTokenAndNotifyBubble(
  currentAccessToken,
  refreshToken,
  userId
) {
  try {
    // Call the wrapper function to handle the entire process
    const tokenData = await handleAccessTokenFlow(
      currentAccessToken,
      refreshToken,
      userId,
      null
    );

    console.log("Token management process completed successfully.", tokenData);

    return tokenData;
  } catch (error) {
    console.error(
      "Error in getValidAccessTokenAndNotifyBubble:",
      error.message
    );
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
// 3) START NEW SUBSCRIPTION (AND NOTIFY BUBBLE)
// --------------------------------------
async function startNewSubscription(accessToken, userId) {
  // Bubble endpoint to notify about new subscription
  const BUBBLE_SUBSCRIPTION_ENDPOINT =
    "https://startupcorners.com/api/1.1/wf/receiveSubscriptionInfo";

  try {
    const watchResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Unique channel ID
          id: `channel-${Date.now()}`,
          type: "webhook",
          address: "https://agora-new.vercel.app/webhook",
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

    // Notify Bubble about the new subscription
    const bubblePayload = {
      userId,
      channelId: newSubscription.id,
      resourceId: newSubscription.resourceId,
      expiration: newSubscription.expiration,
    };

    const bubbleResponse = await fetch(BUBBLE_SUBSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bubblePayload),
    });

    if (!bubbleResponse.ok) {
      const bubbleError = await bubbleResponse.json();
      console.error("Error sending subscription info to Bubble:", bubbleError);
      throw new Error("Failed to notify Bubble about new subscription");
    }

    // Return the new subscription details
    return {
      channelId: newSubscription.id,
      resourceId: newSubscription.resourceId,
      expiration: newSubscription.expiration, // New expiration timestamp
    };
  } catch (error) {
    console.error("Error in startNewSubscription:", error);
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

    // 3) Start a new subscription
    const newSubscription = await startNewSubscription(
      validAccessToken,
      userId
    );

    // 4) Respond to the original requester with the new subscription
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
