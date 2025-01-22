const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();


async function deleteStartupCornersCalendar(accessToken, calendarId) {
  const GOOGLE_CALENDAR_API = `https://www.googleapis.com/calendar/v3/calendars`;

  try {
    if (!calendarId) {
      throw new Error("Calendar ID is required to delete a calendar.");
    }

    console.log(`Deleting calendar with ID: ${calendarId}`);

    // Step 1: Delete the calendar using the provided calendar ID
    const deleteResponse = await fetch(
      `${GOOGLE_CALENDAR_API}/${encodeURIComponent(calendarId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      throw new Error(
        `Failed to delete calendar with ID ${calendarId}: ${deleteResponse.statusText}`
      );
    }

    console.log(`Calendar with ID ${calendarId} deleted successfully.`);
  } catch (error) {
    console.error(
      `Error deleting calendar with ID ${calendarId}:`,
      error.message
    );
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
  const { userId, mainAccessToken, refreshToken, calendarId } = req.body;

  try {

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


    await deleteStartupCornersCalendar(
      validAccessToken,
      calendarId
    );

    res.status(200).json({
      message: `Removed attendee from ${eventsToProcess.length} events for email: ${email}`,
    });
  } catch (err) {
    console.error("Error in event route:", err.message || err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
