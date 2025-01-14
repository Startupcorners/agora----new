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
  const GOOGLE_EVENTS_API =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  try {
    let response;

    switch (action) {
      case "add":
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

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error(`Error in ${action} action:`, errorResponse);
      throw new Error(
        `Failed to ${action} event: ${errorResponse.message || "Unknown error"}`
      );
    }

    if (action === "delete") {
      return { message: "Event deleted successfully" };
    }

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
    return res.status(400).send("Missing required parameters");
  }

  try {
    const {
      accessToken: validAccessToken,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    } = await getValidAccessTokenAndNotifyBubble(
      accessToken,
      refreshToken,
      userId
    );

    const eventResponse = await handleEventAction(
      action,
      validAccessToken,
      eventId,
      eventDetails
    );

    if (action === "add" || action === "update") {
      return res.status(200).json({
        message: `${action} action completed successfully`,
        eventId: eventResponse.id,
        eventData: eventResponse,
      });
    }

    res.status(200).json({
      message: "Event deleted successfully",
    });
  } catch (err) {
    console.error("Error in event route:", err.message);
    res.status(500).send(err.message);
  }
});

module.exports = router;
