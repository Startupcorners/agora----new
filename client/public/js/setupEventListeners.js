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

export const setupRTMMessageListener = (
  channelRTM,
  manageParticipants,
  config
) => {
  if (!channelRTM) {
    console.warn("RTM channel is not initialized.");
    return;
  }

  // Listen for messages on the RTM channel
  channelRTM.on("ChannelMessage", async (message, memberId) => {
    console.log("Received RTM message:", message.text);

    // Retrieve and log the attributes of the user who sent the message
    let userAttributes = {};
    try {
      userAttributes = await config.clientRTM.getUserAttributes(memberId);
      console.log(`Attributes for user ${memberId}:`, userAttributes);
    } catch (error) {
      console.error(
        `Failed to retrieve attributes for user ${memberId}:`,
        error
      );
    }

    // Check if the message text contains "waiting room"
    if (message.text.includes("waiting room")) {
      console.log(
        "Triggering manageParticipants for user in the waiting room:",
        memberId
      );
      manageParticipants(memberId, userAttributes, config, "join");
    }
  });

  console.log("RTM message listener initialized.");
};
