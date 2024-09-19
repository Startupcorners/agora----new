// agoraRTCClient.js
import { log } from "./utils.js";
import {
  handleUserPublished,
  handleUserUnpublished,
  handleUserJoined,
  handleUserLeft,
  handleVolumeIndicator,
  handleRenewToken,
} from "./eventHandlers.js";

export const setupAgoraRTCClient = (config) => {
  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
  AgoraRTC.setLogLevel(config.debugEnabled ? 0 : 4);

  // Set up event listeners
  client.on("user-published", handleUserPublished(config, client));
  client.on("user-unpublished", handleUserUnpublished(config));
  client.on("user-joined", handleUserJoined(config));
  client.on("user-left", handleUserLeft(config));
  client.enableAudioVolumeIndicator();
  client.on("volume-indicator", handleVolumeIndicator(config));
  client.on("token-privilege-will-expire", handleRenewToken(config, client));

  AgoraRTC.onCameraChanged = (info) => {
    config.onCameraChanged(info);
  };
  AgoraRTC.onMicrophoneChanged = (info) => {
    config.onMicrophoneChanged(info);
  };
  AgoraRTC.onPlaybackDeviceChanged = (info) => {
    config.onSpeakerChanged(info);
  };

  return client;
};
