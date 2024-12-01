import { handleVideoPublished, handleVideoUnpublished } from "./video.js";
import { handleAudioUnpublished, handleAudioPublished } from "./audio.js";

// Map to track ongoing promises for each user
// Map to track ongoing promises for each user
const ongoingPromises = new Map();

/**
 * Manage promises for a specific userUid.
 * @param {string} userUid - The UID of the user.
 * @param {string} action - The action to perform: "add", "get", "remove".
 * @param {Promise} [promise] - The promise to add (required for "add").
 * @returns {Promise|undefined} - The current promise (for "get") or undefined.
 */
export const manageUserPromise = (userUid, action, promise = null) => {
  switch (action) {
    case "add":
      if (!promise) {
        throw new Error("Promise is required for the 'add' action.");
      }
      console.log(`Adding a promise for user: ${userUid}`);
      ongoingPromises.set(userUid, promise);
      break;

    case "get":
      console.log(`Retrieving promise for user: ${userUid}`);
      return ongoingPromises.get(userUid);

    case "remove":
      console.log(`Removing promise for user: ${userUid}`);
      ongoingPromises.delete(userUid);
      break;

    default:
      console.error(`Unknown action: ${action}. Use 'add', 'get', or 'remove'.`);
  }
};

// Handles user published event
export const handleUserPublished = async (user, mediaType, config) => {
  const userUid = user.uid.toString();
  console.log(
    `handleUserPublished for user: ${userUid}, mediaType: ${mediaType}`
  );

  // Skip subscribing to local user's own media
  if (userUid === config.uid.toString()) {
    console.log("Skipping subscription to local user's own media.");
    return;
  }

  // Skip processing for UID 2 (e.g., reserved UID for a different purpose)
  if (userUid === "2") {
    console.log("Skipping processing for UID 2.");
    return;
  }

  // If there is an ongoing promise for the same user, wait for it to finish
  if (ongoingPromises.has(userUid)) {
    console.log(
      `A promise is already running for user: ${userUid}. Waiting...`
    );
    await ongoingPromises.get(userUid);
    console.log(`Promise for user: ${userUid} completed. Proceeding.`);
  }

  // Wrap the media handling in a tracked promise
  const promise = (async () => {
    try {
      // Handle the media subscription based on the mediaType
      if (mediaType === "video") {
        await handleVideoPublished(user, userUid, config);
      } else if (mediaType === "audio") {
        await handleAudioPublished(user, userUid, config);
      } else {
        console.warn(`Unsupported mediaType: ${mediaType}`);
      }
    } catch (error) {
      console.error(
        `Error handling media published for user: ${userUid}, mediaType: ${mediaType}`,
        error
      );
    } finally {
      // Remove the promise from the map once completed
      ongoingPromises.delete(userUid);
      console.log(`Promise for user: ${userUid} removed from map.`);
    }
  })();

  // Store the promise in the map
  ongoingPromises.set(userUid, promise);

  // Wait for the current promise to complete
  await promise;
};

// Handles user unpublished event
export const handleUserUnpublished = async (user, mediaType, config) => {
  console.log("Entered handleUserUnpublished:", user);
  const userUid = user.uid.toString();
  console.log(
    `handleUserUnpublished called for user: ${userUid}, mediaType: ${mediaType}`
  );

  if (mediaType === "video") {
    await handleVideoUnpublished(user, userUid, config);
  } else if (mediaType === "audio") {
    await handleAudioUnpublished(user, userUid, config);
  } else {
    console.warn(`Unsupported mediaType: ${mediaType}`);
  }
};
