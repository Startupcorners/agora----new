import { playStreamInDiv, toggleStages } from "./videoHandlers.js";
import { updatePublishingList } from "./talkToBubble.js";
import { fetchTokens } from "./fetchTokens.js";

let sharingScreenUid = null; // Declare the sharingScreenUid outside of config
let screenShareRTMClient = null;
let screenShareRTCClient = null;
let generatedScreenShareId = null;
let screenShareTrackExternal = null;
let cameraToggleInProgress = false; // External variable to track camera toggle progress
let isVirtualBackGroundEnabled = false; // External variable for virtual background enabled state
let currentVirtualBackground = null; // External variable for the current virtual background
let processor = null; // External variable to hold the processor instance

export const handleVideoPublished = async (user, userUid, config) => {
  const client = config.client
  console.log(`Handling video published for user: ${userUid}`);

  // Special case: Handle screen share (userUid > 999999999)
  if (userUid > 999999999) {
    console.log(`User ${userUid} is a screen share publisher.`);

    try {
      // Fetch attributes for UID > 999999999 to get sharing user details
      console.log(
        `Fetching attributes for screen-sharing user (UID: ${userUid})...`
      );
      const attributes = await config.clientRTM.getUserAttributes(
        userUid.toString()
      );

      const newSharingUserUid = attributes.sharingScreenUid;
      const sharingAvatar = attributes.avatar || "default-avatar.png";

      console.log(`Screen share is from remote user: ${newSharingUserUid}`);
      console.log(`current sharingScreenUid: ${sharingScreenUid}`);

      // Skip if the current screen share is from the local user
      if (sharingScreenUid === newSharingUserUid) {
        console.log("Local user is currently sharing. Skipping processing.");
        return;
      }

      // Set sharingScreenUid to the sharing user's UID
      sharingScreenUid = newSharingUserUid;
      generatedScreenShareId = userUid.toString();
      bubble_fn_userSharingScreen(sharingScreenUid);
      bubble_fn_isScreenOn(false);

      // Update the PiP avatar
      const avatarElement = document.getElementById("pip-avatar");
      if (avatarElement) {
        avatarElement.src = sharingAvatar;
        console.log(`Updated PiP avatar to ${sharingAvatar}.`);
      } else {
        console.warn("Could not find the PiP avatar element to update.");
      }

      // Subscribe to the screen share track using the client object
      await client.subscribe(user, "video");

      // Play screen share track
      playStreamInDiv(config, userUid, "#screen-share-content");
      playStreamInDiv(config, sharingScreenUid, "#pip-video-track"); 


      // Toggle stage to screen share
      toggleStages(true);
    } catch (error) {
      console.error("Error processing screen share:", error);
    }

    return;
  }

  // General video handling for other users
  try {
    await client.subscribe(user, "video");

    console.log(`Subscribed to video track for user ${userUid}`);

    // Update the publishing list
    updatePublishingList(userUid.toString(), "video", "add");

    if (sharingScreenUid) {
      playStreamInDiv(config, userUid, "#pip-video-track");
    } else {
      playStreamInDiv(config, userUid, `#stream-${userUid}`);
    }
  } catch (error) {
    console.error(`Error subscribing to video for user ${userUid}:`, error);
  }
};

