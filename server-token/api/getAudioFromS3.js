const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Function to get audio files from S3
const getAudioFromS3 = async (channelName, timestamp) => {
  if (!channelName || !timestamp) {
    throw new Error("channelName and timestamp are required");
  }

  const prefix = `recordings/${channelName}/${timestamp}/`;
  const bucketName = process.env.S3_BUCKET_NAME;

  try {
    const params = {
      Bucket: bucketName,
      Prefix: prefix,
    };

    const data = await s3.listObjectsV2(params).promise();

    // Filter audio files (e.g., AAC or M4A formats)
    const audioFiles = data.Contents.filter(
      (file) => file.Key.endsWith(".aac") || file.Key.endsWith(".m4a")
    );

    if (audioFiles.length === 0) {
      throw new Error("No audio files found");
    }

    // Generate audio URLs
    const audioUrls = audioFiles.map((file) => {
      return `https://${bucketName}.s3.amazonaws.com/${file.Key}`;
    });

    return audioUrls; // Return the array of audio file URLs
  } catch (error) {
    console.error("Error retrieving audio files from S3:", error);
    throw new Error("Failed to retrieve audio files from S3");
  }
};

module.exports = getAudioFromS3;
