const getAudioFromS3 = require("./getAudioFromS3");

// Poll for audio file from AWS S3
const pollForAudio = async (
  resourceId,
  channelName,
  timestamp,
  maxAttempts = 20, // Total number of attempts
  delay = 30000 // 30 seconds delay between attempts
) => {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      // Try to get audio files from S3
      const audioFiles = await getAudioFromS3(channelName, timestamp);

      if (audioFiles && audioFiles.length > 0) {
        console.log("Audio files found:", audioFiles);
        return audioFiles[0]; // Return the first audio file URL
      } else {
        console.log(
          `Attempt ${attempts + 1}: Audio file not found. Retrying...`
        );
      }
    } catch (error) {
      console.error(
        `Attempt ${attempts + 1}: Error fetching audio from S3`,
        error
      );
    }

    // Wait for the specified delay before trying again
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempts++;
  }

  throw new Error("Audio file not found in AWS S3 after maximum attempts.");
};

module.exports = pollForAudio;
