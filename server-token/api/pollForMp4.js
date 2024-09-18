const getMp4FromS3 = require("./getMp4FromS3"); // Import the function directly

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
      // Call the getMp4FromS3 function directly instead of making an HTTP request
      const mp4Files = await getMp4FromS3(resourceId, channelName, timestamp);

      if (mp4Files && mp4Files.length > 0) {
        console.log("MP4 files found:", mp4Files);
        return mp4Files[0]; // Return the first MP4 file URL
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

module.exports = pollForMp4;
