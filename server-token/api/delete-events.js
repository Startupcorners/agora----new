const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

import { handleAccessTokenFlow } from "./googleTokenUtils.js";


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

// Express route handler
router.post("/", async (req, res) => {
  const { userId, accessToken, refreshToken, calendarId } = req.body;

  try {

    // Validate and refresh the access token if needed
    const { accessToken: validAccessToken } =
      await getValidAccessTokenAndNotifyBubble(
        accessToken,
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
      message: `Calendar deleted`,
    });
  } catch (err) {
    console.error("Error in event route:", err.message || err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
