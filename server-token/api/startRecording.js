const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/start", async (req, res) => {
  const { channelName, resourceId, uid, token, timestamp } = req.body;

  if (!channelName || !resourceId || !uid || !token || !timestamp) {
    console.error("Missing required parameters:", {
      channelName,
      resourceId,
      uid,
      token,
      timestamp,
    });
    return res.status(400).json({
      error: "channelName, resourceId, uid, token, and timestamp are required",
    });
  }

  console.log("App ID:", process.env.APP_ID);
  console.log("Resource ID:", resourceId);

  console.log("Start recording request for:", {
    channelName,
    resourceId,
    uid,
    token,
    timestamp,
  });

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        token: token,
        extensionServiceConfig: {
          errorHandlePolicy: "error_abort",
          extensionServices: [
            {
              serviceName: "web_recorder_service",
              errorHandlePolicy: "error_abort",
              serviceParam: {
                url: `https://sccopy-38403.bubbleapps.io/video/1726195519465x346418864932257800?r=1721913797942x965183480405939000&isaws=yes`,
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
          fileNamePrefix: ["recordings", channelName, timestamp],
        },
      },
    };

    console.log(
      "Payload sent to Agora for start recording:",
      JSON.stringify(payload, null, 2)
    );

    const response = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/resourceid/${resourceId}/mode/web/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Start recording response:", response.data);

    if (response.data.sid) {
      console.log("SID received:", response.data.sid);
      res.json({ resourceId, sid: response.data.sid, timestamp });
    } else {
      console.error("No SID in response:", response.data);
      res
        .status(500)
        .json({ error: "Failed to start recording: No SID received" });
    }
  } catch (error) {
    console.error("Error starting recording:", error);
    res.status(500).json({
      error: "Failed to start recording",
      details: error.response ? error.response.data : error.message,
    });
  }
});

module.exports = router;
