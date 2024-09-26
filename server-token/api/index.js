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
// CORS Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// JSON parser middleware
app.use(express.json());

// Example routes (adjust based on your actual route paths)
const accessTokenGeneration = require("./access_token_generation");

// Use routes
app.use("/generateTokens", accessTokenGeneration);

// Export the app
module.exports = app;
