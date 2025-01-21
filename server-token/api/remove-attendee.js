const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// Function to fetch events with a specific attendee email
async function getEventsWithAttendee(accessToken, attendeeEmail) {
  const GOOGLE_EVENTS_API = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  try {
    const response = await fetch(`${GOOGLE_EVENTS_API}?maxResults=2500`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log("No events found.");
      return [];
    }

    // Filter events by attendee email
    const filteredEvents = data.items.filter((event) =>
      event.attendees?.some((attendee) => attendee.email === attendeeEmail)
    );

    console.log(
      `Found ${filteredEvents.length} events with attendee ${attendeeEmail}`
    );
    return filteredEvents;
  } catch (error) {
    console.error("Error fetching events:", error.message);
    throw error;
  }
}

// Function to remove an attendee from events
async function removeAttendeeFromEvents(
  accessToken,
  eventsToProcess,
  attendeeEmail
) {
  if (eventsToProcess.length === 0) {
    console.log("No events found for attendee removal.");
    return;
  }

  for (const event of eventsToProcess) {
    // Remove the attendee from the event
    event.attendees = event.attendees.filter(
      (attendee) => attendee.email !== attendeeEmail
    );

    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`;

    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (updateResponse.ok) {
      console.log(`Removed attendee from event with ID: ${event.id}`);
    } else {
      console.error(
        `Failed to update event ${event.id}: ${updateResponse.statusText}`
      );
    }
  }

  console.log(
    `Processed ${eventsToProcess.length} events for attendee removal.`
  );
}

// Function to get access token from Bubble API
async function getAccessTokenFromBubble(userId) {
  const BUBBLE_API_URL = "https://startupcorners.com/api/1.1/wf/getAccessToken";

  try {
    const response = await fetch(
      `${BUBBLE_API_URL}?userId=${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to retrieve access token from Bubble: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data || !data.accessToken) {
      throw new Error("Invalid response format from Bubble API");
    }

    console.log(
      "Access token retrieved from Bubble successfully:",
      data.accessToken
    );
    return data.accessToken;
  } catch (error) {
    console.error("Error retrieving access token from Bubble:", error.message);
    throw error;
  }
}

// Function to validate and refresh access token
async function getValidAccessTokenAndNotifyBubble(
  currentAccessToken,
  refreshToken,
  userId
) {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
  const BUBBLE_TOKEN_ENDPOINT =
    "https://startupcorners.com/api/1.1/wf/receiveTokenInfo";

  try {
    // Verify the current access token
    const testResponse = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${currentAccessToken}`
    );

    if (testResponse.ok) {
      console.log("Access token is valid. No need to refresh.");
      return {
        accessToken: currentAccessToken,
        refreshToken,
        accessTokenExpiration: null,
      };
    } else {
      console.warn("Access token invalid or expired. Refreshing...");
    }
  } catch (error) {
    console.warn("Error verifying token. Attempting to refresh...", error);
  }

  // Refresh the token
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

    const newAccessTokenExpiration = Date.now() + tokenData.expires_in * 1000;
    const updatedRefreshToken = tokenData.refresh_token || refreshToken;

    // Notify Bubble about the new token
    const bubblePayload = {
      userId,
      accessToken: tokenData.access_token,
      accessTokenExpiration: newAccessTokenExpiration,
      refreshToken: updatedRefreshToken,
    };

    const bubbleResponse = await fetch(BUBBLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bubblePayload),
    });

    if (!bubbleResponse.ok) {
      console.error("Error sending new token info to Bubble.");
      throw new Error("Failed to notify Bubble about new token");
    }

    console.log("Successfully refreshed token and notified Bubble.");
    return {
      accessToken: tokenData.access_token,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
}

// Express route handler
router.post("/", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Missing email parameter" });
  }

  try {
    // Retrieve user ID and refresh token from environment variables
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_CALENDAR;
    const userId = process.env.MAIN_USERID;

    if (!refreshToken || !userId) {
      throw new Error(
        "Missing environment variables for userId or refresh token."
      );
    }

    // Call Bubble API to get the current access token
    let mainAccessToken = await getAccessTokenFromBubble(userId);

    // Validate and refresh the access token if needed
    const { accessToken: validAccessToken } =
      await getValidAccessTokenAndNotifyBubble(
        mainAccessToken,
        refreshToken,
        userId
      );

    console.log(
      "Valid access token received:",
      validAccessToken ? "Yes" : "No"
    );

    // Fetch events with the given attendee email
    const eventsToProcess = await getEventsWithAttendee(
      validAccessToken,
      email
    );

    // Remove attendee from the events
    await removeAttendeeFromEvents(validAccessToken, eventsToProcess, email);

    res.status(200).json({
      message: `Removed attendee from ${eventsToProcess.length} events for email: ${email}`,
    });
  } catch (err) {
    console.error("Error in event route:", err.message || err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
