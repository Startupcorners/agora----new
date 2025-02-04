const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

import { handleAccessTokenFlow } from "./googleTokenUtils.js";

export async function getValidAccessTokenAndNotifyBubble(resourceId) {
  try {
    console.log(
      `Initiating token management process for resourceId: ${resourceId}`
    );

    // Call the wrapper function to handle the entire process
    const tokenData = await handleAccessTokenFlow(
      null,
      null,
      null,
      resourceId
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



/**
 * 2) FETCH UPDATED EVENTS (AND SEND EVENT INFO TO BUBBLE)
 *    - Expects a VALID access token from getValidAccessTokenAndNotifyBubble
 *    - Also needs resourceId to know which calendar resource this is about.
 */
async function fetchUpdatedEvents(accessToken, resourceId, channelId) {
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
            channelId,
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
      await fetchUpdatedEvents(validAccessToken, resourceId, channelId);
    }

    // 3) Send back a 200 to acknowledge Google’s push notification
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook notification:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
