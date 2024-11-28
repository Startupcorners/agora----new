import { templateVideoParticipant } from "./templates.js"; // Import the template

let config = {
  debugEnabled: true,
  callContainerSelector: "#video-stage",
  participantPlayerContainer: templateVideoParticipant,
  appId: "95e91980e5444a8e86b4e41c7f03b713",
  uid: null,
  user: {
    name: "guest",
    avatar:
      "https://ui-avatars.com/api/?background=random&color=fff&name=loading",
    role: "", // host, audience (for rtc and rtm)
    company: "",
    rtmUid: "",
    designation: "",
    profileLink: "",
    uidSharingScreen: "",
    bubbleid: "",
    isRaisingHand: "no",
    roleInTheCall: "", // host, speaker, audience (for ui)
  },
  serverUrl: "https://agora-new.vercel.app",
  token: null,
  channelName: null,
  processor: null,
  localAudioTrackMuted: false, // These are needed in config
  localVideoTrackMuted: true,
  cameraToggleInProgress: false,
  defaultMic: null,
  selectedMic: null,
  defaultCam: null,
  selectedCam: null,
  audioRecordingRTMClient: null,
  screenShareRTCClient: null,
  screenShareRTMClient: null,
  sharingScreenUid: null,
  generatedScreenShareId: null,
  isVirtualBackGroundEnabled: false,
  localAudioTrack: null, // Ensure local tracks are initialized as null initially
  localVideoTrack: null,
  currentVirtualBackground: null,
  extensionVirtualBackground: null,
  listenersSetUp: false,
  resourceId: null,
  recordId: null,
  audioResourceId: null,
  usersRaisingHand: [],
  userTracks: {},
  lastMutedStatuses: {},
  lastMicPermissionState: null,
  audioRecordId: null,
  audioTimestamp: null,
  participantList: [],
  timestamp: null,
  sid: null,
  leaveReason: null,
  audioSid: null,
  usersPublishingVideo: [],
  usersPublishingAudio: [],
  audioResourceId: null,
  audioRecordId: null,
  audioTimestamp: null,
  // State management variables
  isRTMJoined: false,
  isRTCJoined: false,
  isOnStage: false,
  previousRoleInTheCall: null,
};

// Batching variables
let pendingUpdates = [];
let isProcessingBatch = false;

// Batch timer
const BATCH_INTERVAL = 50; // Process the batch every 50ms
setInterval(processBatch, BATCH_INTERVAL);

// Add an update to the batch queue
function updateConfig(newConfig, origin) {
  console.warn("Config update queued from", origin);
  pendingUpdates.push(newConfig); // Add the new update to the queue
}

// Process the batch queue
function processBatch() {
  if (isProcessingBatch || pendingUpdates.length === 0) {
    return; // Skip if already processing or no updates are pending
  }

  isProcessingBatch = true; // Set the lock

  try {
    // Merge all pending updates into a single object
    const combinedUpdates = pendingUpdates.reduce((acc, update) => {
      return { ...acc, ...update };
    }, {});

    // Apply the merged updates to the config
    config = { ...config, ...combinedUpdates };

    console.log("Batch processed:", combinedUpdates);

    // Clear the queue
    pendingUpdates = [];
  } catch (error) {
    console.error("Error processing batch:", error);
  } finally {
    isProcessingBatch = false; // Release the lock
  }
}

// Get the current config
function getConfig() {
  return config;
}

// Add updateAndGet function
async function updateAndGet(newConfig, origin) {
  // Queue the update
  updateConfig(newConfig, origin);

  // Wait for the current batch to process
  await new Promise((resolve) => {
    const checkBatch = setInterval(() => {
      if (!isProcessingBatch && pendingUpdates.length === 0) {
        clearInterval(checkBatch);
        resolve(); // Resolve once the batch has been processed
      }
    }, 10); // Check every 10ms
  });

  // Return the updated config
  return getConfig();
}

// Export functions
export { updateConfig, getConfig, updateAndGet };
