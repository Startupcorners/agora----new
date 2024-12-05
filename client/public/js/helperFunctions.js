export const sendRTMMessage = async (message, config) => {
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



export function sendNotification(type, message, config) {
  const errorMessage = {
    type: type || "ERROR_NOTIFICATION", // Default type is "ERROR_NOTIFICATION"
    message: message || "An error occurred.",
    timestamp: Date.now(),
    user: config.uid, // Include the user UID
  };

  try {
    sendRTMMessage(JSON.stringify(errorMessage), config);
    console.log("Error message sent to RTM channel.");
  } catch (rtmError) {
    console.error("Failed to send error message via RTM:", rtmError);
  }
}