export const handleVideoUnpublished = async (user, userUid, config) => {
  console.log(`Handling video unpublishing for user: ${userUid}`);

  // Special case: Handle screen share (UID > 999999999)
  if (userUid > 999999999) {
    console.log(`Screen share track unpublished for UID: ${userUid}.`);

    try {
      // Check if the local user is the one sharing
      if (sharingScreenUid === config.uid.toString()) {
        console.log(
          `Local user (UID: ${userUid}) was sharing. Stopping local screen share.`
        );

        // Log the UID of the screenShareRTCClient
        console.log(
          `UID of the screenShareRTCClient being logged out: ${screenShareRTCClient.uid}`
        );

        // Log and logout from screenShareRTMClient
        console.log(
          `Attempting to log out from screenShareRTMClient for UID: ${screenShareRTCClient.uid}...`
        );
        await screenShareRTMClient.logout();
        console.log(
          `Successfully logged out from screenShareRTMClient for UID: ${screenShareRTCClient.uid}.`
        );

        // Log and leave screenShareRTCClient
        console.log(
          `Attempting to leave screenShareRTCClient for UID: ${screenShareRTCClient.uid}...`
        );
        await screenShareRTCClient.leave();
        console.log(
          `Successfully left screenShareRTCClient for UID: ${screenShareRTCClient.uid}.`
        );

        // Reset global variables
        screenShareRTMClient = null;
        screenShareRTCClient = null;
        sharingScreenUid = null;
        generatedScreenShareId = null;
        bubble_fn_userSharingScreen(sharingScreenUid);

        return; // Exit as local user cleanup is already handled
      }

      // If another user was previously sharing, restore their video
      if (sharingScreenUid !== userUid.toString()) {
        console.log("Restoring previous user's video.");

        toggleStages(false); // Hide screen share stage

        // Stop the video track if it's still active
        if (user.videoTrack) {
          user.videoTrack.stop();
          console.log(`Stopped video track for user ${userUid}`);
        }

        // Play the stream in the UI for the previous screen share user
        playStreamInDiv(
          config,
          sharingScreenUid,
          `#stream-${sharingScreenUid}`
        );

        // Reset screen share tracking
        screenShareRTMClient = null;
        screenShareRTCClient = null;
        screenShareTrackExternal = null;
        generatedScreenShareId = null;
        sharingScreenUid = null;
        bubble_fn_userSharingScreen(sharingScreenUid);
      }
    } catch (error) {
      console.error("Error handling screen share unpublishing:", error);
    }

    return;
  }

  // General video handling for other users
  console.log(`User ${userUid} has unpublished their video track.`);

  if (user.videoTrack) {
    user.videoTrack.stop();
    console.log(`Stopped video track for user ${userUid}`);
  }

  // Update the publishing list to remove the user
  updatePublishingList(userUid.toString(), "video", "remove");

  // Stop displaying the user's video in the UI
  playStreamInDiv(config, userUid, `#stream-${userUid}`);
};

export const toggleScreenShare = async (config) => {
  console.log("sharingScreenUid", sharingScreenUid);

  try {
    if (sharingScreenUid !== config.uid.toString()) {
      await startScreenShare(config); // Start screen share
    } else {
      await stopScreenShare(config); // Stop screen share
    }
  } catch (error) {
    console.error("Error during screen share toggle:", error);
  }
};

const generateRandomScreenShareUid = () => {
  return Math.floor(Math.random() * (4294967295 - 1000000000 + 1)) + 1000000000;
};

