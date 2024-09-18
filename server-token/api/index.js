const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { RtcTokenBuilder, Role } = require("./RtcTokenBuilder2"); // Import Role from RtcTokenBuilder2.js
  // Path to RtcTokenBuilder2.js in the same folder
const AWS = require("aws-sdk");
  // Set up AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    region: "us-east-1",
  });

require("dotenv").config();

// Log important environment variables
console.log("RtcTokenBuilder:", RtcTokenBuilder);
console.log("APP_ID:", process.env.APP_ID || "Not Defined");
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE || "Not Defined");
console.log("Customer ID:", process.env.CUSTOMER_ID || "Not Defined");
console.log("Customer Secret:", process.env.CUSTOMER_SECRET || "Not Defined");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");
console.log("S3_ACCESS_KEY:", process.env.S3_ACCESS_KEY || "Not Defined");
console.log("S3_SECRET_KEY:", process.env.S3_SECRET_KEY || "Not Defined");
console.log("S3_REGION:", process.env.S3_REGION || "Not Defined");

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const app = express();

// Update CORS settings to allow requests from your Bubble app
app.use(
  cors({
    origin: "https://sccopy-38403.bubbleapps.io", // Your Bubble app domain
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allowed methods
    credentials: true, // If you need to send cookies or other credentials
  })
);

app.use(express.json());

// Handle preflight requests
app.options("*", cors());

const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

// Token generations
// Token generation endpoint with RtcTokenBuilder
app.get("/access_token", nocache, (req, res) => {
  const { channelName, uid, role } = req.query;

  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    console.log(
      `Generating token for channel: ${channelName}, UID: ${uid}, Role: ${role}`
    );

    const tokenRole = role === "publisher" ? Role.PUBLISHER : Role.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      uid,
      tokenRole,
      Math.floor(Date.now() / 1000) + 3600
    );

    console.log("Generated Token:", token);
    return res.json({ token });
  } catch (error) {
    console.error("Token generation failed:", error);
    return res.status(500).json({
      error: "Token generation failed",
      details: error.message,
    });
  }
});

// Acquire resource
app.post("/acquire", async (req, res) => {
  const { channelName, uid } = req.body;

  console.log("Acquire request for channel:", channelName, "UID:", uid);

  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        resourceExpiredHour: 24,
        scene: 1,
      },
    };

    console.log("Payload sent to Agora for acquire:", payload);

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/acquire`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Acquire response:", response.data);
    const resourceId = response.data.resourceId;
    res.json({ resourceId });
  } catch (error) {
    console.error(
      "Error acquiring resource:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to acquire resource" });
  }
});


// Start recordingconst axios = require("axios");

const startRecording = async () => {
  try {
    const resourceId = await acquireResource();
    console.log("Resource acquired:", resourceId);

    config.resourceId = resourceId;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited 2 seconds after acquiring resource");

    const recordingTokenResponse = await fetch(
      `${config.serverUrl}/generate_recording_token?channelName=${config.channelName}&uid=0`,
      {
        method: "GET",
      }
    );

    const tokenData = await recordingTokenResponse.json();
    const recordingToken = tokenData.token;

    const timestamp = Date.now().toString(); // Generate a timestamp

    const response = await fetch(config.serverUrl + "/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: resourceId,
        channelName: config.channelName,
        uid: config.recordId, // Use recordId for UID
        token: recordingToken,
        clientRequest: {
          extensionServiceConfig: {
            errorHandlePolicy: "error_abort",
            extensionServices: [
              {
                serviceName: "web_recorder_service",
                errorHandlePolicy: "error_abort",
                serviceParam: {
                  url: `https://sccopy-38403.bubbleapps.io/video/${config.channelName}?timestamp=${timestamp}`,
                  audioProfile: 1,
                  videoWidth: 1280,
                  videoHeight: 720,
                  maxRecordingHour: 1,
                },
              },
            ],
          },
          recordingFileConfig: {
            avFileType: ["hls", "mp4"],
          },
          storageConfig: {
            vendor: 1,
            region: 0,
            bucket: process.env.S3_BUCKET_NAME,
            accessKey: process.env.S3_ACCESS_KEY,
            secretKey: process.env.S3_SECRET_KEY,
            fileNamePrefix: ["recordings", config.channelName, timestamp],
          },
        },
      }),
    });

    const startData = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to start recording: ${startData.error}`);
    }

    if (startData.sid) {
      config.sid = startData.sid;
      console.log("SID received:", startData.sid);

      bubble_fn_record({
        output1: resourceId,
        output2: startData.sid,
        output3: config.recordId,
      });
    } else {
      console.error("SID not received in the response:", startData);
    }

    return startData;
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
};






app.post("/query", async (req, res) => {
  const { resourceId, sid } = req.body;

  if (!resourceId || !sid) {
    return res.status(400).json({
      error: "resourceId and sid are required",
    });
  }

  console.log("Querying for recording status with details:", {
    resourceId,
    sid,
  });

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/web/query`,
      {},
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log the entire response from Agora for debugging purposes
    console.log(
      "Full query response from Agora:",
      JSON.stringify(response.data, null, 2)
    );

    // Extract and log the fileList
    if (response.data.serverResponse && response.data.serverResponse.fileList) {
      console.log(
        "File list from Agora:",
        JSON.stringify(response.data.serverResponse.fileList, null, 2)
      );
      return res.json({
        fileList: response.data.serverResponse.fileList,
      });
    } else {
      console.log(
        "Files not ready yet or no fileList returned:",
        response.data
      );
      return res
        .status(200)
        .json({ message: "Files not ready yet. Please try again later." });
    }
  } catch (error) {
    console.error(
      "Error querying for recording status:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    return res.status(500).json({
      error: "Failed to query recording status",
      details: error.response ? error.response.data : error.message,
    });
  }
});




