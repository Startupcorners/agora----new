export const enableVirtualBackgroundBlur = async (config) => {
  if (config.localVideoTrack) {
    console.log("Enabling virtual background blur...");
    const processor = await getProcessorInstance(config);
    if (!processor) {
      console.error("Failed to obtain processor instance for blur.");
      return;
    }
    console.log("Processor instance obtained for blur effect:", processor);

    processor.setOptions({ type: "blur", blurDegree: 2 });
    console.log("Processor options set for blur effect:", {
      type: "blur",
      blurDegree: 2,
    });

    await processor.enable();
    console.log("Virtual background blur enabled successfully.");

    config.isVirtualBackGroundEnabled = true;
  } else {
    console.warn(
      "Local video track not found; cannot enable virtual background blur."
    );
  }
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
    console.log("Processor instance obtained for image background:", processor);

    processor.setOptions({ type: "img", source: imgElement });
    console.log("Processor options set for image background:", {
      type: "img",
      source: imgElement,
    });

    await processor.enable();
    console.log("Virtual background image enabled successfully.");

    config.isVirtualBackGroundEnabled = true;
  };

  const base64 = await imageUrlToBase64(imageSrc);
  console.log("Image source converted to base64 for processing.");
  imgElement.src = base64;
};

export const disableVirtualBackground = async (config) => {
  console.log("Disabling virtual background...");

  const processor = await getProcessorInstance(config);
  if (!processor) {
    console.error("Failed to obtain processor instance for disabling.");
    return;
  }
  console.log("Processor instance obtained for disabling:", processor);

  await processor.disable();
  console.log("Virtual background disabled successfully.");

  config.isVirtualBackGroundEnabled = false;
};


export const getProcessorInstance = async (config) => {
  // Log the current state of config properties
  console.log("getProcessorInstance called with config:", config);

  if (!config) {
    console.error("Config is undefined or null.");
    return null;
  }

  // Check if processor, localVideoTrack, and extensionVirtualBackground are defined
  if (
    !config.processor &&
    config.localVideoTrack &&
    config.extensionVirtualBackground
  ) {
    try {
      // Log the state of localVideoTrack and extensionVirtualBackground
      console.log("localVideoTrack present:", config.localVideoTrack);
      console.log(
        "extensionVirtualBackground present:",
        config.extensionVirtualBackground
      );

      // Ensure the extension is properly initialized
      if (!config.extensionVirtualBackground.createProcessor) {
        console.error(
          "Virtual Background extension is not properly initialized or unavailable."
        );
        return null;
      }

      // Create the processor
      config.processor = config.extensionVirtualBackground.createProcessor();
      console.log("Processor created successfully:", config.processor);

      // Initialize the processor
      await config.processor.init();
      console.log("Processor initialized successfully.");

      // Pipe the processor to the local video track
      config.localVideoTrack
        .pipe(config.processor)
        .pipe(config.localVideoTrack.processorDestination);
      console.log("Processor successfully piped to local video track.");
    } catch (e) {
      // Log detailed error information
      console.error("Failed to initialize the processor. Error:", e);
      config.processor = null;
      return null;
    }
  } else {
    // Log why processor initialization was skipped
    if (config.processor) {
      console.log("Processor already exists, skipping initialization.");
    }
    if (!config.localVideoTrack) {
      console.warn(
        "localVideoTrack is missing, unable to initialize processor."
      );
    }
    if (!config.extensionVirtualBackground) {
      console.warn(
        "extensionVirtualBackground is missing, unable to initialize processor."
      );
    }
  }

  // Log the final state of config.processor before returning
  console.log("Returning processor:", config.processor);
  return config.processor;
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