export const startScreenShare = async (config) => {
  const screenShareUid = generateRandomScreenShareUid();
  const uid = config.uid;

  console.log("Initializing screen share process...");

  try {
    // Step 1: Create a new screen share session
    console.log("Creating screen share video track...");
    screenShareTrackExternal = await AgoraRTC.createScreenVideoTrack().catch(
      (error) => {
        console.warn("Screen sharing was canceled by the user.", error);
        return null; // Gracefully handle cancellation
      }
    );

    if (!screenShareTrackExternal) {
      console.log(
        "Screen share track creation was canceled. Aborting screen share setup."
      );
      return; // Exit early if user cancels
    }

    console.log("Screen share video track created successfully.");

    // Fetch tokens for the screenShareUid
    console.log("Fetching tokens for screenShareUid...");
    const tokens = await fetchTokens(config, screenShareUid);
    if (
      !tokens ||
      typeof tokens.rtcToken !== "string" ||
      typeof tokens.rtmToken !== "string"
    ) {
      console.error("Invalid RTC or RTM tokens for screen sharing.");
      screenShareTrackExternal.stop();
      screenShareTrackExternal.close();
      return;
    }
    console.log("Tokens fetched successfully:", tokens);

    // Initialize RTM client for screen sharing
    console.log("Creating a new RTM client for screen sharing...");
    screenShareRTMClient = AgoraRTM.createInstance(config.appId);
    await screenShareRTMClient.login({
      uid: screenShareUid.toString(),
      token: tokens.rtmToken,
    });
    console.log("Screen share RTM client logged in successfully.");

    // Set RTM attributes
    const user = config.user || {};
    const attributes = {
      name: user.name || "Unknown",
      avatar: user.avatar || "default-avatar-url",
      company: user.company || "Unknown",
      sharingScreenUid: uid.toString(),
    };
    console.log("Setting RTM attributes:", attributes);
    await screenShareRTMClient.setLocalUserAttributes(attributes);

    // Initialize RTC client for screen sharing
    console.log("Creating a new RTC client for screen sharing...");
    screenShareRTCClient = AgoraRTC.createClient({
      mode: "rtc",
      codec: "vp8",
    });

    // Join RTC channel
    console.log(`Joining RTC with screenShareUid ${screenShareUid}...`);
    await screenShareRTCClient.join(
      config.appId,
      config.channelName,
      tokens.rtcToken,
      screenShareUid
    );

    // Publish the screen share track
    console.log("Publishing screen share video track...");
    await screenShareRTCClient.publish(screenShareTrackExternal);
    console.log("Screen share video track published successfully.");
    bubble_fn_isScreenOn(true);

    // Listen for the browser's stop screen sharing event
    screenShareTrackExternal.on("track-ended", async () => {
      console.log("Screen sharing stopped via browser UI.");
      await stopScreenShare(config); // Cleanup resources and update UI
    });

    // Toggle UI
    toggleStages(true);
    playStreamInDiv(
      config,
      screenShareUid,
      "#screen-share-content",
      screenShareTrackExternal
    );
    playStreamInDiv(config, uid, "#pip-video-track");

    // Update PiP avatar
    const avatarElement = document.getElementById("pip-avatar");
    if (avatarElement) {
      avatarElement.src = user.avatar || "default-avatar.png";
    }

    // Update external variable with new screen share info
    sharingScreenUid = config.uid.toString(); // Set sharingScreenUid directly
    generatedScreenShareId = screenShareUid;
    bubble_fn_userSharingScreen(sharingScreenUid);

    console.log("Screen sharing started successfully.");
} catch (error) {
  console.error("Error during screen share initialization:", error);
} 
}


export const stopScreenShare = async (config) => {
  // Check if the current user is the one sharing the screen
  if (sharingScreenUid !== config.uid.toString()) {
    console.warn(
      `User with UID ${config.uid} attempted to stop screen sharing, but the sharing UID is ${sharingScreenUid}. Action denied.`
    );
    return; // Exit the function if the user is not the screen sharer
  }

  const screenShareUid = generatedScreenShareId; // Use the dynamic UID
  console.log("Stopping screen share for UID:", screenShareUid);

  // Use the external screen share track
  if (screenShareTrackExternal) {
    try {
      // Unpublish the screen share track
      await screenShareRTCClient.unpublish([screenShareTrackExternal]);
      screenShareTrackExternal.stop();
      screenShareTrackExternal.close();

      console.log("Screen share stopped successfully.");
      bubble_fn_isScreenOn(false);
    } catch (error) {
      console.error("Error while stopping the screen share track:", error);
    }
  } else {
    console.warn("No screen share track found.");
  }

  // Toggle UI
  toggleStages(false);
  playStreamInDiv(config, config.uid, `#stream-${config.uid}`);

  // Reset the sharing screen UID
  sharingScreenUid = null;
  generatedScreenShareId = null;

  console.log("Screen share stopped and external variable updated.");
};