app.get("/generate_recording_token", (req, res) => {
  const channelName = req.query.channelName;

  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  // Log the APP_ID and APP_CERTIFICATE (partially masked for security)
  console.log(
    `APP_ID: ${
      process.env.APP_ID
        ? process.env.APP_ID.substring(0, 5) + "..."
        : "Not Set"
    }`
  );
  console.log(
    `APP_CERTIFICATE: ${
      process.env.APP_CERTIFICATE
        ? process.env.APP_CERTIFICATE.substring(0, 5) + "..."
        : "Not Set"
    }`
  );

  if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const role = Role.PUBLISHER; // Use PUBLISHER role for recording

  console.log(
    `Generating token for channel: ${channelName}, UID: 0, Role: ${role}`
  );

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      "0",
      role,
      Math.floor(Date.now() / 1000) + 3600 // Token valid for 1 hour
    );

    // Log a portion of the generated token for verification
    console.log(
      `Generated token (first 10 characters): ${token.substring(0, 10)}...`
    );

    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});



// Stop recording endpoint
app.post("/stop", async (req, res) => {
  const { channelName, resourceId, sid, uid, timestamp } = req.body;

  if (!channelName || !resourceId || !sid || !uid || !timestamp) {
    return res.status(400).json({
      error: "channelName, resourceId, sid, uid, and timestamp are required",
    });
  }

  console.log("Stopping recording with details:", {
    channelName,
    resourceId,
    sid,
    uid,
  });

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {},
    };

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/web/stop`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Recording stopped on Agora");

    // After stopping, call the AWS S3 function to retrieve the MP4
    const getMp4Response = await axios.post(
      `${config.serverUrl}/getMp4FromS3`,
      {
        channelName: channelName,
        timestamp: timestamp,
      }
    );

    if (getMp4Response.data.files && getMp4Response.data.files.length > 0) {
      const mp4Url = getMp4Response.data.files[0];

      if (typeof bubble_fn_mp4 === "function") {
        bubble_fn_mp4(mp4Url);
      }

      res.json({
        message: "Recording stopped",
        mp4Url: mp4Url,
      });
    } else {
      res.status(500).json({ error: "No MP4 file found in S3" });
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to stop recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});



app.post("/getMp4FromS3", async (req, res) => {
  const { channelName, timestamp } = req.body;

  if (!channelName || !timestamp) {
    return res
      .status(400)
      .json({ error: "channelName and timestamp are required" });
  }

  const prefix = `recordings/${channelName}/${timestamp}/`;
  const bucketName = process.env.S3_BUCKET_NAME;

  try {
    const params = {
      Bucket: bucketName,
      Prefix: prefix,
    };

    const data = await s3.listObjectsV2(params).promise();

    const mp4Files = data.Contents.filter((file) => file.Key.endsWith(".mp4"));

    if (mp4Files.length === 0) {
      return res.status(404).json({ error: "No MP4 files found" });
    }

    const mp4Urls = mp4Files.map((file) => {
      return `https://${bucketName}.s3.amazonaws.com/${file.Key}`;
    });

    res.json({
      message: "MP4 files retrieved successfully",
      files: mp4Urls,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve MP4 files from S3",
      details: error.message,
    });
  }
});





module.exports = app;
