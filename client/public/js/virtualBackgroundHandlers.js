export const toggleVirtualBackground = async (config, imageSrc = "") => {
  // Log the function call and provided imageSrc
  console.log("toggleVirtualBackground called with imageSrc:", imageSrc);

  // Check if the virtual background is already enabled
  if (config.isVirtualBackGroundEnabled) {
    console.log("Virtual background is currently enabled. Disabling it...");
    await disableVirtualBackground(config);
  } else {
    // Virtual background is currently disabled
    if (imageSrc) {
      // If imageSrc is provided, enable virtual background with the image
      console.log("Enabling virtual background with image.");
      await enableVirtualBackgroundImage(config, imageSrc);
    } else {
      // If no imageSrc is provided, enable virtual background with blur effect
      console.log("Enabling virtual background with blur effect.");
      await enableVirtualBackgroundBlur(config, 2); // Assuming blur degree of 2
    }
  }
};

export const enableVirtualBackgroundBlur = async (config) => {
  if (config.localVideoTrack) {
    console.log("Enabling virtual background blur...");
    const processor = await getProcessorInstance(config);
    if (!processor) {
      console.error("Failed to obtain processor instance for blur.");
      return;
    }
    console.log("Processor instance obtained for blur effect:", processor);

    // Set blur options with a default blur degree
    processor.setOptions({ type: "blur", blurDegree: 2 });
    console.log("Processor options set for blur effect:", {
      type: "blur",
      blurDegree: 2,
    });

    // Enable the processor to apply the blur effect
    await processor.enable();
    console.log("Virtual background blur enabled successfully.");
    bubble_fn_background("blur");

    // Update config to indicate that virtual background is enabled
    config.isVirtualBackGroundEnabled = true;
    config.currentVirtualBackground = "blur"; // Track current background type
  } else {
    console.warn(
      "Local video track not found; cannot enable virtual background blur."
    );
  }
};

export const enableVirtualBackgroundImage = async (config, imageSrc) => {
  console.log("Enabling virtual background with image source:", imageSrc);

  // Create an image element to load the image for processing
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

    // Set processor options with the loaded image as the background
    processor.setOptions({ type: "img", source: imgElement });
    console.log("Processor options set for image background:", {
      type: "img",
      source: imgElement,
    });

    // Enable the processor to apply the image background
    await processor.enable();
    console.log("Virtual background image enabled successfully.");
    bubble_fn_background(imageSrc);

    // Update config to indicate that virtual background is enabled
    config.isVirtualBackGroundEnabled = true;
    config.currentVirtualBackground = "image"; // Track current background type
  };

  // Convert the image source to base64 to load it properly
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

  // Disable the processor to remove any virtual background effects
  await processor.disable();
  console.log("Virtual background disabled successfully.");
  bubble_fn_background("none");

  // Update config to indicate that virtual background is disabled
  config.isVirtualBackGroundEnabled = false;
  config.currentVirtualBackground = null; // Clear current background type
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
