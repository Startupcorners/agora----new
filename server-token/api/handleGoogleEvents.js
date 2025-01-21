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



async function handleEventAction(action, accessToken, eventId, eventDetails) {
  const GOOGLE_EVENTS_API = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  try {
    if (!accessToken) {
      throw new Error("Missing access token.");
    }

    if (!action || !["add", "update", "delete"].includes(action)) {
      throw new Error(
        "Invalid or missing action. Must be 'add', 'update', or 'delete'."
      );
    }

    let response;

    switch (action) {
      case "add":
        if (!eventDetails || typeof eventDetails !== "object") {
          throw new Error("Invalid event details provided for adding event.");
        }

        // Add an event with attendees and extended properties
        const eventWithAttendees = {
          ...eventDetails,
          attendees: eventDetails?.attendees || [], // Ensure attendees is always an array
          extendedProperties: {
            private: {
              source: "SC", // Identify events created by your app
            },
          },
        };

        console.log("Adding event with details:", eventWithAttendees);

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
        if (!eventId) {
          throw new Error("Missing eventId for delete action.");
        }

        console.log(`Deleting event with ID: ${eventId}`);

        response = await fetch(`${GOOGLE_EVENTS_API}/${eventId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        break;

      case "update":
        if (!eventId) {
          throw new Error("Missing eventId for update action.");
        }
        if (!eventDetails || typeof eventDetails !== "object") {
          throw new Error("Invalid event details provided for updating event.");
        }

        const updatedEventWithAttendees = {
          ...eventDetails,
          attendees: eventDetails?.attendees || [], // Ensure attendees is always an array
          extendedProperties: {
            private: {
              source: "SC",
            },
          },
        };

        console.log(
          `Updating event with ID: ${eventId} with details:`,
          updatedEventWithAttendees
        );

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
      console.log("Event deleted successfully.");
      return { message: "Event deleted successfully" };
    }

    // Return the response data for add/update actions
    const responseData = await response.json();
    console.log(`Successfully handled ${action} event:`, responseData);
    return responseData;
  } catch (error) {
    console.error(`Error in handleEventAction (${action}):`, error.message);
    throw error;
  }
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

    // Corrected: Check the correct structure based on the expected response
    if (!data || !data.accessToken) {
      throw new Error("Invalid response format from Bubble API");
    }

    console.log("Access token retrieved from Bubble successfully:", data.accessToken);
    return data.accessToken;
  } catch (error) {
    console.error("Error retrieving access token from Bubble:", error.message);
    throw error;
  }
}


router.post("/", async (req, res) => {
  const { action, eventId, eventDetails } = req.body;

  if (!action) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Step 1: Retrieve user ID and refresh token from environment variables
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_CALENDAR;
    const userId = process.env.MAIN_USERID;

    if (!refreshToken || !userId) {
      throw new Error(
        "Environment variables for userId or refresh token are missing."
      );
    }

    // Step 2: Call Bubble API to get the current access token
    let mainAccessToken = await getAccessTokenFromBubble(userId);

    // Step 3: Validate and refresh the access token if needed
    const {
      accessToken: validAccessToken,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    } = await getValidAccessTokenAndNotifyBubble(
      mainAccessToken,
      refreshToken, // Use environment variable refresh token
      userId
    );

    console.log(
      "Valid access token received:",
      validAccessToken ? "Yes" : "No"
    );

    // Step 4: Call the function to handle event actions
    console.log(`Handling ${action} action for event ID: ${eventId || "N/A"}`);
    const eventResponse = await handleEventAction(
      action,
      validAccessToken,
      eventId,
      eventDetails
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

