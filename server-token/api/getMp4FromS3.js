// AWS S3 Get MP4 files
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
    console.error("Error retrieving MP4 files from S3:", error);
    res.status(500).json({
      error: "Failed to retrieve MP4 files from S3",
      details: error.message,
    });
  }
});
