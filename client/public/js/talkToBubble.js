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
    let participantIndex = participantList.findIndex(
      (p) => p.uid === userUidNumber
    );

    if (participantIndex === -1) {
      // Add new participant if they don't exist in the list
      const newParticipant = {
        uid: userUidNumber, // Store uid as a number
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

  // Separate participants by role
  const speakers = participantList.filter((p) => p.roleInTheCall === "speaker");
  const audiences = participantList.filter(
    (p) => p.roleInTheCall === "audience"
  );
  const hosts = participantList.filter((p) => p.roleInTheCall === "host");
  const waiting = participantList.filter((p) => p.roleInTheCall === "waiting");
  const audienceOnStage = participantList.filter(
    (p) => p.roleInTheCall === "audienceOnStage"
  );
  const meetingParticipants = participantList.filter(
    (p) => p.roleInTheCall === "meetingParticipant"
  );
  const masters = participantList.filter((p) => p.roleInTheCall === "master");

  // Helper to format data for Bubble, including rtmUid
  const formatForBubble = (participants) => ({
    outputlist1: participants.map((p) => p.name),
    outputlist2: participants.map((p) => p.company),
    outputlist3: participants.map((p) => p.designation),
    outputlist4: participants.map((p) => p.avatar),
    outputlist5: participants.map((p) => p.bubbleid),
    outputlist6: participants.map((p) => p.isRaisingHand),
    outputlist7: participants.map((p) => p.rtmUid),
    outputlist8: participants.map((p) => p.speakerId),
    outputlist9: participants.map((p) => p.participantId),
  });

  // Send data to Bubble functions
  if (typeof bubble_fn_speaker === "function") {
    console.log("Sending speaker data to Bubble:", formatForBubble(speakers));
    bubble_fn_speaker(formatForBubble(speakers));
  }

  if (typeof bubble_fn_audience === "function") {
    console.log("Sending audience data to Bubble:", formatForBubble(audiences));
    bubble_fn_audience(formatForBubble(audiences));
  }

  if (typeof bubble_fn_host === "function") {
    console.log("Sending host data to Bubble:", formatForBubble(hosts));
    bubble_fn_host(formatForBubble(hosts));
  }

  if (typeof bubble_fn_waiting === "function") {
    console.log("Sending waiting data to Bubble:", formatForBubble(waiting));
    bubble_fn_waiting(formatForBubble(waiting));
  }

  if (typeof bubble_fn_audienceOnStage === "function") {
    console.log(
      "Sending audienceOnStage data to Bubble:",
      formatForBubble(audienceOnStage)
    );
    bubble_fn_audienceOnStage(formatForBubble(audienceOnStage));
  }

  if (typeof bubble_fn_meetingParticipant === "function") {
    console.log(
      "Sending meetingParticipant data to Bubble:",
      formatForBubble(meetingParticipants)
    );
    bubble_fn_meetingParticipant(formatForBubble(meetingParticipants));
  }

  if (typeof bubble_fn_master === "function") {
    console.log("Sending master data to Bubble:", formatForBubble(masters));
    bubble_fn_master(formatForBubble(masters));
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
