const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Function to get MP4 files from S3
const getMp4FromS3 = async (channelName, timestamp) => {
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

    const mp4Files = data.Contents.filter((file) => file.Key.endsWith(".mp4"));

    if (mp4Files.length === 0) {
      throw new Error("No MP4 files found");
    }

    // Generate MP4 URLs
    const mp4Urls = mp4Files.map((file) => {
      return `https://${bucketName}.s3.amazonaws.com/${file.Key}`;
    });

    return mp4Urls; // Return the array of MP4 file URLs
  } catch (error) {
    console.error("Error retrieving MP4 files from S3:", error);
    throw new Error("Failed to retrieve MP4 files from S3");
  }
};

module.exports = getMp4FromS3;
