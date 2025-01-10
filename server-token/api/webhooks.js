const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// Webhook to handle push notifications
router.post("/", async (req, res) => {
  const channelId = req.headers["x-goog-channel-id"];
  const resourceId = req.headers["x-goog-resource-id"];
  const resourceState = req.headers["x-goog-resource-state"];
  const expiration = req.headers["x-goog-channel-expiration"]; // Optional: depends on setup

  console.log("Push Notification Received:");
  console.log(`Channel ID: ${channelId}`);
  console.log(`Resource ID: ${resourceId}`);
  console.log(`Resource State: ${resourceState}`);
  console.log(`Expiration: ${expiration}`);

  if (!channelId || !resourceId || !resourceState) {
    console.error("Missing required parameters.");
    return res.status(400).send("Missing required parameters.");
  }

  try {
    // Fetch updated events if resourceState is `exists` or `sync`
    if (resourceState === "exists" || resourceState === "sync") {
      const updatedEvents = await fetchUpdatedEvents(resourceId); // Call your fetch function

      if (updatedEvents && updatedEvents.length > 0) {
        // Loop through each event and send its action to Bubble
        for (const event of updatedEvents) {
          const { id: iD, status, data } = event;

          // Extract start and end times for added/updated events
          const start = data?.start?.dateTime || data?.start?.date || null; // Handle all-day events or null for deleted events
          const end = data?.end?.dateTime || data?.end?.date || null; // Handle all-day events or null for deleted events

          // Send event data to Bubble
          const bubbleResponse = await fetch(
            "https://startupcorners.com/api/1.1/wf/receiveEventInfo",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                iD,
                start,
                end,
                action: status, // Use the new status directly (deleted, added, updated)
                resourceId,
              }),
            }
          );

          if (!bubbleResponse.ok) {
            const bubbleError = await bubbleResponse.text();
            console.error(`Error sending event ${iD} to Bubble:`, bubbleError);
          } else {
            console.log(
              `Event ${iD} with action "${status}" sent to Bubble successfully.`
            );
          }
        }
      } else {
        console.log("No updated events to process.");
      }
    }

    res.sendStatus(200); // Acknowledge the notification
  } catch (error) {
    console.error("Error processing webhook notification:", error.message);
    res.status(500).send("Internal Server Error");
  }
});



async function fetchUpdatedEvents(resourceId) {
  if (!resourceId) {
    console.error("resourceId is required to fetch updated events.");
    return [];
  }

  try {
    // Step 1: Retrieve tokens from Bubble
    const bubbleResponse = await fetch(
      "https://startupcorners.com/api/1.1/wf/getTokens", // Bubble endpoint
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resourceId }), // Pass resourceId in the request body
      }
    );

    if (!bubbleResponse.ok) {
      const bubbleError = await bubbleResponse.text();
      console.error("Error retrieving tokens from Bubble:", bubbleError);
      throw new Error("Failed to retrieve tokens from Bubble");
    }

    const { accessToken, refreshToken } = await bubbleResponse.json();

    if (!accessToken || !refreshToken) {
      console.error("Missing tokens retrieved from Bubble.");
      throw new Error("Invalid tokens from Bubble");
    }

    // Step 2: Set updatedMin to the last 10 minutes
    const updatedMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Function to fetch events with a given token
    const fetchEvents = async (token) => {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${updatedMin}&singleEvents=true&orderBy=startTime&showDeleted=true`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("TokenExpired");
        } else {
          const errorResult = await response.json();
          console.error("Error fetching events:", errorResult);
          throw new Error("Failed to fetch events from Google Calendar.");
        }
      }

      const result = await response.json();
      return result.items || [];
    };

    // Step 3: Fetch updated events with the current token
    let events;
    try {
      events = await fetchEvents(accessToken);
    } catch (error) {
      if (error.message === "TokenExpired") {
        console.warn("Access token expired. Attempting to refresh token...");

        // Step 4: Refresh the token
        const newTokenData = await refreshAccessToken(refreshToken);
        if (!newTokenData.access_token) {
          throw new Error("Failed to refresh access token");
        }

        const newAccessToken = newTokenData.access_token;

        // Update the refreshed token back to Bubble
        await fetch("https://startupcorners.com/api/1.1/wf/updateTokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resourceId,
            accessToken: newAccessToken,
            refreshToken: newTokenData.refresh_token || refreshToken, // Update if a new refresh token is issued
            expiration: Date.now() + newTokenData.expires_in * 1000,
          }),
        });

        // Retry fetching events with the refreshed token
        events = await fetchEvents(newAccessToken);
      } else {
        throw error;
      }
    }

    // Step 5: Determine event status (deleted/addedOrUpdated)
    const actions = events.map((event) => {
      const isFromMyPlatform =
        event.extendedProperties &&
        event.extendedProperties.private &&
        event.extendedProperties.private.source === "SC";

      if (isFromMyPlatform) return null; // Skip events from your platform

      if (event.status === "cancelled") {
        return { id: event.id, status: "deleted" };
      }

      // For all other cases, treat the event as "addedOrUpdated"
      return { id: event.id, status: "addedOrUpdated", data: event };
    });

    // Filter out null actions
    const meaningfulActions = actions.filter((action) => action !== null);

    console.log("Processed Event Actions:", meaningfulActions);
    return meaningfulActions;
  } catch (error) {
    console.error("Error fetching updated events:", error.message);
    return [];
  }
}




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
