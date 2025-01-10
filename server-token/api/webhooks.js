const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

/**
 * 1) GET VALID ACCESS TOKEN (AND REFRESH IF NECESSARY)
 *    - Instead of receiving accessToken/refreshToken from the request,
 *      we fetch them from Bubble using resourceId.
 */
async function getValidAccessTokenAndNotifyBubble(resourceId) {
  // 1) Retrieve tokens from Bubble via resourceId
  const getTokensUrl = "https://startupcorners.com/api/1.1/wf/getTokens"; // Bubble endpoint
  const tokenRefreshUrl = "https://oauth2.googleapis.com/token";
  const bubbleNotifyUrl =
    "https://startupcorners.com/api/1.1/wf/receiveTokenInfo"; // for updated token info

  let currentAccessToken;
  let currentRefreshToken;
  let userId; // Assuming Bubble also returns user info if needed

  // Step A: Fetch tokens from Bubble
  try {
    const bubbleResponse = await fetch(getTokensUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId }),
    });

    if (!bubbleResponse.ok) {
      const bubbleError = await bubbleResponse.text();
      console.error("Error retrieving tokens from Bubble:", bubbleError);
      throw new Error("Failed to retrieve tokens from Bubble");
    }

    const tokenData = await bubbleResponse.json();
    currentAccessToken = tokenData.accessToken;
    currentRefreshToken = tokenData.refreshToken;
    userId = tokenData.userId; // If Bubble returns userId here
  } catch (err) {
    console.error("Error in retrieving tokens from Bubble:", err.message);
    throw err;
  }

  // Step B: Validate current access token
  let testResponseOk = false;
  try {
    const testResponse = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${currentAccessToken}`
    );
    if (testResponse.ok) {
      // Token is still valid
      testResponseOk = true;
    } else {
      console.warn("Access token invalid or expired. Will refresh now...");
    }
  } catch (error) {
    console.warn("Error verifying token. Will refresh now...", error);
  }

  if (testResponseOk) {
    // No refresh needed, just return what we have
    console.log("Access token is valid. No need to refresh.");
    return {
      accessToken: currentAccessToken,
      refreshToken: currentRefreshToken,
      userId,
      accessTokenExpiration: null, // We have no new expiration if it's still valid
    };
  }

  // Step C: Refresh token if necessary
  try {
    const response = await fetch(tokenRefreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: currentRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    const refreshedData = await response.json();
    if (!refreshedData.access_token) {
      console.error("Error refreshing token:", refreshedData);
      throw new Error("Failed to refresh access token");
    }

    // Calculate new expiration
    const newAccessTokenExpiration =
      Date.now() + refreshedData.expires_in * 1000;
    // If Google returns a new refresh token, use it; otherwise keep the old one
    const updatedRefreshToken =
      refreshedData.refresh_token || currentRefreshToken;

    // Step D: Notify Bubble about the new token
    const bubblePayload = {
      userId, // only if relevant
      resourceId,
      accessToken: refreshedData.access_token,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    };

    const bubbleUpdateResponse = await fetch(bubbleNotifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bubblePayload),
    });

    if (!bubbleUpdateResponse.ok) {
      const bubbleError = await bubbleUpdateResponse.json();
      console.error("Error sending new token info to Bubble:", bubbleError);
      throw new Error("Failed to notify Bubble about new token");
    }

    console.log("Successfully refreshed token and notified Bubble.");

    return {
      accessToken: refreshedData.access_token,
      refreshToken: updatedRefreshToken,
      userId,
      accessTokenExpiration: newAccessTokenExpiration,
    };
  } catch (error) {
    console.error("Error in refreshing token:", error);
    throw error;
  }
}

/**
 * 2) FETCH UPDATED EVENTS (AND SEND EVENT INFO TO BUBBLE)
 *    - Expects a VALID access token from getValidAccessTokenAndNotifyBubble
 *    - Also needs resourceId to know which calendar resource this is about.
 */
async function fetchUpdatedEvents(accessToken, resourceId) {
  try {
    // Step 1: Set updatedMin to the last 10 minutes
    const updatedMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Step 2: Fetch updated events from Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${updatedMin}&singleEvents=true&orderBy=startTime&showDeleted=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Even though we just validated or refreshed the token,
        // there's still a chance of token failure.
        throw new Error("TokenExpired");
      } else {
        const errorResult = await response.json();
        console.error("Error fetching events:", errorResult);
        throw new Error("Failed to fetch events from Google Calendar.");
      }
    }

    const result = await response.json();
    const events = result.items || [];

    // Step 3: Determine event status (deleted or added/updated)
    const actions = events.map((event) => {
      const isFromMyPlatform =
        event.extendedProperties &&
        event.extendedProperties.private &&
        event.extendedProperties.private.source === "SC";

      // Skip events originally created by this platform
      if (isFromMyPlatform) return null;

      if (event.status === "cancelled") {
        return { id: event.id, status: "deleted" };
      }

      // For all other cases, treat as "addedOrUpdated"
      return { id: event.id, status: "addedOrUpdated", data: event };
    });

    // Filter out null actions
    const meaningfulActions = actions.filter((action) => action !== null);

    // Step 4: Send each event’s action to Bubble
    for (const eventAction of meaningfulActions) {
      const { id: iD, status, data } = eventAction;
      // Extract start and end times for added/updated events
      const start = data?.start?.dateTime || data?.start?.date || null;
      const end = data?.end?.dateTime || data?.end?.date || null;

      const bubbleResponse = await fetch(
        "https://startupcorners.com/api/1.1/wf/receiveEventInfo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            iD,
            start,
            end,
            action: status, // "deleted" or "addedOrUpdated"
            resourceId,
          }),
        }
      );

      if (!bubbleResponse.ok) {
        const bubbleError = await bubbleResponse.text();
        console.error(`Error sending event ${iD} to Bubble:`, bubbleError);
      } else {
        console.log(`Event ${iD} ("${status}") sent to Bubble successfully.`);
      }
    }

    // (Optional) Return the list of processed actions if you need it
    return meaningfulActions;
  } catch (error) {
    console.error("Error in fetchUpdatedEvents:", error.message);
    // Return empty array or rethrow, depending on your needs
    return [];
  }
}

/**
 * 3) WEBHOOK ENDPOINT to handle Google Calendar push notifications
 *    - The key here is: we do NOT expect accessToken or refreshToken in the body.
 *    - We DO expect to read resourceId from headers (x-goog-resource-id).
 *    - Then we call getValidAccessTokenAndNotifyBubble(resourceId),
 *      which fetches tokens from Bubble, validates/refreshes,
 *      then fetches updated events from Google with the valid token.
 */
router.post("/", async (req, res) => {
  const channelId = req.headers["x-goog-channel-id"];
  const resourceId = req.headers["x-goog-resource-id"];
  const resourceState = req.headers["x-goog-resource-state"];
  const expiration = req.headers["x-goog-channel-expiration"]; // optional usage

  console.log("Push Notification Received:");
  console.log(`Channel ID: ${channelId}`);
  console.log(`Resource ID: ${resourceId}`);
  console.log(`Resource State: ${resourceState}`);
  console.log(`Expiration: ${expiration}`);

  if (!channelId || !resourceId || !resourceState) {
    console.error("Missing required parameters in headers.");
    return res.status(400).send("Missing required parameters in headers.");
  }

  try {
    // 1) Retrieve valid token from Bubble (refresh if needed)
    const {
      accessToken: validAccessToken,
      refreshToken: updatedRefreshToken,
      userId, // If you need it for logging or future expansions
    } = await getValidAccessTokenAndNotifyBubble(resourceId);

    // 2) If resourceState is 'exists' or 'sync', fetch updated events
    if (resourceState === "exists" || resourceState === "sync") {
      await fetchUpdatedEvents(validAccessToken, resourceId);
    }

    // 3) Send back a 200 to acknowledge Google’s push notification
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook notification:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
