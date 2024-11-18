const express = require("express");
const axios = require("axios");
const router = express.Router();

const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

router.post("/", nocache, async (req, res) => {
  const { channelName, uid, recordingType } = req.body;

  console.log(
    "Acquire request for channel:",
    channelName,
    "UID:",
    uid,
    "RecordingType:",
    recordingType
  );

  if (!channelName || !uid || !recordingType) {
    return res
      .status(400)
      .json({ error: "channelName, uid, and recordingType are required" });
  }

  // Define valid recording types and map them to corresponding scenes
  const validRecordingTypes = {
    web: 1, // Web recording
    composite: 0, // Composite recording
  };

  const scene = validRecordingTypes[recordingType];
  if (scene === undefined) {
    return res
      .status(400)
      .json({
        error: `Invalid recordingType. Valid options are: ${Object.keys(
          validRecordingTypes
        ).join(", ")}`,
      });
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
        scene: scene, // Dynamically set the scene based on recordingType
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

module.exports = router;
