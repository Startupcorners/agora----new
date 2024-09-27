// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
} from "./rtcEventHandlers.js";


export const setupEventListeners = (config) => {
  const client = config.client;

  // Handle when a user publishes their media (audio/video)
  client.on("user-published", handleUserPublished);

  // Handle when a user stops publishing their media
  client.on("user-unpublished", handleUserUnpublished);

  // Modify the user-joined handler to trigger both immediate and full updates
  client.on("user-joined", async (user) => {
    // Call the immediate join handler (from config)
    if (config.onParticipantJoined) {
      await config.onParticipantJoined(user);
    } else {
      console.error("onParticipantJoined is not defined in config");
    }

    // Continue with the existing handleUserJoined to fully update the participant list
    await handleUserJoined(user);
  });

  // Handle when a user leaves the session
  client.on("user-left", handleUserLeft);

  // Enable the audio volume indicator
  client.enableAudioVolumeIndicator();

  // Handle volume indicator changes
  client.on("volume-indicator", (volume) => {
    if (config.onVolumeIndicatorChanged) {
      config.onVolumeIndicatorChanged(volume);
    } else {
      console.error("onVolumeIndicatorChanged is not defined in config");
    }
  });
};
