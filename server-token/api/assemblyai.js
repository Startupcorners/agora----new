const axios = require("axios");

const sendToAssemblyAiAndGetSummary = async (mp4Url) => {
  try {
    const response = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: mp4Url,
        auto_highlights: true,
        summarization: true,
        summary_model: "informative", // Replace with "conversational" or "catchy" if needed
        summary_type: "bullets",
      },
      {
        headers: {
          authorization: process.env.ASSEMBLY_AI_API_KEY, // Ensure you have your AssemblyAI key in your environment variables
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error sending MP4 to AssemblyAI:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

module.exports = sendToAssemblyAiAndGetSummary;
