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
    console.log(`user-published event received for user: ${user.uid}, mediaType: ${mediaType}`);
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

// eventListeners.js

export const setupRTMMessageListener = (channelRTM, manageParticipants, config) => {
  if (!channelRTM) {
    console.warn("RTM channel is not initialized.");
    return;
  }

  // Listen for messages on the RTM channel
  channelRTM.on("ChannelMessage", (message, memberId) => {
    console.log("Received RTM message:", message.text);

    // Check if the message text matches our trigger for managing participants
    if (message.text === "trigger_manage_participants") {
      console.log("Triggering manageParticipants for user:", memberId);
      manageParticipants(config.uid, config.user, config);
    }
  });

  console.log("RTM message listener initialized.");
};
