const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Make sure this is set in your environment variables
});

const openaiClient = new OpenAIApi(configuration);

const summarizeTranscript = async (transcript) => {
  try {
    const prompt = `Please summarize the following transcript: ${transcript}`;

    // Request to GPT-4 to summarize the transcript
    const response = await openaiClient.createCompletion({
      model: "gpt-4",
      prompt: prompt,
      max_tokens: 200, // Adjust token count based on desired summary length
    });

    const summary = response.data.choices[0].text.trim();
    console.log(`Summary: ${summary}`);
    return summary;
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
};

// Define the transcript summary endpoint
const transcriptSummaryEndpoint = async (req, res) => {
  const { transcript, resourceId } = req.body;

  if (!transcript || !resourceId) {
    return res.status(400).json({
      error: "transcript and resourceId are required",
    });
  }

  try {
    const summary = await summarizeTranscript(transcript);

    // Send summary to Bubble API
    await axios.post(
      "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receivesummary",
      {
        resourceId: resourceId,
        summary: summary,
      }
    );

    res.json({ message: "Summary generated and sent to Bubble", summary });
  } catch (error) {
    console.error("Error generating or sending summary:", error);
    res.status(500).json({ error: "Failed to generate or send summary" });
  }
};

module.exports = { summarizeTranscript, transcriptSummaryEndpoint };
