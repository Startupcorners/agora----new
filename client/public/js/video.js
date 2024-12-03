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


let processor = null;

let localVideoTrack = null;

let imageSourcetwo =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472390057x747743675763905500/workplace-arrangement-with-laptop.jpg";
let imageSourceThree =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472407250x607742611177520800/modern-company-manager-workplace-bright-office.jpg";
let imageSourceFour =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472419422x923666776481338000/laptop-table-modern-office-interior-workplace-concept-3d-rendering.jpg";
let imageSourceFive =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472444979x386006437542762100/photorealistic-view-tree-nature-with-branches-trunk.jpg";
let imageSourceSix =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472481033x216203155346062820/outdoor-swimming-pool-hotel-resort-neary-sea-beach.jpg";
let imageSourceSeven =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472499422x793571029245521400/majestic-mountain-peaks-reflected-tranquil-pond-waters-generated-by-ai.jpg";
let imageSourceEight =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472521369x113030800942868220/light-up-laser-show-beautiful-architecture-kiyomizu-dera-t.jpg";
let imageSourceNine =
  "https://8904bc7641660798a0e7eb5706b6a380.cdn.bubble.io/f1716472534264x734120863095309300/dreamy-aesthetic-color-year-tones-nature-landscape.jpg";



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
    localVideoTrack = videoTrack;

    // Publish the video track
    await client.publish([videoTrack]);
    console.log("Camera turned on and published.");

    // Update UI
    if (sharingScreenUid === config.uid.toString()) {
      await playStreamInDiv(config, config.uid, "#pip-video-track");
    } else {
      await playStreamInDiv(config, config.uid, `#stream-${config.uid}`);
    }
    // Handle virtual background if enabled
    if (isVirtualBackGroundEnabled) {
      console.log("Virtual background is enabled.");
      await enableVirtualBackground(currentVirtualBackground, config); // Apply blur if that's the selected background
    } else {
      console.log("Virtual background is not enabled.");
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
  const videoTrack = localVideoTrack

  try {
    console.log("Turning off the camera for user:", config.uid);

    if (processor && currentVirtualBackground) {
      await processor.disable(); // Disable the processor
      await videoTrack.unpipe(); // Unpipe the video track from the processor
      await processor.unpipe();
      await processor.release(); // Disable the processor
    }

    console.log("Unpublishing video track globally...");
    await client.unpublish([videoTrack]);
      

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


export const toggleVirtualBackground = async (config, index) => {

  // Check if the virtual background is already enabled with the same image
  if (currentVirtualBackground === index) {
    console.log("Virtual background matches current image, disabling.");
    await disableVirtualBackground(config); // No need for config here
  } else {
    console.log("Switching to image-based virtual background.");
    await enableVirtualBackground(index, config); // Pass the imageSrc directly
  }
};

// In enableVirtualBackgroundImage
export const enableVirtualBackground = async (index, config) => {
  console.log(`Enabling virtual background using processor index: ${index}`);


 processor = await getProcessorInstance(config);



  const videoTrack = localVideoTrack
  console.log("videoTrack", videoTrack);

  if (!videoTrack) {
    console.warn(
      "No video track found. Virtual background state updated without processor."
    );
    isVirtualBackGroundEnabled = true;
    currentVirtualBackground = index;
    return;
  }

  try {
    const imageSources = [
      imageSourcetwo,
      imageSourceThree,
      imageSourceFour,
      imageSourceFive,
      imageSourceSix,
      imageSourceSeven,
      imageSourceEight,
      imageSourceNine,
    ];

    if (index === 1) {
      console.log("Configuring blur processor.");
      processor.setOptions({
        type: "blur",
        blurDegree: 2,
      });
      console.log("Blur processor configured successfully.");
    } else {
      const imageSource = imageSources[index - 2]; // Adjust for 1-based index
      if (!imageSource) {
        console.error(`No image source found for index ${index}.`);
        return;
      }
      console.log(`Selected Image`, imageSource);
      try {
        const imageElement = await imageUrlToImageElement(imageSource);
        processor.setOptions({ type: "img", source: imageElement });
        console.log("Virtual background set successfully.");
      } catch (error) {
        console.error("Failed to set virtual background:", error);
      }
      console.log(`Processor configured with image source for index ${index}.`);
    }

    // Enable and pipe the processor
    videoTrack.pipe(processor).pipe(videoTrack.processorDestination);
    await processor.enable();
    // Update state
    isVirtualBackGroundEnabled = true;
    currentVirtualBackground = index;
    bubble_fn_background(index);
    console.log(`Virtual background enabled with processor index: ${index}.`);
    console.log("Config", config);
    console.log(processor); // Disable the processor
  } catch (error) {
    console.error(
      `Error enabling virtual background for index ${index}:`,
      error
    );
  }
};





export const disableVirtualBackground = async (config) => {
  console.log("Disabling virtual background...");

  const videoTrack = localVideoTrack;

      await processor.disable(); // Disable the processor
      await videoTrack.unpipe(); // Unpipe the video track from the processor
      await processor.unpipe();
      await processor.release(); // Disable the processor
      console.log("Virtual background disabled successfully.");

  // Notify Bubble and update state variables
  if (typeof bubble_fn_background === "function") {
    bubble_fn_background();
  } else {
    console.warn("bubble_fn_background function not found.");
  }
  isVirtualBackGroundEnabled = false;
  currentVirtualBackground = null;

  console.log("Virtual background state reset to default.");
  console.log("Config", config);
};



// In getProcessorInstance
export const getProcessorInstance = async (config) => {
  try {
    console.log("Initializing new virtual background processor...");
    processor = config.extensionVirtualBackground.createProcessor();
    await processor.init();
    console.log("Processor initialized successfully.");
    return processor;
  } catch (error) {
    console.error("Failed to initialize processor:", error);
    return null;
  }
};



export const imageUrlToImageElement = async (url) => {
  try {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    return img;
  } catch (error) {
    console.error("Failed to load image:", error);
    throw error;
  }
};

