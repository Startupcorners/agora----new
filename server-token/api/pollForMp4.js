const axios = require("axios");
const nocache = (req, res, next) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
};

// Poll for MP4 file from AWS S3
const pollForMp4 = async (
  resourceId,
  channelName,
  timestamp,
  maxAttempts = 20,
  delay = 30000
) => {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.post(
        `${process.env.SERVER_URL}/getMp4FromS3`,
        {
          resourceId: resourceId,
          channelName: channelName,
          timestamp: timestamp,
        }
      );

      const data = response.data;

      if (response.status === 200 && data.files && data.files.length > 0) {
        console.log("MP4 files found:", data.files);
        return data.files[0]; // Return the first MP4 file URL
      } else {
        console.log(`Attempt ${attempts + 1}: MP4 file not found. Retrying...`);
      }
    } catch (error) {
      console.error(
        `Attempt ${attempts + 1}: Error fetching MP4 from S3`,
        error
      );
    }

    // Wait for the specified delay before trying again
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempts++;
  }

  throw new Error("MP4 file not found in AWS S3 after maximum attempts.");
};

module.exports = { pollForMp4 };
