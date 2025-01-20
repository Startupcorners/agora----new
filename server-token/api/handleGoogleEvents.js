const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

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
    console.error("Error refreshing token:", error);
    throw error;
  }
}
const createCalendar = async (accessToken) => {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: "StartupCorners",
        timeZone: "UTC",
      }),
    }
  );

  const data = await response.json();
  console.log("Created calendar:", data);
  return data.id; // Save this ID to use for adding events
};



const getCalendarId = async (accessToken) => {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  const startupcornersCalendar = data.items.find(
    (cal) => cal.summary === "StartupCorners"
  );

  if (startupcornersCalendar) {
    console.log("Found Startupcorners Calendar ID:", startupcornersCalendar.id);
    return startupcornersCalendar.id;
  } else {
    console.error("Startupcorners calendar not found.");
    return null;
  }
};




async function handleEventAction(
  action,
  accessToken,
  eventId,
  eventDetails,
  calendarId
) {
  const GOOGLE_EVENTS_API = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  try {
    let response;

    switch (action) {
      case "add":
        // Add an event with attendees and extended properties
        const eventWithAttendees = {
          ...eventDetails,
          attendees: eventDetails.attendees || [],
          extendedProperties: {
            private: {
              source: "SC", // Identify events created by your app
            },
          },
        };

        response = await fetch(GOOGLE_EVENTS_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventWithAttendees),
        });
        break;

      case "delete":
        // Delete an event by ID
        if (!eventId) {
          throw new Error("Missing eventId for delete action");
        }

        response = await fetch(`${GOOGLE_EVENTS_API}/${eventId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        break;

      case "update":
        // Update an event with attendees and extended properties
        if (!eventId) {
          throw new Error("Missing eventId for update action");
        }

        const updatedEventWithAttendees = {
          ...eventDetails,
          attendees: eventDetails.attendees || [],
          extendedProperties: {
            private: {
              source: "SC",
            },
          },
        };

        response = await fetch(`${GOOGLE_EVENTS_API}/${eventId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedEventWithAttendees),
        });
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    // Check if the response is not OK
    if (!response.ok) {
      const errorResponse = await response.json();
      console.error(`Error in ${action} action:`, errorResponse);
      throw new Error(
        `Failed to ${action} event: ${errorResponse.message || "Unknown error"}`
      );
    }

    // Return specific messages for delete action
    if (action === "delete") {
      return { message: "Event deleted successfully" };
    }

    // Return the response data for add/update actions
    const responseData = await response.json();
    console.log(`Successfully handled ${action} event:`, responseData);
    return responseData;
  } catch (error) {
    console.error(`Error in handleEventAction (${action}):`, error);
    throw error;
  }
}


router.post("/", async (req, res) => {
  const { action, accessToken, refreshToken, userId, eventId, eventDetails } =
    req.body;

  if (!action || !accessToken || !refreshToken || !userId) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Step 1: Validate and refresh the access token
    const {
      accessToken: validAccessToken,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    } = await getValidAccessTokenAndNotifyBubble(
      accessToken,
      refreshToken,
      userId
    );

    console.log(
      "Valid access token received:",
      validAccessToken ? "Yes" : "No"
    );

    // Step 2: Always retrieve or create the StartupCorners calendar
    let calendarId = await getCalendarId(validAccessToken);

    if (!calendarId) {
      console.log("Startupcorners calendar not found. Creating a new one...");
      calendarId = await createCalendar(validAccessToken);
      if (!calendarId) {
        throw new Error("Failed to create Startupcorners calendar");
      }
      console.log("New Startupcorners calendar created with ID:", calendarId);
    }

    // Step 3: Call the function to handle event actions with the retrieved calendar ID
    console.log(`Handling ${action} action for event ID: ${eventId || "N/A"}`);
    const eventResponse = await handleEventAction(
      action,
      validAccessToken,
      eventId,
      eventDetails,
      calendarId
    );

    let message;
    if (action === "add" || action === "update") {
      message = `${action} action completed successfully`;
      return res.status(200).json({
        message,
        eventId: eventResponse.id,
        eventData: eventResponse,
      });
    } else if (action === "delete") {
      message = "Event deleted successfully";
      return res.status(200).json({ message });
    } else {
      throw new Error("Invalid action type");
    }
  } catch (err) {
    console.error("Error in event route:", err.message || err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