export const toggleCamera = async (config) => {
  const client = config.client;

  try {
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    console.log("User's UID:", config.uid);
    console.log("Config", config);

    if (cameraToggleInProgress) {
      console.warn("Camera toggle already in progress, skipping...");
      return;
    }

    cameraToggleInProgress = true; // Prevent simultaneous toggles

    // Find the local video track
    const localVideoTrack = client.localTracks?.find(
      (track) => track.trackMediaType === "video"
    );

    if (localVideoTrack && localVideoTrack.enabled) {
      // User is trying to turn off the camera if it's enabled
      console.log("Camera is active; turning it off...");
      await stopCamera(config); // Mute the camera
    } else {
      // User is trying to turn on the camera if it's disabled or null
      console.log("Camera is inactive or not found; turning it on...");
      await startCamera(config); // Activate the camera
    }
  } catch (error) {
    console.error("Error toggling the camera for user:", config.uid, error);
  } finally {
    cameraToggleInProgress = false; // Reset toggle state
    console.log("Camera toggle progress reset for user:", config.uid);
  }
};

export const startCamera = async (config) => {
  const client = config.client;

  try {
    if (!config || !config.uid) {
      throw new Error("Config object or UID is missing.");
    }

    console.log("Turning on the camera for user:", config.uid);
    const videoTrack = await AgoraRTC.createCameraVideoTrack();

      // Publish the video track
    await client.publish([videoTrack]);
      console.log("Camera turned on and published.");

    // Handle virtual background if enabled
    if (isVirtualBackGroundEnabled) {
      console.log("Virtual background is enabled.");

      if (currentVirtualBackground === "blur") {
        console.log("Applying blur as the virtual background...");
        await enableVirtualBackgroundBlur(config); // Apply blur if that's the selected background
        console.log("Blur virtual background applied successfully.");
      } else if (currentVirtualBackground) {
        console.log(
          `Applying custom virtual background image: ${currentVirtualBackground}...`
        );
        await enableVirtualBackgroundImage(currentVirtualBackground, config); // Apply custom virtual background image
        console.log(
          `Custom virtual background image (${currentVirtualBackground}) applied successfully.`
        );
      } else {
        console.log("No specific virtual background is selected.");
      }
    } else {
      console.log("Virtual background is not enabled.");
    }

    // Update UI
    if (sharingScreenUid === config.uid.toString()) {
      playStreamInDiv(config, config.uid, "#pip-video-track");
    } else {
      playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
    }

    // Notify Bubble of the camera state
    if (typeof bubble_fn_isCamOn === "function") {
      bubble_fn_isCamOn(true); // Camera is on
    }
    console.log("Config", config);
  } catch (error) {
    console.error("Error starting the camera for user:", config.uid, error);
  }
};

export const stopCamera = async (config) => {
  const client = config.client;
  const localVideoTrack = client.localTracks?.find(
    (track) => track.trackMediaType === "video"
  );

  try {
    console.log("Turning off the camera for user:", config.uid);

    console.log("Unpublishing video track globally...");
    await client.unpublish([localVideoTrack]);
      

      console.log("Camera turned off and unpublished.");
      updatePublishingList(config.uid.toString(), "video", "remove");

      // Update UI
      if (sharingScreenUid === config.uid.toString()) {
        playStreamInDiv(config, config.uid, "#pip-video-track");
      } else {
        playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
      }
      console.log("Config", config);

      // Notify Bubble of the camera state
      if (typeof bubble_fn_isCamOn === "function") {
        bubble_fn_isCamOn(false); // Camera is off
      }
    
  } catch (error) {
    console.error("Error stopping the camera for user:", config.uid, error);
  }
};


export const toggleVirtualBackground = async (imageSrc, config) => {
  console.log("toggleVirtualBackground called with imageSrc:", imageSrc);

  // Check if the virtual background is already enabled with the same image
  if (currentVirtualBackground === imageSrc) {
    console.log("Virtual background matches current image, disabling.");
    await disableVirtualBackground(config); // No need for config here
  } else if (imageSrc !== "blur") {
    console.log("Switching to image-based virtual background.");
    await enableVirtualBackgroundImage(imageSrc, config); // Pass the imageSrc directly
  } else {
    console.log("Switching to blur effect virtual background.");
    await enableVirtualBackgroundBlur(config); // Call blur directly
  }
};

