export const init = async function () {
  // Function to handle redirect from Google
  async function handleRedirect() {
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

          // Save the tokens and expiration for later use
          localStorage.setItem("google_access_token", accessToken);
          localStorage.setItem("google_refresh_token", refreshToken);
          localStorage.setItem("google_token_expiration", expirationTime);

          // Send tokens and expiration back to Bubble
          if (typeof bubble_fn_token === "function") {
            bubble_fn_token({
              output1: accessToken,
              output2: refreshToken,
              output3: expirationTime,
            });
          } else {
            console.warn("bubble_fn_token is not defined.");
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

  // Function to list calendar events
  async function listCalendarEvents(accessToken, timeMin, timeMax) {
    if (!accessToken) {
      console.error(
        "No access token provided. Please connect Google Calendar first."
      );
      return;
    }

    const params = new URLSearchParams({
      timeMin: new Date(timeMin).toISOString(), // Start time
      timeMax: new Date(timeMax).toISOString(), // End time
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




  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("google_refresh_token");

    if (!refreshToken) {
      console.error(
        "No refresh token found. Please reconnect Google Calendar."
      );
      return;
    }

    try {
      const response = await fetch(
        "https://agora-new.vercel.app/refresh-token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      );

      const result = await response.json();

      if (result.success) {
        const accessToken = result.token.access_token;
        const expiresIn = result.token.expires_in;

        // Calculate the new expiration timestamp
        const expirationTime = Date.now() + expiresIn * 1000;

        console.log("New Access Token:", accessToken);
        console.log("New Expiration Time:", expirationTime);

        // Update tokens in localStorage
        localStorage.setItem("google_access_token", accessToken);
        localStorage.setItem("google_token_expiration", expirationTime);

        // Update Bubble if needed
        if (typeof bubble_fn_token === "function") {
          bubble_fn_token({
            output1: accessToken,
            output2: refreshToken,
            output3: expirationTime,
          });
        }
      } else {
        console.error("Error refreshing token:", result.error);
      }
    } catch (error) {
      console.error("Error refreshing access token:", error);
    }
  }


  // Return the functions to expose them
  return {
    initiateGoogleOAuth,
    listCalendarEvents,
    refreshAccessToken,
  };
};

// Expose the `init` function globally
window["init"] = init;
