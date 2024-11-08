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
import { join } from "./main.js"; 





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

  console.log("Current user's rtmUid:", config); // Log the current user's rtmUid

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

    // Parse the message text as JSON if it contains structured data
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.text);
    } catch (error) {
      // If parsing fails, it's likely a plain text message (e.g., "waiting room")
      parsedMessage = { text: message.text };
    }

    // Handle different types of messages
    if (parsedMessage.type === "roleChange") {
      // Handle role change messages
      const { userUid, newRole, newRoleInTheCall } = parsedMessage;
      console.log(
        `Received role change for user ${userUid}: role: ${newRole}, roleInTheCall: ${newRoleInTheCall}`
      );

      // Combine role changes with existing user attributes
      const updatedAttributes = {
        ...userAttributes,
        role: newRole,
        roleInTheCall: newRoleInTheCall,
      };

      // Update the user’s role and roleInTheCall on the local client
      manageParticipants(userUid, updatedAttributes, "join");

      // If the role change is for the current user, call the join function
      if (userUid === config.user.rtmUid) {
        // Direct comparison with config.user.rtmUid
        console.log(
          "Role change is for the current user. Running the join function."
        );
        join()
          .then(() => {
            console.log("Joined successfully due to role change."); // Log successful join
          })
          .catch((error) => {
            console.error("Error joining after role change:", error);
          });
      }
    } else if (
      parsedMessage.text &&
      parsedMessage.text.includes("waiting room")
    ) {
      // Handle waiting room messages
      console.log(
        "Triggering manageParticipants for user in the waiting room:",
        memberId
      );
      manageParticipants(memberId, userAttributes, "join");
    }
  });

  console.log("RTM message listener initialized.");
};
