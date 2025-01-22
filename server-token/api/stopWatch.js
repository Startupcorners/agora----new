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

    // 4) Stop existing subscription
    await stopSubscription(channelId, resourceId, validAccessToken);

    // 5) Respond to the original requester with success message
    res.status(200).json({
      message: "OK - Calendar deleted (if existed) and subscription stopped.",
    });
  } catch (err) {
    console.error("Error in renew-watch route:", err.message);
    res.status(500).send(err.message);
  }
});

module.exports = router;

