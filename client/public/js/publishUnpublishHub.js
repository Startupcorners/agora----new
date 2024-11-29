import {handleVideoPublished, handleVideoUnpublished} from "./video.js"
import { handleAudioUnpublished, handleAudioPublished } from "./audio.js";

// Handles user published event
export const handleUserPublished = async (user, mediaType, client, config) => {
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

  // Handle the media subscription based on the mediaType
  if (mediaType === "video") {
    await handleVideoPublished(user, userUid, config, client);
  } else if (mediaType === "audio") {
    await handleAudioPublished(user, userUid, config, client);
  } else {
    console.warn(`Unsupported mediaType: ${mediaType}`);
  }
};

export const handleUserUnpublished = async (user, mediaType, config) => {
  console.log("Entered handleuserUnpublished:", user);
  console.log("User :", user);
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

 










