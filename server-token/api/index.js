const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use((req, res, next) => {
  console.log(`${req.method} request for ${req.url}`);
  next();
});

// Configure allowed origins
const allowedOrigins = [
  "https://startupcorners.com",
  "https://www.startupcorners.com",
];

// CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// JSON parser middleware
app.use(express.json());

// Example routes (adjust based on your actual route paths)
const accessTokenGeneration = require("./access_token_generation");

// Use routes
app.use("/generateTokens", accessTokenGeneration);

// Export the app
module.exports = app;
