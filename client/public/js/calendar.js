export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search); // Extract URL parameters
  const authCode = params.get("code"); // Get the authorization code

  if (authCode) {
    try {
      // Send the authorization code to the backend for token exchange
      const response = await fetch(
        "https://agora-new.vercel.app/calendar.js/exchange-token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: authCode }), // Send the authorization code
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log("Access Token:", result.token.access_token);
        // Save the access token for later use
        localStorage.setItem("google_access_token", result.token.access_token);
      } else {
        console.error("Error exchanging token:", result.error);
      }
    } catch (error) {
      console.error("Error handling redirect:", error);
    }
  }
}

// Automatically handle redirect if the URL contains an authorization code
if (
  window.location.pathname === "/oauth-callback" &&
  window.location.search.includes("code=")
) {
  handleRedirect();
}



export function initiateGoogleOAuth() {
  const clientId =
    "870400114743-av6tv101l2mvclc468l974ust7am5l2u.apps.googleusercontent.com"; // Replace with your Client ID
  const redirectUri = "https://www.startupcorners.com/oauth-callback"; // Your app's redirect URI
  const scope = "https://www.googleapis.com/auth/calendar";
  const authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";

  const authUrl = `${authEndpoint}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  // Redirect the user to Google's OAuth page
  window.location.href = authUrl;
}


export async function listCalendarEvents() {
  const accessToken = localStorage.getItem("google_access_token"); // Retrieve the access token

  if (!accessToken) {
    console.error(
      "No access token found. Please connect Google Calendar first."
    );
    return;
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`, // Use the access token
        },
      }
    );

    const events = await response.json();
    console.log("Calendar Events:", events);
    return events;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
  }
}
