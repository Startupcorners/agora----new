let usersPublishingAudio = [];
let usersPublishingVideo = [];
let participantList = [];

export const updatePublishingList = (uid, type, action) => {
  if (!uid || !type || !action) {
    console.error("Invalid arguments provided to updatePublishingList.");
    return;
  }

  // Determine which list to update
  let publishingList, bubbleFunction;
  if (type === "audio") {
    publishingList = usersPublishingAudio;
    bubbleFunction = bubble_fn_usersPublishingAudio;
  } else if (type === "video") {
    publishingList = usersPublishingVideo;
    bubbleFunction = bubble_fn_usersPublishingVideo;
  } else {
    console.error("Invalid type specified. Must be 'audio' or 'video'.");
    return;
  }

  if (action === "add") {
    if (!publishingList.includes(uid)) {
      publishingList.push(uid);
      console.log(`Added UID ${uid} to ${type} publishing list.`);
    }
  } else if (action === "remove") {
    const index = publishingList.indexOf(uid);
    if (index !== -1) {
      publishingList.splice(index, 1);
      console.log(`Removed UID ${uid} from ${type} publishing list.`);
    }
  } else {
    console.error("Invalid action specified. Must be 'add' or 'remove'.");
    return;
  }

  // Notify Bubble with the updated list
  if (typeof bubbleFunction === "function") {
    bubbleFunction(publishingList);
    console.log(`Notified Bubble with updated ${type} publishing list.`);
  } else {
    console.warn(`Bubble function for ${type} publishing is not defined.`);
  }
};


export const manageParticipants = async (userUid, userAttr, actionType) => {
  console.warn(
    `Managing participant list for user ${userUid} with action ${actionType}`
  );

  // Log the participant list before update
  console.log(
    "Participant list before update:",
    JSON.stringify(participantList, null, 2)
  );

  // Ensure consistent UID type
  const userUidNumber = Number(userUid); // Convert userUid to a number for consistent comparisons

  if (actionType === "join") {
    // Find the participant in the list
    const participantIndex = participantList.findIndex(
      (p) => p.uid === userUidNumber
    );

    if (participantIndex === -1) {
      // Add new participant if they don't exist in the list
      const newParticipant = {
        uid: userUidNumber,
        rtmUid: userAttr.rtmUid || "",
        name: userAttr.name || "Unknown",
        company: userAttr.company || "",
        designation: userAttr.designation || "",
        avatar: userAttr.avatar || "https://ui-avatars.com/api/?name=Unknown",
        role: userAttr.role || "audience",
        speakerId: userAttr.speakerId,
        participantId: userAttr.participantId,
        bubbleid: userAttr.bubbleid || "",
        isRaisingHand: userAttr.isRaisingHand || "no",
        roleInTheCall: userAttr.roleInTheCall || "audience",
      };
      participantList.push(newParticipant);
      console.log(`Participant ${userUid} has joined.`);
    } else {
      // Update existing participant details if they exist
      participantList[participantIndex] = {
        ...participantList[participantIndex],
        ...userAttr,
        uid: userUidNumber, // ensure stored as a number
      };
      console.log(`Participant ${userUid} details updated.`);
    }
  } else if (actionType === "leave") {
    // Remove the participant if they are leaving
    participantList = participantList.filter((p) => p.uid !== userUidNumber);
    console.log(`Participant ${userUid} has left.`);
  } else {
    console.warn(`Unknown action type: ${actionType}`);
    return;
  }

  // Log the participant list after update
  console.log(
    "Participant list after update:",
    JSON.stringify(participantList, null, 2)
  );

  const participantTextList = participantList.map((p) => {
    return `UID: ${p.uid}, Name: ${p.name}, Role: ${p.role}, Company: ${p.company}, Designation: ${p.designation}, IsRaisingHand: ${p.isRaisingHand}, RoleInTheCall: ${p.roleInTheCall}`;
  });

  // Send the updated participantTextList to Bubble in a single call
  if (typeof bubble_fn_eventUser === "function") {
    console.log(
      "Sending participant list (as text) to Bubble:",
      participantTextList
    );
    bubble_fn_eventUser(participantTextList);
  }

  console.log("Participant list updated.");
};



export const sendDeviceDataToBubble = (deviceType, devices) => {
  const formattedData = {
    outputlist1: devices.map((d) => d.deviceId),
    outputlist2: devices.map((d) => d.label || "No label"),
    outputlist3: devices.map((d) => d.kind || "Unknown"),
    outputlist4: devices.map((d) => JSON.stringify(d)), // Converts each device to a JSON string in an array
  };

  // Determine the appropriate Bubble function to call based on device type
  if (
    deviceType === "microphone" &&
    typeof bubble_fn_micDevices === "function"
  ) {
    bubble_fn_micDevices(formattedData);
  } else if (
    deviceType === "camera" &&
    typeof bubble_fn_camDevices === "function"
  ) {
    bubble_fn_camDevices(formattedData);
  } else if (
    deviceType === "speaker" &&
    typeof bubble_fn_speakerDevices === "function"
  ) {
    bubble_fn_speakerDevices(formattedData);
  }
};


export const fetchAndSendDeviceList = async () => {
  try {
    console.log("Fetching available media devices...");
    const devices = await AgoraRTC.getDevices();
    console.log("Devices enumerated by Agora:", devices);

    const microphones = devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    const cameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    const speakers = devices
      .filter((device) => device.kind === "audiooutput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "No label",
        kind: device.kind,
      }));

    // Send all device lists to Bubble
    console.log("Sending device lists to Bubble.");
    sendDeviceDataToBubble("microphone", microphones);
    sendDeviceDataToBubble("camera", cameras);
    sendDeviceDataToBubble("speaker", speakers);

    return { microphones, cameras, speakers };
  } catch (error) {
    console.error("Error fetching available devices:", error);
    return { microphones: [], cameras: [], speakers: [] };
  }
};
