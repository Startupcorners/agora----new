export const init = async function (userId) {
  if (!userId) {
    console.error("userId is required to initialize.");
    return;
  }

  // Function to handle redirect from Google
  async function handleRedirect(userId) {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const state = decodeURIComponent(params.get("state") || "");

    if (!authCode) return;

    try {
      // 1. Exchange the auth code for tokens
      const tokenResponse = await fetch(
        "https://agora-new.vercel.app/exchange-token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: authCode }),
        }
      );
      const tokenResult = await tokenResponse.json();
      if (!tokenResult.success) {
        console.error("Error exchanging token:", tokenResult.error);
        return;
      }
      const {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      } = tokenResult.token;
      const expirationTime = Date.now() + expiresIn * 1000;

      console.log("Access Token:", accessToken);
      console.log("Refresh Token:", refreshToken);
      console.log("Expires At (Timestamp):", expirationTime);

      // 2. Fetch user email using the retrieved access token
      const userEmail = await fetchUserEmail(accessToken);
      if (!userEmail) {
        console.error("Critical Error: Email could not be retrieved.");
        return;
      }

      // 3. Notify Bubble with Token Data
      console.log("Sending token data to Bubble...");
      await sendTokenDataToBubble(
        accessToken,
        refreshToken,
        expirationTime,
        userEmail
      );
      console.log("Token data successfully sent to Bubble.");

      // 4. Set Up Push Notifications (Webhook) to obtain resourceId
      const watcherInfo = await setupPushNotifications(accessToken, userId);
      if (watcherInfo) {
        sendWatcherInfoToBubble(watcherInfo);
      } else {
        console.warn("No watcher info received.");
      }

      // 5. Retrieve and Forward Calendar Events
      const events = await listCalendarEvents(
        accessToken,
        new Date().toISOString()
      );
      if (events && events.length > 0) {
        sendCalendarEventsToBubble(events);
      }

      // 6. Create a Custom Calendar
      const calendarId = await createStartupCornersCalendar(accessToken);
      await sendCalendarIdToBubble(calendarId);

      // 7. Process Appointments for the given user
      console.log(`Processing appointments for user: ${userId}`);
      await processAppointments(userId, accessToken, refreshToken, calendarId);
      console.log("Appointment processing completed.");

      // 8. Notify Bubble process completion
      if (typeof bubble_fn_finished === "function") {
        console.log("Calling bubble_fn_finished...");
        bubble_fn_finished();
      } else {
        console.warn("bubble_fn_finished is not defined.");
      }
    } catch (error) {
      console.error("Error handling redirect:", error);
    }
  }




  // Fetch user email using access token
  async function fetchUserEmail(accessToken) {
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const userInfo = await response.json();
        console.log("User Email:", userInfo.email);
        return userInfo.email || null;
      } else {
        console.error(
          "Failed to fetch user info:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error retrieving user email:", error);
    }
    return null;
  }

  // Send watcher info to Bubble
  function sendWatcherInfoToBubble(watcherInfo) {
    if (typeof bubble_fn_watcher === "function") {
      bubble_fn_watcher({
        output1: watcherInfo.resourceId,
        output2: watcherInfo.channelId,
        output3: watcherInfo.expiration,
      });
    }
  }

  async function processAppointments(userId, accessToken, refreshToken, calendarId) {
    try {
      if (!userId) {
        throw new Error(
          "Missing required parameters (userId or mainAccessToken)."
        );
      }

      // Step 1: Fetch appointments from the given API with userId as a query parameter
      const response = await fetch(
        `https://startupcorners.com/api/1.1/wf/retrieveAppointments?userId=${encodeURIComponent(
          userId
        )}&accessToken=${encodeURIComponent(
          accessToken
        )}&refreshToken=${encodeURIComponent(refreshToken)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );


      if (!response.ok) {
        throw new Error(
          `Failed to retrieve appointments: ${response.statusText}`
        );
      }

      const data = await response.json();

      console.log("API response:", data);

      // Check if the response is an array directly, or inside a 'response' field
      const appointments = Array.isArray(data) ? data : data.response;

      if (!appointments || !Array.isArray(appointments)) {
        throw new Error("Invalid response format from API");
      }

      // Step 2: Loop through the appointments and process each one
      for (const appointment of appointments) {
        const {
          action, // "add", "update", or "delete"
          appointmentId, // The appointment ID
          eventId, // Google event ID (for updates/deletes)
          eventDetails, // Event details (only for add/update actions)
        } = appointment;

        if (!action || !appointmentId) {
          console.warn(
            `Skipping appointment ${appointmentId} due to missing data.`
          );
          continue;
        }

        // Step 3: Call handleGoogleEvents for each appointment
        const resultEventId = await handleGoogleEvents(
          accessToken,
          refreshToken,
          calendarId,
          userId,
          action,
          eventDetails,
          appointmentId,
          eventId || null // Pass eventId if available for updates/deletes
        );

        if (resultEventId) {
          console.log(
            `Successfully processed appointment ${appointmentId} with Google Event ID: ${resultEventId}`
          );
        } else {
          console.warn(`Failed to process appointment ${appointmentId}`);
        }
      }

      console.log("All appointments processed.");
    } catch (error) {
      console.error("Error processing appointments:", error);
    }
  }

  async function processDeleteEvents(userId, accessToken, refreshToken, calendarId) {
    
    try {
      const response = await fetch(
        "https://agora-new.vercel.app/delete-events",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, accessToken, refreshToken, calendarId }),
        }
      );

      // Check the response content type before parsing JSON
      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        result = await response.text();
        console.error("Received non-JSON response from backend:", result);
        return;
      }

      if (!response.ok) {
        console.error("Error deleting events:", result.error || result);
        return;
      }

      console.log("Attendee removed successfully:", result.message);
      return result;
    } catch (error) {
      console.error(
        "Error calling backend to remove attendee:",
        error.message || error
      );
    }
  }

  async function createStartupCornersCalendar(accessToken) {
    const GOOGLE_CALENDAR_API = `https://www.googleapis.com/calendar/v3/calendars`;

    try {
      const calendarData = {
        summary: "StartupCorners",
        timeZone: "UTC", // You can change the timezone if needed
      };

      const response = await fetch(GOOGLE_CALENDAR_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create calendar: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("StartupCorners calendar created successfully:", data);

      return data.id; // Return the new calendar ID
    } catch (error) {
      console.error("Error creating StartupCorners calendar:", error.message);
      throw error;
    }
  }



  // Send calendar events to Bubble
  function sendCalendarEventsToBubble(events) {
    const ids = [];
    const starts = [];
    const ends = [];

    events.forEach((event) => {
      const isFromSC = event.extendedProperties?.private?.source === "SC";
      if (!isFromSC) {
        ids.push(event.id);
        starts.push(event.start.dateTime || event.start.date);
        ends.push(event.end.dateTime || event.end.date);
      }
    });

    if (typeof bubble_fn_calendarEvents === "function") {
      bubble_fn_calendarEvents({
        outputlist1: ids,
        outputlist2: starts,
        outputlist3: ends,
      });
    }
  }


  function sendCalendarIdToBubble(
    calendarId
  ) {
    if (typeof bubble_fn_calendar === "function") {
      bubble_fn_calendar({
        output1: calendarId,
      });
    }
  }

  function sendTokenDataToBubble(
    accessToken,
    refreshToken,
    expirationTime,
    userEmail
  ) {
    if (typeof bubble_fn_token === "function") {
      bubble_fn_token({
        output1: accessToken,
        output2: refreshToken,
        output3: expirationTime,
        output4: userEmail,
      });
    }
  }

  // Validate the redirect URL
  function validateRedirectUrl(url) {
    if (url.startsWith("https://www.startupcorners.com")) {
      return url;
    } else {
      console.error("Invalid redirect URL detected:", url);
      return null;
    }
  }

  // Function to initiate Google OAuth
  function initiateGoogleOAuth() {
    const clientId =
      "870400114743-av6tv101l2mvclc468l974ust7am5l2u.apps.googleusercontent.com"; // Replace with your Client ID
    const redirectUri = "https://www.startupcorners.com/oauth-callback"; // Your Redirect URI

    // Add all required scopes: calendar, email, and profile
    const scope = ["https://www.googleapis.com/auth/calendar", "email"].join(
      " "
    );

    const authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";

    // Capture the current page URL for state parameter
    const state = encodeURIComponent(window.location.href);

    const authUrl = `${authEndpoint}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(
      scope
    )}&access_type=offline&prompt=consent&include_granted_scopes=true&state=${state}`;

    // Remove any onbeforeunload handlers to avoid the leave-site popup
    window.onbeforeunload = null;

    // Redirect the user to Google's OAuth page
    window.location.href = authUrl;
  }

  // Automatically handle redirect if the URL contains the authorization code
  if (
    window.location.pathname === "/oauth-callback" &&
    window.location.search.includes("code=")
  ) {
    console.log("Redirect detected, calling handleRedirect...");
    await handleRedirect(userId);
  }



  // Function to list calendar events
  async function listCalendarEvents(accessToken, timeMin) {
    if (!accessToken) {
      console.error(
        "No access token provided. Please connect Google Calendar first."
      );
      return;
    }

    // Calculate timeMax as 7 days after timeMin
    const timeMax = new Date(
      new Date(timeMin).getTime() + 180 * 24 * 60 * 60 * 1000
    ).toISOString();

    const params = new URLSearchParams({
      timeMin: new Date(timeMin).toISOString(), // Start time
      timeMax: timeMax, // End time (7 days later)
      singleEvents: "true", // Ensure recurring events are expanded
      orderBy: "startTime", // Sort by start time
    });

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const events = await response.json();

      if (events.error) {
        console.error("Error fetching calendar events:", events.error);
        return null;
      }

      console.log("Calendar Events:", events);
      return events.items; // Return the list of events
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      return null;
    }
  }

  // Function to set up push notifications
  async function setupPushNotifications(accessToken) {
    if (!accessToken) {
      console.error(
        "No access token provided. Please connect Google Calendar first."
      );
      return null;
    }

    if (!userId) {
      console.error("No userId provided. Cannot set up push notifications.");
      return null;
    }

    try {
      const response = await fetch("https://agora-new.vercel.app/setWebhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(
          "Error setting up push notifications:",
          result.error || result
        );
        return null;
      }

      console.log("Push Notification Watch Set Up:", result);
      const { googleResponse } = result;

      if (googleResponse) {
        return {
          channelId: googleResponse.id,
          resourceId: googleResponse.resourceId,
          expiration: googleResponse.expiration,
        };
      } else {
        console.warn("No googleResponse in backend response:", result);
        return null;
      }
    } catch (error) {
      console.error("Error setting up push notifications:", error);
      return null;
    }
  }

  async function handleGoogleEvents(
    accessToken,
    refreshToken,
    calendarId,
    userId,
    action,
    eventDetails,
    appointmentId,
    eventId
  ) {
    console.log("handleGoogleEvents has been triggered");

    if (!userId) {
      console.error("No userId provided. Cannot set up push notifications.");
      return null;
    }

    if (!action || !["add", "update", "delete"].includes(action)) {
      console.error(
        "Invalid or missing action. Must be 'add', 'update', or 'delete'."
      );
      return null;
    }

    try {
      const response = await fetch(
        "https://agora-new.vercel.app/handleGoogleEvents",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken,
            refreshToken,
            calendarId,
            userId,
            action,
            eventDetails: action !== "delete" ? eventDetails : undefined, // Include eventDetails only for add/update
            eventId: action !== "add" ? eventId : undefined, // Include eventId only for update/delete
          }),
        }
      );

      // Check the response content type before parsing JSON
      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        result = await response.text();
        console.error("Received non-JSON response from backend:", result);
        return null;
      }

      if (!response.ok) {
        console.error("Error handling event:", result.error || result);
        console.error(`HTTP Status: ${response.status}`);
        return null;
      }

      console.log("Event handled successfully:", result);

      if (result.eventId) {
        console.log(`Event ${action}ed successfully with ID:`, result.eventId);

        // Optionally call a Bubble function to store the event ID
        if (typeof bubble_fn_eventId === "function") {
          bubble_fn_eventId({
            output1: result.eventId,
            output2: appointmentId,
          });
        }

        return result.eventId;
      } else {
        console.warn("No eventId returned from backend:", result);
        return null;
      }
    } catch (error) {
      console.error("Error handling event:", error.message || error);
      return null;
    }
  }

  // Return the functions to expose themm
  return {
    initiateGoogleOAuth,
    handleGoogleEvents,
    processAppointments,
    processDeleteEvents,
  };
};

// Expose the `init` function globally
window["init"] = init;
