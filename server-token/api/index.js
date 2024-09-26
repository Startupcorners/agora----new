const express = require("express");
const cors = require("cors");

const app = express();

// CORS setup
app.use(
  cors({
    origin: ["https://startupcorners.com", "https://www.startupcorners.com"],
    credentials: true,
  })
);

// Test route to verify that the server is working
app.get("/", (req, res) => {
  res.send("Hello from the root route! The server is running.");
});

// Example route to test routing
app.get("/generateTokens", (req, res) => {
  res.json({ token: "example-token" });
});

// Error handling middleware for undefined routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
