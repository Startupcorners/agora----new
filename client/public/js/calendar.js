export const init = async function (userId) {
  if (!userId) {
    console.error("userId is required to initialize.");
    return;
  }

  // Function to handle redirect from Google
  async function handleRedirect(userId) {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code"); // Extract the authorization code
    const state = decodeURIComponent(params.get("state") || ""); // Extract the original URL from state

    if (authCode) {
      try {
        // Send the authorization code to the backend
        const response = await fetch(
          "https://agora-new.vercel.app/exchange-token",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: authCode }),
          }
        );

        const result = await response.json();

        if (result.success) {
          const accessToken = result.token.access_token;
          const refreshToken = result.token.refresh_token;
          const expiresIn = result.token.expires_in; // Token expiration time in seconds

          // Calculate the expiration timestamp
          const expirationTime = Date.now() + expiresIn * 1000; // Current time + expires_in in milliseconds

          console.log("Access Token:", accessToken);
          console.log("Refresh Token:", refreshToken);
          console.log("Expires At (Timestamp):", expirationTime);

          // Set up push notifications
          const watcherInfo = await setupPushNotifications(accessToken, userId);

          if (watcherInfo) {
            console.log("Watcher Info:", watcherInfo);

            // Send watcher info back to Bubble
            if (typeof bubble_fn_watcher === "function") {
              bubble_fn_watcher({
                output1: watcherInfo.resourceId,
                output2: watcherInfo.channelId,
                output3: watcherInfo.expiration,
              });
            }
          } else {
            console.warn("Failed to set up push notifications.");
          }

          // Fetch and log calendar events
          const today = new Date().toISOString(); // Current date in ISO format
          const events = await listCalendarEvents(accessToken, today);

          if (events && events.length > 0) {
            console.log("Fetched Calendar Events:", events);

            // Parse events into separate lists
            const ids = [];
            const starts = [];
            const ends = [];

            events.forEach((event) => {
              // Skip events with the `SC` property in extendedProperties
              const isFromSC =
                event.extendedProperties &&
                event.extendedProperties.private &&
                event.extendedProperties.private.source === "SC";

              if (!isFromSC) {
                ids.push(event.id);
                starts.push(event.start.dateTime || event.start.date); // Support all-day events
                ends.push(event.end.dateTime || event.end.date); // Support all-day events
              }
            });

            // Send parsed data to Bubble
            if (typeof bubble_fn_calendarEvents === "function") {
              bubble_fn_calendarEvents({
                outputlist1: ids,
                outputlist2: starts,
                outputlist3: ends,
              });
            }
          } else {
            console.warn("No calendar events were retrieved.");
          }

          // Send tokens and expiration back to Bubble
          if (typeof bubble_fn_token === "function") {
            bubble_fn_token({
              output1: accessToken,
              output2: refreshToken,
              output3: expirationTime,
            });
          }

          // Redirect the user back to the original URL or fallback to dashboard
          const redirectUrl = state || "/dashboard/setting"; // Ensure the fallback is a root-relative URL
                if (redirectUrl.startsWith("https://www.startupcorners.com")) {
                    window.location.href = redirectUrl;
                } else {
                    console.error("Invalid redirect URL detected:", redirectUrl);
                    window.location.href = "/dashboard/setting"; // Safe fallback
                }
                
        } else {
          console.error("Error exchanging token:", result.error);
        }
      } catch (error) {
        console.error("Error handling redirect:", error);
      }
    }
  }


  // Function to initiate Google OAuth
  function initiateGoogleOAuth() {
    const clientId =
      "870400114743-av6tv101l2mvclc468l974ust7am5l2u.apps.googleusercontent.com"; // Replace with your Client ID
    const redirectUri = "https://www.startupcorners.com/oauth-callback"; // Your Redirect URI
    const scope = "https://www.googleapis.com/auth/calendar";
    const authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";

    // Capture the current page URL
    const state = encodeURIComponent(window.location.href);

    const authUrl = `${authEndpoint}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(
      scope
    )}&access_type=offline&prompt=consent&state=${state}`;

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



  // Return the functions to expose them
  return {
    initiateGoogleOAuth,
  };
};

// Expose the `init` function globally
window["init"] = init;
