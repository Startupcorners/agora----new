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
  const processor = await getProcessorInstance(config);
  if (!processor) {
    console.error("Failed to obtain processor instance for blur.");
    return;
  }

  processor.setOptions({ type: "blur", blurDegree: 2 });
  console.log("Processor options set for blur effect.");
  await processor.enable();

  bubble_fn_background("blur");
  config.isVirtualBackGroundEnabled = true;
  config.currentVirtualBackground = "blur";
  updateConfig(config, "enableVirtualBackgroundBlur");
};

export const enableVirtualBackgroundImage = async (config, imageSrc) => {
  console.log("Enabling virtual background with image source:", imageSrc);
  const imgElement = document.createElement("img");
  imgElement.onload = async () => {
    console.log("Image loaded for virtual background.");

    const processor = await getProcessorInstance(config);
    if (!processor) {
      console.error(
        "Failed to obtain processor instance for image background."
      );
      return;
    }

    processor.setOptions({ type: "img", source: imgElement });
    console.log("Processor options set for image background.");
    await processor.enable();

    bubble_fn_background(imageSrc);
    config.isVirtualBackGroundEnabled = true;
    config.currentVirtualBackground = imageSrc;
    updateConfig(config, "enableVirtualBackgroundImage");
  };

  const base64 = await imageUrlToBase64(imageSrc);
  imgElement.src = base64;
};

export const disableVirtualBackground = async (config) => {
  console.log("Disabling virtual background...");
  const processor = config.processor;
  if (!processor) {
    console.error("Processor is not initialized.");
    return;
  }

  await processor.disable();
  console.log("Virtual background disabled successfully.");
  bubble_fn_background("none");

  config.isVirtualBackGroundEnabled = false;
  config.currentVirtualBackground = null;
  updateConfig(config, "disableVirtualBackground");
  
};

export const getProcessorInstance = async (config) => {
  if (config.processor) {
    console.log("Reusing existing processor.");
    return config.processor;
  }

  console.log("Creating new processor.");
  if (!config.localVideoTrack || !config.extensionVirtualBackground) {
    console.warn("Missing video track or virtual background extension.");
    return null;
  }

  try {
    // If a processor exists, unpipe it from the video track before creating a new one
    if (config.processor) {
      console.log("Unpiping existing processor from video track.");
      config.localVideoTrack.unpipe(config.processor);
    }

    // Create and initialize a new processor
    config.processor = config.extensionVirtualBackground.createProcessor();
    await config.processor.init();

    // Pipe the processor to the video track
    config.localVideoTrack
      .pipe(config.processor)
      .pipe(config.localVideoTrack.processorDestination);
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
