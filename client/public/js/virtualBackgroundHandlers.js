export const enableVirtualBackgroundBlur = async (config) => {
  if (config.localVideoTrack) {
    console.log("Enabling virtual background blur...");
    let processor = await getProcessorInstance(config);
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

    let processor = await getProcessorInstance();
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

  let processor = await getProcessorInstance(config);
  console.log("Processor instance obtained for disabling:", processor);

  await processor.disable();
  console.log("Virtual background disabled successfully.");

  config.isVirtualBackGroundEnabled = false;
};

export const getProcessorInstance = async (config) => {
  if (!config.processor && config.localVideoTrack) {
    config.processor = config.extensionVirtualBackground.createProcessor();

    try {
      await config.processor.init();
    } catch (e) {
      console.error("Fail to load WASM resource!");
      return null;
    }
    config.localVideoTrack
      .pipe(config.processor)
      .pipe(config.localVideoTrack.processorDestination);
  }
  return config.processor;
};

export const imageUrlToBase64 = async (url) => {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
    reader.onerror = reject;
  });
};
