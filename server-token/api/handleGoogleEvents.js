const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();
import { handleAccessTokenFlow } from "./googleTokenUtils.js";



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


async function handleEventAction(
  accessToken,
  calendarId,
  action,
  eventId,
  eventDetails
) {
  const GOOGLE_EVENTS_API = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events`;

  try {
    if (!accessToken) {
      throw new Error("Missing access token.");
    }

    if (!calendarId) {
      throw new Error("Missing calendar ID.");
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




router.post("/", async (req, res) => {
  console.log("Incoming request to /event with body:", req.body);

  const {
    receivedAccessToken,
    receivedRefreshToken,
    calendarId,
    userId,
    action,
    eventId,
    eventDetails,
  } = req.body;

  // Check for required parameters
  if (!action) {
    console.error("Error: Missing required 'action' parameter");
    return res.status(400).json({ error: "Missing required parameters" });
  }

  console.log("Received parameters:");
  console.log("  receivedAccessToken:", receivedAccessToken ? "Yes" : "No");
  console.log("  receivedRefreshToken:", receivedRefreshToken ? "Yes" : "No");
  console.log("  calendarId:", calendarId || "N/A");
  console.log("  userId:", userId || "N/A");
  console.log("  action:", action);
  console.log("  eventId:", eventId || "N/A");
  console.log("  eventDetails:", eventDetails || "N/A");

  try {
    // Step 1: Retrieve user ID and refresh token from request
    const refreshToken = receivedRefreshToken;
    let mainAccessToken = receivedAccessToken;

    console.log("Step 1: Retrieved refresh token and access token.");

    // Step 2: Validate and refresh the access token if needed
    console.log("Step 2: Validating access token...");

    const {
      accessToken: validAccessToken,
      refreshToken: updatedRefreshToken,
      accessTokenExpiration: newAccessTokenExpiration,
    } = await getValidAccessTokenAndNotifyBubble(
      mainAccessToken,
      refreshToken, // Use received refresh token
      userId
    );

    console.log(
      "Step 2 completed: Valid access token received:",
      validAccessToken ? "Yes" : "No"
    );
    console.log("  Updated refresh token:", updatedRefreshToken || "No update");
    console.log("  New expiration time:", newAccessTokenExpiration || "N/A");

    // Step 3: Handle event actions (add, update, delete)
    console.log(
      `Step 3: Handling action '${action}' for event ID: ${eventId || "N/A"}`
    );

    const eventResponse = await handleEventAction(
      validAccessToken,
      calendarId,
      action,
      eventId,
      eventDetails
    );

    let message;
    if (action === "add" || action === "update") {
      message = `${action} action completed successfully`;
      console.log("Step 3 success:", message);
      return res.status(200).json({
        message,
        eventId: eventResponse.id,
        eventData: eventResponse,
      });
    } else if (action === "delete") {
      message = "Event deleted successfully";
      console.log("Step 3 success:", message);
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

