const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: "us-east-1",
});

// Function to get the .m3u8 file from S3
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

    console.log(`Checking S3 path: ${prefix}`);
    const data = await s3.listObjectsV2(params).promise();

    // Filter for .m3u8 files
    const playlistFiles = data.Contents.filter((file) =>
      file.Key.endsWith(".m3u8")
    );

    if (playlistFiles.length === 0) {
      throw new Error(`No .m3u8 files found at path: ${prefix}`);
    }

    // Generate URLs for the .m3u8 files
    const playlistUrls = playlistFiles.map((file) => {
      return `https://${bucketName}.s3.amazonaws.com/${file.Key}`;
    });

    console.log("Found .m3u8 playlist files:", playlistUrls);

    // Return the first .m3u8 file (or all if needed)
    return playlistUrls[0]; // Returning only the first .m3u8 file URL
  } catch (error) {
    console.error("Error retrieving .m3u8 files from S3:", error);
    throw new Error("Failed to retrieve .m3u8 files from S3");
  }
};

module.exports = getAudioFromS3;
