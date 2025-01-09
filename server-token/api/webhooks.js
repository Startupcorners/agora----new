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
        // Loop through each event and send it individually to Bubble
        for (const event of updatedEvents) {
          const iD = event.id;
          const start = event.start.dateTime || event.start.date; // Support all-day events
          const end = event.end.dateTime || event.end.date; // Support all-day events
          const action = event.status === "cancelled" ? "deleted" : "updated";

          // Send individual event data to Bubble
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
                action,
                resourceId,
              }),
            }
          );

          if (!bubbleResponse.ok) {
            const bubbleError = await bubbleResponse.text();
            console.error(`Error sending event ${iD} to Bubble:`, bubbleError);
          } else {
            console.log(`Event ${iD} sent to Bubble successfully.`);
          }
        }
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

    // Step 3: Fetch updated events from Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${updatedMin}&singleEvents=true&orderBy=startTime`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log("Fetched updated events:", result.items);
      return result.items || []; // Return the list of events
    } else if (response.status === 401) {
      // Step 4: Token expired; refresh the token
      console.warn("Access token expired. Attempting to refresh token...");
      const newTokenData = await refreshAccessToken(refreshToken);

      if (!newTokenData.access_token) {
        throw new Error("Failed to refresh access token");
      }

      // Step 5: Retry fetching events with the new access token
      const newAccessToken = newTokenData.access_token;

      const retryResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${updatedMin}&singleEvents=true&orderBy=startTime`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (retryResponse.ok) {
        const retryResult = await retryResponse.json();

        // Step 6: Update the refreshed token back to Bubble
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

        console.log(
          "Fetched updated events after token refresh:",
          retryResult.items
        );
        return retryResult.items || [];
      } else {
        const retryError = await retryResponse.json();
        console.error("Error fetching events after token refresh:", retryError);
        throw new Error("Failed to fetch events after refreshing token");
      }
    } else {
      const errorResult = await response.json();
      console.error("Error fetching events:", errorResult);
      return [];
    }
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
