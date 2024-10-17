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
  clientRTM.on("MessageFromPeer", async (message, peerId) => {
    try {
      // Parse the received message
      const parsedMessage = JSON.parse(message.text);
      console.log(`Received RTM message from peer ${peerId}:`, parsedMessage);

      // Handle screen share events
      if (parsedMessage.type === "screen-share") {
        const { action, uid } = parsedMessage;

        if (action === "start") {
          console.log(`User ${uid} started screen sharing.`);
          // Trigger the generalized function to handle screen share start
          toggleStages(true, uid); // Show screen-share stage
          manageCameraState(uid); // Handle camera and avatar display logic
        } else if (action === "stop") {
          console.log(`User ${uid} stopped screen sharing.`);
          // Trigger the generalized function to handle screen share stop
          toggleStages(false, uid); // Switch back to video stage
          manageCameraState(uid); // Handle camera and avatar display logic
        }
      }
    } catch (error) {
      console.error("Error handling RTM message:", error);
    }
  });

  console.log("RTM message listener set up successfully.");
};
