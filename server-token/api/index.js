app.post("/start", async (req, res) => {
  const { channelName, resourceId, uid, token } = req.body;

  if (!channelName || !resourceId || !uid || !token) {
    return res.status(400).json({
      error: "channelName, resourceId, uid, and token are required",
    });
  }

  // Log S3 environment variables
  console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "Not Defined");
  console.log("S3_ACCESS_KEY:", process.env.S3_ACCESS_KEY || "Not Defined");
  console.log("S3_SECRET_KEY:", process.env.S3_SECRET_KEY || "Not Defined");

  try {
    const authorizationToken = Buffer.from(
      `${process.env.CUSTOMER_ID}:${process.env.CUSTOMER_SECRET}`
    ).toString("base64");

    // Define the payload to Agora for starting recording
    const payload = {
      cname: channelName,
      uid: uid,
      clientRequest: {
        token: token,
        recordingConfig: {
          maxIdleTime: 30,
          streamTypes: 2,
          channelType: 0,
          videoStreamType: 0,
          transcodingConfig: {
            width: 1280,
            height: 720,
            bitrate: 1000,
            fps: 30,
            mixedVideoLayout: 1,
            backgroundColor: "#FFFFFF",
          },
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"],
        },
        storageConfig: {
          vendor: 2, // 2 is for AWS S3
          region: 0, // Adjust region code based on your bucket location
          bucket: process.env.S3_BUCKET_NAME, // Ensure this is defined correctly
          accessKey: process.env.S3_ACCESS_KEY, // AWS Access Key
          secretKey: process.env.S3_SECRET_KEY, // AWS Secret Key
        },
      },
    };

    // Log the payload being sent to Agora
    console.log(
      "Payload being sent to Agora for start recording:",
      JSON.stringify(payload, null, 2)
    );

    // Send the start recording request to Agora
    const startRecordingResponse = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      payload,
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log Agora's response
    console.log("Agora start recording response:", startRecordingResponse.data);

    const { sid } = startRecordingResponse.data;
    console.log("Recording started with sid:", sid);

    res.json({ resourceId, sid });
  } catch (error) {
    // Log error details
    console.error(
      "Error starting recording:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to start recording" });
  }
});
