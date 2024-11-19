const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Function to poll for the .mp4 file in S3
const getAudioFromS3 = async (channelName, timestamp) => {
  if (!channelName || !timestamp) {
    throw new Error("channelName and timestamp are required");
  }

  const prefix = `recordings/${channelName}/${timestamp}/`;
  const bucketName = process.env.S3_BUCKET_NAME;

  const maxAttempts = 10; // Maximum number of polling attempts
  const delayBetweenAttempts = 5000; // Delay between attempts in milliseconds (e.g., 5000ms = 5 seconds)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const params = {
        Bucket: bucketName,
        Prefix: prefix,
      };

      console.log(`Attempt ${attempt}: Checking S3 path: ${prefix}`);
      const data = await s3.listObjectsV2(params).promise();

      // Filter for .mp4 files
      const mp4Files = data.Contents.filter((file) =>
        file.Key.endsWith(".mp4")
      );

      if (mp4Files.length === 0) {
        console.log(`No .mp4 files found at path: ${prefix}`);
        if (attempt < maxAttempts) {
          console.log(
            `Waiting ${
              delayBetweenAttempts / 1000
            } seconds before next attempt...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenAttempts)
          );
          continue; // Retry
        } else {
          throw new Error(
            `No .mp4 files found at path: ${prefix} after ${maxAttempts} attempts`
          );
        }
      }

      // Generate URLs for the .mp4 files
      const mp4Urls = mp4Files.map((file) => {
        return `https://${bucketName}.s3.amazonaws.com/${file.Key}`;
      });

      console.log("Found .mp4 files:", mp4Urls);

      // Return the first .mp4 file (or modify as needed)
      return mp4Urls[0]; // Returning only the first .mp4 file URL
    } catch (error) {
      console.error("Error retrieving .mp4 files from S3:", error);
      throw new Error("Failed to retrieve .mp4 files from S3");
    }
  }
};

module.exports = getAudioFromS3;
