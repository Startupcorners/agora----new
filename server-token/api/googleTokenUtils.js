const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const BUBBLE_GET_TOKENS_URL = "https://startupcorners.com/api/1.1/wf/getTokens";
const BUBBLE_NOTIFY_URL =
  "https://startupcorners.com/api/1.1/wf/receiveTokenInfo";
const TOKEN_REFRESH_URL = "https://oauth2.googleapis.com/token";

export async function handleAccessTokenFlow(
  accessToken,
  refreshToken,
  userId,
  resourceId
) {
  try {
    console.log("=== Starting Access Token Flow ===");
    console.log(`Initial Parameters: 
      accessToken: ${accessToken}, 
      refreshToken: ${refreshToken}, 
      userId: ${userId}, 
      resourceId: ${resourceId}`);

    // Case 1: If all values are null except resourceId, fetch tokens from Bubble
    if (!accessToken && !refreshToken && !userId && resourceId) {
      console.log("Fetching tokens from Bubble using resourceId:", resourceId);
      const tokenData = await fetchTokensFromBubble(resourceId);
      console.log("Received token data from Bubble:", tokenData);
      accessToken = tokenData.accessToken;
      refreshToken = tokenData.refreshToken;
      userId = tokenData.userId;
      console.log("Updated tokens from Bubble:", {
        accessToken,
        refreshToken,
        userId,
      });
    }

    // Case 2: If accessToken and userId are provided, validate the token
    if (accessToken && userId) {
      console.log("Validating access token:", accessToken);
      const isValid = await validateAccessToken(accessToken);
      console.log("Access token validation result:", isValid);

      if (isValid) {
        console.log("Access token is valid. No refresh needed.");
        console.log("=== End of Access Token Flow ===");
        return {
          accessToken,
          refreshToken,
          userId,
          accessTokenExpiration: null, // No expiration update if token is still valid
        };
      } else {
        console.warn(
          "Access token expired or invalid. Proceeding to refresh..."
        );
      }
    }

    // Case 3: If refreshToken is provided, refresh the token
    if (refreshToken) {
      console.log(
        "Refreshing token using provided refreshToken:",
        refreshToken
      );
      const newTokenData = await refreshAccessToken(refreshToken);
      console.log("Received new token data from Google:", newTokenData);

      console.log("Notifying Bubble with new token data...");
      await notifyBubbleWithToken(userId, resourceId, newTokenData);
      console.log("Successfully notified Bubble with new token.");

      console.log("=== End of Access Token Flow (with refresh) ===");
      return {
        accessToken: newTokenData.accessToken,
        refreshToken: newTokenData.refreshToken,
        userId,
        accessTokenExpiration: newTokenData.accessTokenExpiration,
      };
    }

    // If no refresh token exists but resourceId is provided, try fetching from Bubble again
    if (!refreshToken && resourceId) {
      console.log(
        "No refresh token provided. Fetching tokens from Bubble using resourceId:",
        resourceId
      );
      const tokenData = await fetchTokensFromBubble(resourceId);
      console.log("Received token data from Bubble:", tokenData);
      refreshToken = tokenData.refreshToken;

      console.log(
        "Refreshing token using Bubble provided refreshToken:",
        refreshToken
      );
      const newTokenData = await refreshAccessToken(refreshToken);
      console.log("Received new token data from Google:", newTokenData);

      console.log("Notifying Bubble with refreshed token...");
      await notifyBubbleWithToken(userId, resourceId, newTokenData);
      console.log("Successfully notified Bubble with refreshed token.");

      console.log("=== End of Access Token Flow (with fetch & refresh) ===");
      return {
        accessToken: newTokenData.accessToken,
        refreshToken: newTokenData.refreshToken,
        userId,
        accessTokenExpiration: newTokenData.accessTokenExpiration,
      };
    }

    throw new Error("Invalid input: Missing required credentials.");
  } catch (error) {
    console.error("Error in access token flow:", error.message);
    throw error;
  }
}

// Fetch tokens from Bubble
export async function fetchTokensFromBubble(resourceId) {
  try {
    console.log(
      `Requesting tokens from Bubble at ${BUBBLE_GET_TOKENS_URL} with resourceId: ${resourceId}`
    );
    const response = await fetch(BUBBLE_GET_TOKENS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId }),
    });

    console.log("Bubble fetch response status:", response.status);
    if (!response.ok) {
      console.error(
        `Failed to fetch tokens from Bubble. HTTP Status: ${response.status}`
      );
      throw new Error(`Failed to fetch tokens. Status: ${response.status}`);
    }

    const tokenData = await response.json();
    console.log("Bubble response token data:", tokenData);
    return tokenData;
  } catch (error) {
    console.error("Error fetching tokens from Bubble:", error.message);
    throw error;
  }
}

// Validate access token by calling Google API
export async function validateAccessToken(accessToken) {
  try {
    console.log("Validating access token with Google API:", accessToken);
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    );
    console.log("Google token validation response status:", response.status);
    if (!response.ok) {
      const errorData = await response.json();
      console.warn("Google token validation error data:", errorData);
    }
    return response.ok;
  } catch (error) {
    console.warn("Error verifying access token:", error.message);
    return false;
  }
}

// Refresh access token with Google
export async function refreshAccessToken(refreshToken) {
  try {
    console.log(
      "Refreshing access token with Google using refresh token:",
      refreshToken
    );
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    console.log("Refresh request parameters:", params.toString());
    const response = await fetch(TOKEN_REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    console.log("Google refresh token response status:", response.status);
    const tokenData = await response.json();
    console.log("Google refresh token response data:", tokenData);
    if (!tokenData.access_token) {
      throw new Error("Failed to refresh access token.");
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      accessTokenExpiration: Date.now() + tokenData.expires_in * 1000,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error.message);
    throw error;
  }
}

// Notify Bubble with the new access token
export async function notifyBubbleWithToken(userId, resourceId, tokenData) {
  try {
    const payload = {
      userId,
      resourceId,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      accessTokenExpiration: tokenData.accessTokenExpiration,
    };
    console.log(
      "Sending payload to Bubble at",
      BUBBLE_NOTIFY_URL,
      "Payload:",
      payload
    );
    const response = await fetch(BUBBLE_NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("Notify Bubble response status:", response.status);
    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        "Failed to notify Bubble about new token. Response:",
        errorData
      );
      throw new Error("Failed to notify Bubble about new token.");
    }
    console.log("Successfully notified Bubble with new token.");
  } catch (error) {
    console.error("Error notifying Bubble:", error.message);
    throw error;
  }
}
