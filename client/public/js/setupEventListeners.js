// Import RTC handlers
import {
  handleUserPublished,
  handleUserUnpublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
} from "./rtcEventHandlers.js";
import {
  startScreenShare,
  stopScreenShare,
  manageCameraState,
  playCameraVideo,
  showAvatar,
  toggleStages,
} from "./videoHandlers.js";
import { userTracks } from "./state.js"; 


export const setupEventListeners = (config) => {
  const client = config.client;

  // Handle when a user publishes their media (audio/video)
  client.on("user-published", async (user, mediaType) => {
    await handleUserPublished(user, mediaType, config, client);
  });

  // Handle when a user stops publishing their media
  client.on("user-unpublished", async (user, mediaType) => {
    await handleUserUnpublished(user, mediaType, config);
  });

  // Handle when a user joins the session
  client.on("user-joined", async (user) => {
    console.log(`User joined: ${user.uid}`); // Add this log to check if the event is triggered
    await handleUserJoined(user, config); // Directly use the handler
  });

  // Handle when a user leaves the session
  client.on("user-left", async (user) => {
    await handleUserLeft(user, config); // Directly use the handler
  });

  // Enable the audio volume indicator
  client.enableAudioVolumeIndicator();

  // Handle volume indicator changes
  client.on("volume-indicator", async (volumes) => {
    await handleVolumeIndicator(volumes, config); // Directly use the handler
  });
};

