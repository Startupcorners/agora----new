const axios = require("axios");

const assemblyAiApiKey = process.env.ASSEMBLY_AI_API_KEY;

const sendToAssemblyAiAndGetSummary = async (mp4Url) => {
  try {
    const response = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: mp4Url,
        auto_highlights: true, // Enables highlights
        summarization: true,   // Enables summarization
        summary_type: "bullets", // 'bullets', 'gist', or 'headline'
      },
      {
        headers: {
          authorization: assemblyAiApiKey,
          "content-type": "application/json",
        },
      }
    );

    const transcriptId = response.data.id;

    let summary = "";

    while (true) {
      const transcriptResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: assemblyAiApiKey,
          },
        }
      );

      if (transcriptResponse.data.status === "completed") {
        summary = transcriptResponse.data.summary;
        break;
      } else if (transcriptResponse.data.status === "failed") {
        throw new Error("Transcription and summarization failed");
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return summary;
  } catch (error) {
    console.error("Error sending MP4 to AssemblyAI:", error);
    throw error;
  }
};

module.exports = sendToAssemblyAiAndGetSummary;
