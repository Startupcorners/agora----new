  // Function to handle redirect from Google
  async function handleRedirect(userId) {
    console.log("handleRedirect started with userId:", userId);

    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const state = decodeURIComponent(params.get("state") || "");
    console.log("Extracted authCode:", authCode);
    console.log("Extracted state:", state);

    // Grab the 'scope' param directly from the callback URL
    const urlScope = params.get("scope") || "";
    console.log("Extracted urlScope:", urlScope);

    if (!authCode) {
      console.warn("No authCode found, exiting function.");
      return;
    }

    // 1. Quick check: Did the user actually grant the Calendar scope?
    if (!urlScope.includes("https://www.googleapis.com/auth/calendar")) {
      console.warn("User did not grant Calendar permission.");

      if (typeof bubble_fn_notGranted === "function") {
        console.log("Calling bubble_fn_notGranted.");
        bubble_fn_notGranted();
      }
      return; // Stop execution
    }

    try {
      console.log("Attempting to exchange authCode for tokens...");

      // 2. Exchange the auth code for tokens
      const tokenResponse = await fetch(
        "https://agora-new.vercel.app/exchange-token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: authCode }),
        }
      );
      const tokenResult = await tokenResponse.json();
      console.log("Token exchange response:", tokenResult);

      // If exchange failed, exit
      if (!tokenResult.success) {
        console.error("Token exchange failed, exiting.");
        return;
      }

      // 3. Destructure needed fields
      const {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      } = tokenResult.token;
      console.log("Access Token:", accessToken);
      console.log("Refresh Token:", refreshToken);
      console.log("Token Expiration in seconds:", expiresIn);

      const expirationTime = Date.now() + expiresIn * 1000;
      console.log("Computed token expirationTime:", expirationTime);

      // 5. Fetch user email
      console.log("Fetching user email...");
      const userEmail = await fetchUserEmail(accessToken);
      if (!userEmail) {
        console.error("Failed to fetch user email, exiting.");
        return;
      }
      console.log("Fetched user email:", userEmail);

      // 6. Notify Bubble with Token Data
      console.log("Sending token data to Bubble...");
      await sendTokenDataToBubble(
        accessToken,
        refreshToken,
        expirationTime,
        userEmail
      );

      // 7. Set Up Push Notifications (Webhook) to obtain resourceId
      console.log("Setting up push notifications...");
      const watcherInfo = await setupPushNotifications(accessToken, userId);
      if (watcherInfo) {
        console.log("Push notifications set up successfully:", watcherInfo);
        sendWatcherInfoToBubble(watcherInfo);
      } else {
        console.warn("Failed to set up push notifications.");
      }

      // 8. Retrieve and Forward Calendar Events
      console.log("Fetching calendar events...");
      const events = await listCalendarEvents(
        accessToken,
        new Date().toISOString()
      );
      if (events && events.length > 0) {
        console.log("Fetched calendar events:", events.length);
        sendCalendarEventsToBubble(events);
      } else {
        console.warn("No calendar events found.");
      }

      // 9. Create a Custom Calendar
      console.log("Creating a custom calendar...");
      const calendarId = await createStartupCornersCalendar(accessToken);
      console.log("Created calendar with ID:", calendarId);
      await sendCalendarIdToBubble(calendarId);

      // 10. Process Appointments for the given user
      console.log("Processing appointments for user:", userId);
      await processAppointments(userId, accessToken, refreshToken, calendarId);

      // 11. Notify Bubble process completion
      console.log("Process completed. Notifying Bubble...");
      if (typeof bubble_fn_finished === "function") {
        bubble_fn_finished();
      }

      console.log("handleRedirect execution finished successfully.");
    } catch (error) {
      console.error("An error occurred in handleRedirect:", error);
    }
  }

  window.handleRedirect = handleRedirect;

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
        return userInfo.email || null;
      }
    } catch (error) {
      // Error handling silently
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

  async function processAppointments(
    userId,
    accessToken,
    refreshToken,
    calendarId
  ) {
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

        if (!resultEventId) {
          // Handle failure silently
        }
      }
    } catch (error) {
      // Error handling silently
    }
  }

  window.processAppointments = processAppointments;

  async function processDeleteEvents(
    userId,
    accessToken,
    refreshToken,
    calendarId,
    channelId,
    resourceId
  ) {
    try {
      // Step 1: Delete Google Calendar Events
      const response = await fetch(
        "https://agora-new.vercel.app/delete-events",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            accessToken,
            refreshToken,
            calendarId,
          }),
        }
      );

      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        result = await response.text();
        return;
      }

      if (!response.ok) {
        return;
      }

      // Step 2: Stop Push Notifications (Stop Watcher)
      await stopPushNotifications(
        userId,
        channelId,
        resourceId,
        accessToken,
        refreshToken
      );

      // Step 3: Revoke OAuth Token
      await revokeGoogleOAuthToken(accessToken);

      return result;
    } catch (error) {
      console.error("Error processing delete events:", error);
    }
  }

  window.processDeleteEvents = processDeleteEvents;

  async function revokeGoogleOAuthToken(accessToken) {
    try {
      const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`;
      const response = await fetch(revokeUrl, { method: "POST" });

      if (response.ok) {
        console.log("✅ Google OAuth token revoked successfully.");
      } else {
        console.warn("⚠️ Failed to revoke Google OAuth token.");
      }
    } catch (error) {
      console.error("Error revoking Google OAuth token:", error);
    }
  }

  async function stopPushNotifications(
    userId,
    channelId,
    resourceId,
    accessToken,
    refreshToken
  ) {
    try {
      const response = await fetch("https://agora-new.vercel.app/stopWatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          channelId,
          resourceId,
          accessToken,
          refreshToken,
        }),
      });

      if (response.ok) {
        console.log("✅ Push notifications (watcher) stopped successfully.");
      } else {
        console.warn("⚠️ Failed to stop push notifications.");
      }
    } catch (error) {
      console.error("Error stopping push notifications:", error);
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

      return data.id; // Return the new calendar ID
    } catch (error) {
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

  function sendCalendarIdToBubble(calendarId) {
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

  window.initiateGoogleOAuth = initiateGoogleOAuth;

  

  


  // Function to list calendar events
  async function listCalendarEvents(accessToken, timeMin) {
    if (!accessToken) {
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
        return null;
      }

      return events.items; // Return the list of events
    } catch (error) {
      return null;
    }
  }

  // Function to set up push notifications
  async function setupPushNotifications(accessToken, userId) {
    if (!accessToken) {
      return null;
    }

    if (!userId) {
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
        return null;
      }

      const { googleResponse } = result;

      if (googleResponse) {
        return {
          channelId: googleResponse.id,
          resourceId: googleResponse.resourceId,
          expiration: googleResponse.expiration,
        };
      } else {
        return null;
      }
    } catch (error) {
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
    if (!userId) {
      return null;
    }

    if (!action || !["add", "update", "delete"].includes(action)) {
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

      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        result = await response.text();
        return null;
      }

      if (!response.ok) {
        return null;
      }

      if (result.eventId) {
        if (typeof bubble_fn_eventId === "function") {
          bubble_fn_eventId({
            output1: result.eventId,
            output2: appointmentId,
          });
        }
        return result.eventId;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  window.handleGoogleEvents = handleGoogleEvents;