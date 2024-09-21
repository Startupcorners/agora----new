const transcribeMp4FromUrl = async (resourceId, mp4Url) => {
  const audio = {
    uri: mp4Url, // Use the public MP4 URL directly
  };

  const config = {
    encoding: "MP4", // Specify MP4 encoding
    sampleRateHertz: 16000, // Adjust the sample rate according to your audio file
    languageCode: "en-US", // Specify the language code
  };

  const request = {
    audio: audio,
    config: config,
  };

  try {
    // Send request to Google for transcription
    const [response] = await client.recognize(request);

    const transcript = response.results
      .map((result) => result.alternatives[0].transcript)
      .join("\n");

    console.log(`Transcript: ${transcript}`);

    // Send transcript back to Bubble API
    await axios.post(
      "https://sccopy-38403.bubbleapps.io/api/1.1/wf/receivegoogletranscript",
      {
        ressourceID: resourceId,
        transcript: transcript, // Send the transcript back to Bubble
      }
    );

    console.log(
      `Successfully sent transcript to Bubble for resource ID: ${resourceId}`
    );
    return transcript;
  } catch (error) {
    console.error("Error transcribing MP4 from URL:", error);
    throw error;
  }
};
