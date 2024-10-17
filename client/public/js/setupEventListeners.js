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

export const setupRTMMessageListener = (clientRTM, config) => {
  if (!clientRTM) {
    console.error("RTM client not initialized.");
    return;
  }

  if (!config.channelRTM) {
    console.error("RTM channel not initialized.");
    return;
  }

  // Listen for channel messages on the RTM channel
  config.channelRTM.on("ChannelMessage", async (message, memberId) => {
    console.log(
      `RTM:INFO Received a channel text message from ${memberId}`,
      message
    );

    // Ensure the message contains text content
    if (message && message.text) {
      console.log(`Received message text: ${message.text}`); // Log the message text

      try {
        // Parse the message text as JSON
        const parsedMessage = JSON.parse(message.text);
        console.log("Parsed RTM message:", parsedMessage);

        // Handle the parsed message based on type and action
        if (parsedMessage.type === "screenshare") {
          const { action, uid } = parsedMessage;

          // Ensure userTracks[uid] is initialized
          if (!userTracks[uid]) {
            userTracks[uid] = {};
          }

          if (action === "start") {
            console.log(`User ${uid} started screen sharing.`);

            // Update userTracks to reflect that the user is screen sharing
            userTracks[uid].isScreenSharing = true;

            // Trigger the screen share start flow
            toggleStages(true, uid);
            manageCameraState(uid); // Update the UI elements
          } else if (action === "stop") {
            console.log(`User ${uid} stopped screen sharing.`);

            // Update userTracks to reflect that the user stopped screen sharing
            userTracks[uid].isScreenSharing = false;
            userTracks[uid].screenShareTrack = null; // Clear screen share track

            // Trigger the screen share stop flow
            toggleStages(false, uid);
            manageCameraState(uid); // Update the UI elements
          }
        }
      } catch (error) {
        console.error("Error parsing RTM message:", error);
      }
    } else {
      console.warn(
        "Received a message without text content or unrecognized format."
      );
    }
  });
};
