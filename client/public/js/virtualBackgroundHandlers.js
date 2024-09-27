import { getProcessorInstance, imageUrlToBase64 } from './helperFunctions.js'; // Assuming `getProcessorInstance` and `imageUrlToBase64` are in `helperFunctions.js`

export const enableVirtualBackgroundBlur = async (config) => {
  if (config.localVideoTrack) {
    let processor = await getProcessorInstance(config);
    processor.setOptions({ type: "blur", blurDegree: 2 });
    await processor.enable();

    config.isVirtualBackGroundEnabled = true;
  }
};

export const enableVirtualBackgroundImage = async (config, imageSrc) => {
  const imgElement = document.createElement("img");
  imgElement.onload = async () => {
    let processor = await getProcessorInstance();
    processor.setOptions({ type: "img", source: imgElement });
    await processor.enable();

    config.isVirtualBackGroundEnabled = true;
  };

  const base64 = await imageUrlToBase64(imageSrc);
  imgElement.src = base64;
};

export const disableVirtualBackground = async (config) => {
  let processor = await getProcessorInstance(config);
  processor.disable();

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
