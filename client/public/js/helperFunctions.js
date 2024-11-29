export const sendRTMMessage = async (message) => {
  console.warn("sendRTMMessage called with message:", message);

  try {
    if (config.channelRTM) {
      await config.channelRTM.sendMessage({ text: message });
      console.log("Message sent to RTM channel:", message);
    } else {
      console.warn("RTM channel is not initialized.");
    }
  } catch (error) {
    console.error("Failed to send RTM message:", error);
  }
};










