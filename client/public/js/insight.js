export const insights = async function () {
  

  async function waitForBubbleFunction(fnName, maxAttempts = 5, delay = 500) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      if (typeof window[fnName] === "function") {
        console.log(`✅ Bubble function '${fnName}' is now available.`);
        return true;
      }
      console.warn(`⏳ Waiting for '${fnName}' (attempt ${attempts + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempts++;
    }
    console.error(
      `❌ Failed to detect '${fnName}' after ${maxAttempts} attempts.`
    );
    return false;
  }

  async function processAll(
    appointments = [],
    messages = [],
    mainUserId,
    startDate,
    endDate
  ) {
    console.log("📊 Starting to process appointments and messages...");

    // Log all inputs for debugging
    console.log("🔍 Input Data:");
    console.log("➡️ Appointments:", JSON.stringify(appointments, null, 2));
    console.log("➡️ Messages:", JSON.stringify(messages, null, 2));
    console.log("➡️ Main User ID:", mainUserId);
    console.log("➡️ Start Date:", startDate);
    console.log("➡️ End Date:", endDate);

    if (!(await waitForBubbleFunction("bubble_fn_loadinggg"))) return;
    bubble_fn_loadinggg(true);

    await processAppointments(appointments, mainUserId, startDate, endDate);
    await processMessages(messages, mainUserId, startDate, endDate);

    if (typeof bubble_fn_loadinggg === "function") {
      bubble_fn_loadinggg(false);
    }
  }


  async function processAppointments(
    appointments = [],
    mainUserId,
    startDate,
    endDate
  ) 
  
  {const colorList = [
    "#B0E0E6",
    "#87CEEB",
    "#F0F8FF",
    "#89CFF0",
    "#E0FFFF",
    "#CCCCFF",
    "#ADD8E6",
    "#AFEEEE",
    "#99FFFF",
    "#F0FFFF",
    "#6495ED",
    "#1E90FF",
    "#4682B4",
    "#56A3F5",
    "#7DF9FF",
    "#0073CF",
    "#0095B6",
    "#007BA7",
    "#5F9EA0",
    "#6CA6CD",
    "#2E8B57",
    "#00BFFF",
    "#4682B4",
    "#0088CC",
    "#1CA9C9",
    "#4682B4",
    "#5B92E5",
    "#38B0DE",
    "#4B89DC",
    "#009ACD",
    "#318CE7",
    "#40E0D0",
    "#3C9EEB",
    "#3399FF",
    "#33A1C9",
    "#6495ED",
    "#6CB4EE",
    "#4DAFCE",
    "#417DC1",
    "#4682B4",
    "#7EC8E3",
    "#0080FF",
    "#5D9CEC",
    "#3C91E6",
    "#1DA1F2",
    "#039BE5",
    "#40C4FF",
    "#0288D1",
    "#0277BD",
    "#01579B",
  ];
    console.log("📅 Processing Appointments...");

    if (!appointments.length) {
      console.warn("⚠️ No appointments found.");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const uniqueIds = {};
    let chartColorsList = [];
    let combinedNames = {};

    appointments.forEach((appointment) => {
      if (!appointment?.date || !appointment?.meetingParticipantsids) return;

      const appointmentDate = new Date(appointment.date);
      if (appointmentDate >= start && appointmentDate <= end) {
        appointment.meetingParticipantsids.forEach((participantId, index) => {
          if (participantId !== mainUserId) {
            uniqueIds[participantId] = (uniqueIds[participantId] || 0) + 1;
            if (!combinedNames[participantId]) {
              combinedNames[participantId] =
                appointment.startupName?.[index]?.trim() ||
                appointment.name?.[index]?.trim() ||
                "Unknown";
            }
          }
        });
      }
    });

    const uniqueIdsList = Object.keys(uniqueIds);
    const meetingCountsList = Object.values(uniqueIds);
    const combinedNamesList = uniqueIdsList.map((id) => combinedNames[id]);

    chartColorsList = uniqueIdsList.map(
      (_, index) => colorList[index % colorList.length]
    );

    console.log("✅ Appointments processed:", {
      uniqueIdsList,
      meetingCountsList,
      combinedNamesList,
    });

    if (!(await waitForBubbleFunction("bubble_fn_appointments"))) return;
    bubble_fn_appointments({
      outputlist1: uniqueIdsList,
      outputlist2: meetingCountsList,
      outputlist3: chartColorsList,
      outputlist4: combinedNamesList,
    });
  }

  async function processMessages(
    messages = [],
    mainUserId,
    startDate,
    endDate
  ) {

    const colorList = [
      "#B0E0E6",
      "#87CEEB",
      "#F0F8FF",
      "#89CFF0",
      "#E0FFFF",
      "#CCCCFF",
      "#ADD8E6",
      "#AFEEEE",
      "#99FFFF",
      "#F0FFFF",
      "#6495ED",
      "#1E90FF",
      "#4682B4",
      "#56A3F5",
      "#7DF9FF",
      "#0073CF",
      "#0095B6",
      "#007BA7",
      "#5F9EA0",
      "#6CA6CD",
      "#2E8B57",
      "#00BFFF",
      "#4682B4",
      "#0088CC",
      "#1CA9C9",
      "#4682B4",
      "#5B92E5",
      "#38B0DE",
      "#4B89DC",
      "#009ACD",
      "#318CE7",
      "#40E0D0",
      "#3C9EEB",
      "#3399FF",
      "#33A1C9",
      "#6495ED",
      "#6CB4EE",
      "#4DAFCE",
      "#417DC1",
      "#4682B4",
      "#7EC8E3",
      "#0080FF",
      "#5D9CEC",
      "#3C91E6",
      "#1DA1F2",
      "#039BE5",
      "#40C4FF",
      "#0288D1",
      "#0277BD",
      "#01579B",
    ];
    console.log("📬 Processing Messages...");

    if (!messages.length) {
      console.warn("⚠️ No messages found.");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const uniqueIds = {};
    let combinedNames = {};
    let chartColorsList = [];

    messages.forEach((message) => {
      if (!message?.date || !message?.participantIds) return;

      const messageDate = new Date(message.date);
      if (messageDate >= start && messageDate <= end) {
        message.participantIds.forEach((participantId, index) => {
          if (participantId !== mainUserId) {
            uniqueIds[participantId] = (uniqueIds[participantId] || 0) + 1;
            if (!combinedNames[participantId]) {
              combinedNames[participantId] =
                message.startupNames?.[index]?.trim() ||
                message.names?.[index]?.trim() ||
                "Unknown";
            }
          }
        });
      }
    });

    const uniqueIdsList = Object.keys(uniqueIds);
    const messageCountsList = Object.values(uniqueIds);
    const combinedNamesList = uniqueIdsList.map((id) => combinedNames[id]);

    chartColorsList = uniqueIdsList.map(
      (_, index) => colorList[index % colorList.length]
    );

    console.log("✅ Messages processed:", {
      uniqueIdsList,
      messageCountsList,
      combinedNamesList,
    });

    if (!(await waitForBubbleFunction("bubble_fn_messages"))) return;
    bubble_fn_messages({
      outputlist1: uniqueIdsList,
      outputlist2: messageCountsList,
      outputlist3: chartColorsList,
      outputlist4: combinedNamesList,
    });
  }

  return {
    processAll,
  };
};

// Expose the function globally
window["insights"] = insights;
