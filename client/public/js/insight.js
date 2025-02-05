export const insights = async function () {
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

  function retry(fn, retries = 3, delay = 500) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function attempt() {
        try {
          let result = fn();
          if (result !== undefined) {
            resolve(result);
          } else {
            throw new Error("Function returned undefined.");
          }
        } catch (error) {
          attempts++;
          if (attempts < retries) {
            console.warn(`Retrying... Attempt ${attempts}`);
            setTimeout(attempt, delay);
          } else {
            console.error("Function failed after retries:", error);
            reject(error);
          }
        }
      }
      attempt();
    });
  }

  function processAll(appointments, messages, mainUserId, startDate, endDate) {
    console.log("Starting to process appointments and messages...");

    retry(() => {
      if (typeof bubble_fn_loadinggg !== "function") {
        throw new Error("bubble_fn_loadinggg is not defined yet.");
      }
      bubble_fn_loadinggg(true);
    }).catch(() => console.error("Failed to initialize loading function."));

    if (!Array.isArray(appointments) || !Array.isArray(messages)) {
      console.error("Invalid data: Appointments or Messages are not arrays.");
      return;
    }

    processAppointments(appointments, mainUserId, startDate, endDate);
    processMessages(messages, mainUserId, startDate, endDate);

    retry(() => {
      if (typeof bubble_fn_loadinggg !== "function") {
        throw new Error("bubble_fn_loadinggg is not defined.");
      }
      bubble_fn_loadinggg(false);
    }).catch(() => console.error("Failed to stop loading function."));
  }

  function processAppointments(appointments, mainUserId, startDate, endDate) {
    console.log("Processing Appointments...");

    const start = new Date(startDate);
    const end = new Date(endDate);
    const uniqueIds = {};
    let chartColorsList = [];
    let combinedNames = {};

    appointments.forEach((appointment) => {
      if (
        !appointment ||
        !appointment.date ||
        !appointment.meetingParticipantsids
      )
        return;

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

    // Ensure chartColorsList is initialized
    chartColorsList = uniqueIdsList.map(
      (_, index) => colorList[index % colorList.length]
    );

    console.log("Appointments processed:", {
      uniqueIdsList,
      meetingCountsList,
      combinedNamesList,
    });

    retry(() => {
      if (typeof bubble_fn_appointments !== "function") {
        throw new Error("bubble_fn_appointments is not defined.");
      }
      bubble_fn_appointments({
        outputlist1: uniqueIdsList,
        outputlist2: meetingCountsList,
        outputlist3: chartColorsList,
        outputlist4: combinedNamesList,
      });
    }).catch(() => console.error("Failed to execute bubble_fn_appointments."));
  }

  function processMessages(messages, mainUserId, startDate, endDate) {
    console.log("Processing Messages...");

    const start = new Date(startDate);
    const end = new Date(endDate);
    const uniqueIds = {};
    let combinedNames = {};
    let chartColorsList = [];

    messages.forEach((message) => {
      if (!message || !message.date || !message.participantIds) return;

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

    // Ensure chartColorsList is initialized
    chartColorsList = uniqueIdsList.map(
      (_, index) => colorList[index % colorList.length]
    );

    console.log("Messages processed:", {
      uniqueIdsList,
      messageCountsList,
      combinedNamesList,
    });

    retry(() => {
      if (typeof bubble_fn_messages !== "function") {
        throw new Error("bubble_fn_messages is not defined.");
      }
      bubble_fn_messages({
        outputlist1: uniqueIdsList,
        outputlist2: messageCountsList,
        outputlist3: chartColorsList,
        outputlist4: combinedNamesList,
      });
    }).catch(() => console.error("Failed to execute bubble_fn_messages."));
  }

  return {
    processAll,
  };
};

// Expose the function globally
window["insights"] = insights;
