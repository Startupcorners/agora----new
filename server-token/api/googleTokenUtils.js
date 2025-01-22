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
    console.log("Starting access token flow...");

    // Case 1: If all values are null except resourceId, fetch tokens from Bubble
    if (!accessToken && !refreshToken && !userId && resourceId) {
      console.log("Fetching tokens from Bubble using resourceId...");
      const tokenData = await fetchTokensFromBubble(resourceId);
      accessToken = tokenData.accessToken;
      refreshToken = tokenData.refreshToken;
      userId = tokenData.userId;
      console.log("Retrieved tokens and userId from Bubble.");
    }

    // Case 2: If accessToken and userId are provided, validate the token
    if (accessToken && userId) {
      console.log("Validating access token...");
      const isValid = await validateAccessToken(accessToken);

      if (isValid) {
        console.log("Access token is valid. No refresh needed.");
        return {
          accessToken,
          refreshToken,
          userId,
          accessTokenExpiration: null, // No expiration update if token is still valid
        };
      } else {
        console.warn("Access token expired or invalid. Refreshing...");
      }
    }

    // Case 3: If refreshToken is provided, directly refresh the token
    if (refreshToken) {
      console.log("Refreshing token using provided refreshToken...");
      const newTokenData = await refreshAccessToken(refreshToken);

      console.log("Token refreshed successfully.");

      // Notify Bubble with the updated token
      console.log("Notifying Bubble with new token...");
      await notifyBubbleWithToken(userId, resourceId, newTokenData);

      console.log("Successfully completed token flow.");

      return {
        accessToken: newTokenData.accessToken,
        refreshToken: newTokenData.refreshToken,
        userId,
        accessTokenExpiration: newTokenData.accessTokenExpiration,
      };
    }

    // If no refresh token, fetch from Bubble
    if (!refreshToken && resourceId) {
      console.log("Fetching refresh token from Bubble...");
      const tokenData = await fetchTokensFromBubble(resourceId);
      refreshToken = tokenData.refreshToken;

      console.log("Refreshing token using Bubble provided refreshToken...");
      const newTokenData = await refreshAccessToken(refreshToken);

      console.log("Notifying Bubble with refreshed token...");
      await notifyBubbleWithToken(userId, resourceId, newTokenData);

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
    const response = await fetch(BUBBLE_GET_TOKENS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens. Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching tokens from Bubble:", error.message);
    throw error;
  }
}

// Validate access token by calling Google API
export async function validateAccessToken(accessToken) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    );

    return response.ok;
  } catch (error) {
    console.warn("Error verifying access token:", error.message);
    return false;
  }
}

// Refresh access token with Google
export async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch(TOKEN_REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await response.json();

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

    const response = await fetch(BUBBLE_NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Failed to notify Bubble about new token.");
    }

    console.log("Successfully notified Bubble with new token.");
  } catch (error) {
    console.error("Error notifying Bubble:", error.message);
    throw error;
  }
}