export const enableVirtualBackgroundBlur = async (config) => {
  console.log("Enabling virtual background blur...");

  try {
    const processor = await getProcessorInstance(config);

    if (!processor) {
      console.warn(
        "Failed to obtain processor instance for blur. Proceeding without processor."
      );
    } else {
      // If processor exists, set its options and enable the blur effect
      processor.setOptions({ type: "blur", blurDegree: 2 });
      console.log("Processor options set for blur effect.");
      await processor.enable();
    }

    // Regardless of processor success, update the virtual background state
    bubble_fn_background("blur"); // Notify Bubble of the blur effect
    isVirtualBackGroundEnabled = true; // Set the external variable
    currentVirtualBackground = "blur"; // Set the external variable
  } catch (error) {
    console.error("Error enabling virtual background blur:", error);
  }
};

// In enableVirtualBackgroundImage
export const enableVirtualBackgroundImage = async (imageSrc, config) => {
  console.log("Enabling virtual background with image source:", imageSrc);

  const videoTrack = config.client.localTracks?.find(
    (track) => track.trackMediaType === "video"
  );

  if (!videoTrack) {
    console.warn(
      "No video track found. Updating background state without processor."
    );
    bubble_fn_background(imageSrc);
    isVirtualBackGroundEnabled = true;
    currentVirtualBackground = imageSrc;
    return;
  }

  try {
    const base64 = await imageUrlToBase64(imageSrc);
    const imgElement = document.createElement("img");

    imgElement.onload = async () => {
      console.log("Image loaded for virtual background.");

      try {
        const processor = await getProcessorInstance(config);

        if (!processor) {
          console.warn(
            "Failed to obtain processor instance. Proceeding without processor."
          );
        } else {
          processor.setOptions({ type: "img", source: imgElement });
          console.log("Processor options set for image background.");
          await processor.enable();

          // Now, pipe the processor to the video track
          videoTrack.unpipe(processor);
          videoTrack.pipe(processor).pipe(videoTrack.processorDestination);
          console.log("Processor piped to video track after setting options.");
        }

        bubble_fn_background(imageSrc);
        isVirtualBackGroundEnabled = true;
        currentVirtualBackground = imageSrc;
      } catch (error) {
        console.error("Error enabling virtual background image:", error);
      }
    };

    imgElement.src = base64;
  } catch (error) {
    console.error("Error processing virtual background image:", error);
  }
};



export const disableVirtualBackground = async (config) => {
  console.log("Disabling virtual background...");

  const videoTrack = config.client.localTracks?.find(
    (track) => track.trackMediaType === "video"
  );

  if (processor && videoTrack) {
    try {
      await processor.disable(); // Disable the processor

      // Unpipe the processor and processorDestination from the video track
      videoTrack.unpipe();

      console.log("Virtual background disabled successfully.");
    } catch (error) {
      console.error("Error disabling virtual background:", error);
    }
  } else {
    console.warn(
      "Processor is not initialized or video track not found. Skipping processor disable step."
    );
  }

  // Notify Bubble and update external state variables
  bubble_fn_background("none");
  isVirtualBackGroundEnabled = false;
  currentVirtualBackground = null;
  processor = null;

  console.log("Virtual background state reset to default.");
};



// In getProcessorInstance
export const getProcessorInstance = async (config) => {
  const client = config.client;
  const userTrack = client.localTracks?.find(
    (track) => track.trackMediaType === "video"
  );

  if (processor) {
    console.log("Reusing existing processor.");
    return processor;
  }

  console.log("Creating new processor.");

  if (!userTrack || !config.extensionVirtualBackground) {
    console.warn("Missing video track or virtual background extension.");
    return null;
  }

  try {
    if (processor) {
      console.log("Unpiping existing processor from video track.");
      userTrack.unpipe(processor);
    }

    // Create and initialize a new processor without piping
    processor = config.extensionVirtualBackground.createProcessor();
    await processor.init();
    console.log("Processor created but not yet piped to video track.");

    // Return the processor without piping
    return processor;
  } catch (error) {
    console.error("Failed to initialize processor:", error);
    processor = null;
    return null;
  }
};


export const imageUrlToBase64 = async (url) => {
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
    });
  } catch (error) {
    console.error("Failed to convert image URL to base64. Error:", error);
    throw error;
  }
};


