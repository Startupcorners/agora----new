import { getConfig, updateConfig } from "./config.js";

export const toggleVirtualBackground = async (imageSrc) => {
  let config = getConfig();
  console.log("toggleVirtualBackground called with imageSrc:", imageSrc);

  // Check if the virtual background is already enabled with the same image
  if (config.currentVirtualBackground === imageSrc) {
    console.log("Virtual background matches current image, disabling.");
    await disableVirtualBackground(config);
  } else if (imageSrc !== "blur") {
    console.log("Switching to image-based virtual background.");
    await enableVirtualBackgroundImage(config, imageSrc);
  } else {
    console.log("Switching to blur effect virtual background.");
    await enableVirtualBackgroundBlur(config);
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
    config.isVirtualBackGroundEnabled = true;
    config.currentVirtualBackground = "blur";
    updateConfig(config, "enableVirtualBackgroundBlur");
  } catch (error) {
    console.error("Error enabling virtual background blur:", error);
  }
};


export const enableVirtualBackgroundImage = async (config, imageSrc) => {
  console.log("Enabling virtual background with image source:", imageSrc);
  const imgElement = document.createElement("img");

  // Image loaded event
  imgElement.onload = async () => {
    console.log("Image loaded for virtual background.");

    try {
      // Attempt to get the processor instance
      const processor = await getProcessorInstance(config);

      if (!processor) {
        console.warn(
          "Failed to obtain processor instance for image background. Proceeding without processor."
        );
      } else {
        // If processor exists, set the background with the processor
        processor.setOptions({ type: "img", source: imgElement });
        console.log("Processor options set for image background.");
        await processor.enable();
      }

      // Regardless of processor success, update the background state
      bubble_fn_background(imageSrc); // Notify Bubble with the image source
      config.isVirtualBackGroundEnabled = true;
      config.currentVirtualBackground = imageSrc;
      updateConfig(config, "enableVirtualBackgroundImage");
    } catch (error) {
      console.error("Error enabling virtual background image:", error);
    }
  };

  // Convert image URL to Base64 before assigning it to the img element
  const base64 = await imageUrlToBase64(imageSrc);
  imgElement.src = base64;
};


export const disableVirtualBackground = async (config) => {
  console.log("Disabling virtual background...");

  // Retrieve processor from config
  const processor = config.processor;

  // Check if processor is initialized
  if (!processor) {
    console.warn(
      "Processor is not initialized. Proceeding to disable virtual background without processor."
    );
  } else {
    try {
      // If processor exists, disable it
      await processor.disable();
      console.log("Virtual background disabled successfully.");
    } catch (error) {
      console.error("Error disabling virtual background:", error);
    }
  }

  // Notify Bubble to reset the background to "none"
  bubble_fn_background("none");

  // Update the config state
  config.isVirtualBackGroundEnabled = false;
  config.currentVirtualBackground = null;
  updateConfig(config, "disableVirtualBackground");
};


export const getProcessorInstance = async (config) => {
  const uid = config.uid; // Ensure the uid is correctly retrieved from the config
  const userTrack = config.userTracks[uid];

  if (config.processor) {
    console.log("Reusing existing processor.");
    return config.processor;
  }

  console.log("Creating new processor.");

  // Check if the necessary video track and virtual background extension are available
  if (
    !userTrack ||
    !userTrack.videoTrack ||
    !config.extensionVirtualBackground
  ) {
    console.warn("Missing video track or virtual background extension.");
    return null;
  }

  try {
    // If a processor exists, unpipe it from the video track before creating a new one
    if (config.processor) {
      console.log("Unpiping existing processor from video track.");
      userTrack.videoTrack.unpipe(config.processor);
    }

    // Create and initialize a new processor
    config.processor = config.extensionVirtualBackground.createProcessor();
    await config.processor.init();

    // Pipe the processor to the video track
    userTrack.videoTrack
      .pipe(config.processor)
      .pipe(userTrack.videoTrack.processorDestination);
    console.log("Processor created and piped to video track.");
    updateConfig(config, "getProcessorInstanceSuccess");

    return config.processor;
  } catch (error) {
    console.error("Failed to initialize processor:", error);
    config.processor = null;
    updateConfig(config, "getProcessorInstanceFailed");
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
