import "./main.js";
import "./handles.js";

const fetchTokens = async () => {
  try {
    const res = await fetch(
      config.serverUrl +
        `/generateTokens?channelName=${config.channelName}&uid=${config.uid}&role=${config.user.role}`,
      {
        method: "GET", // Ensure method is GET
        headers: {
          "Cache-Control": "no-cache", // Prevent caching
          Pragma: "no-cache", // HTTP 1.0 backward compatibility
          Expires: "0", // Force immediate expiration
        },
      }
    );
    const data = await res.json();
    return {
      rtcToken: data.rtcToken, // Extract the RTC token
      rtmToken: data.rtmToken, // Extract the RTM token
    };
  } catch (err) {
    console.error("Failed to fetch tokens:", err);
    throw err;
  }
};
const join = async () => {
  try {
    // Fetch the token first
    const { appId, uid, channelName } = config;
    const tokens = await fetchTokens();
    console.log("RTC Token (during join):", tokens.rtcToken);
    console.log("RTM Token (during join):", tokens.rtmToken);
    console.log("RTC UID (during join):", config.uid);

    if (!tokens) {
      throw new Error("Failed to fetch token");
    }

    console.log("Token fetched successfully:", tokens);

    // Join the Agora channel
    await client.join(appId, channelName, tokens.rtcToken, uid);
    console.log(`Joined Agora channel: ${channelName} with UID: ${uid}`);

    // Set up token renewal
    client.on("token-privilege-will-expire", handleRenewToken);

    // Set the client's role based on the user's role
    await client.setClientRole(
      config.user.role === "audience" ? "audience" : "host"
    );
    console.log(`Set client role to: ${config.user.role}`);

    // Register common event listeners for all users
    setupEventListeners();

    // Join the RTM (Real-Time Messaging) channel
    await joinRTM(tokens.rtmToken); // Pass the token to joinRTM

    // If the user needs to join the video stage (e.g., host or speaker), proceed to publish tracks
    if (config.onNeedJoinToVideoStage(config.user)) {
      await joinToVideoStage(config.user);
    }
    // Audience members do not publish tracks or join the video stage
  } catch (error) {
    console.error("Error in join process:", error);
    // Handle the error appropriately (e.g., show an error message to the user)
  }
};

const setupEventListeners = () => {
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);
  client.enableAudioVolumeIndicator();
  client.on("volume-indicator", handleVolumeIndicator);
};

const joinToVideoStage = async (user) => {
  try {
    config.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    config.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    if (config.onNeedMuteCameraAndMic(user)) {
      toggleCamera(true);
      toggleMic(true);
    }

    let player = document.querySelector(`#video-wrapper-${user.id}`);
    if (player != null) {
      player.remove();
    }
    console.log("Avatar URL:", user.avatar);
    let localPlayerContainer = config.participantPlayerContainer
      .replaceAll("{{uid}}", user.id)
      .replaceAll("{{name}}", user.name)
      .replaceAll("{{avatar}}", user.avatar); // Ensure avatar is replaced as well

    document
      .querySelector(config.callContainerSelector)
      .insertAdjacentHTML("beforeend", localPlayerContainer);

    //need detect remote or not
    if (user.id === config.uid) {
      config.localVideoTrack.play(`stream-${user.id}`);

      await client.publish([config.localAudioTrack, config.localVideoTrack]);
    }
  } catch (error) {
    config.onError(error);
  }
};

const joinRTM = async (rtmToken, retryCount = 0) => {
  try {
    const rtmUid = config.uid.toString(); // Convert UID to string for RTM login

    // If the user is already logged in, attempt to log them out first
    if (clientRTM && clientRTM._logined) {
      console.log(`User ${rtmUid} is already logged in. Logging out...`);
      await clientRTM.logout();
      console.log(`User ${rtmUid} logged out successfully.`);
    }

    console.log("RTM Token (during login):", rtmToken);
    console.log("RTM UID (during login):", rtmUid);

    // RTM login with the token
    await clientRTM.login({ uid: rtmUid, token: rtmToken });
    console.log(`RTM login successful for UID: ${rtmUid}`);

    // Update participants after joining
    await handleOnUpdateParticipants();

    // Set up RTM event listeners
    setupRTMEventListeners();

    // Join the RTM channel
    await channelRTM.join();
    console.log(`Joined RTM channel successfully`);
  } catch (error) {
    console.error("RTM join process failed. Error details:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);

    if (error.code === 5) {
      console.error(
        "Token error detected. Please check your token generation process and Agora project settings."
      );
      console.error(
        "Make sure you're using a dynamic token, not a static key."
      );
      console.error(
        "Verify that your Agora project is configured for token authentication."
      );
    }

    if (retryCount < 3) {
      console.log(`Retrying RTM join (attempt ${retryCount + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
      return joinRTM(rtmToken, retryCount + 1);
    } else {
      throw new Error("Failed to join RTM after multiple attempts");
    }
  }
};

const setupRTMEventListeners = () => {
  clientRTM.on("MessageFromPeer", handleMessageFromPeer);
  channelRTM.on("MemberJoined", handleMemberJoined);
  channelRTM.on("MemberLeft", handleMemberLeft);
  channelRTM.on("ChannelMessage", handleChannelMessage);
};
