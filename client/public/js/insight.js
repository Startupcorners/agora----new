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

  function processAll(appointments, messages, mainUserId, startDate, endDate) {
    bubble_fn_loading(true);
    console.log("Starting to process appointments and messages...");

    // Run processAppointments
    processAppointments(appointments, mainUserId, startDate, endDate);

    // Run processMessages
    processMessages(messages, mainUserId, startDate, endDate);

    // Log after both have completed
    bubble_fn_loading(false)
  }


  function processAppointments(appointments, mainUserId, startDate, endDate) {
    console.log("processAppointments called with:");
    console.log("appointments:", appointments);
    console.log("mainUserId:", mainUserId);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);

    // Convert startDate and endDate to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Outputs
    const uniqueIds = {};
    const chartColorsList = [];
    const combinedNames = {};

    // Iterate through appointments
    appointments.forEach((appointment) => {
      const appointmentDate = new Date(appointment.date);

      // Check if the appointment falls within the period
      if (appointmentDate >= start && appointmentDate <= end) {
        appointment.meetingParticipantsids.forEach((participantId, index) => {
          if (participantId !== mainUserId) {
            // If the participantId is already in uniqueIds, increment its count
            if (uniqueIds[participantId]) {
              uniqueIds[participantId]++;
            } else {
              // Add participantId with initial count of 1
              uniqueIds[participantId] = 1;

              // Add name or startup name to combinedNames
              combinedNames[participantId] =
                appointment.startupName[index] &&
                appointment.startupName[index].trim()
                  ? appointment.startupName[index].trim()
                  : appointment.name[index].trim();
            }
          }
        });
      }
    });

    // Convert uniqueIds and combinedNames into ordered arrays
    const uniqueIdsList = Object.keys(uniqueIds);
    const meetingCountsList = Object.values(uniqueIds);
    const combinedNamesList = uniqueIdsList.map((id) => combinedNames[id]);

    // Generate colors for each unique ID
    uniqueIdsList.forEach((_, index) => {
      chartColorsList.push(colorList[index % colorList.length]);
    });

    // Log results for debugging
    console.log("Unique IDs:", uniqueIdsList);
    console.log("Meeting Counts:", meetingCountsList);
    console.log("Combined Names List:", combinedNamesList);

    // Call Bubble function with the results
    if (typeof bubble_fn_appointments === "function") {
      bubble_fn_appointments({
        outputlist1: uniqueIdsList, // Array of unique IDs
        outputlist2: meetingCountsList, // Array of counts (matching uniqueIdsList)
        outputlist3: chartColorsList, // Array of colors (matching uniqueIdsList)
        outputlist4: combinedNamesList, // Combined list of names and startupNames
      });
    } else {
      console.error("Bubble function bubble_fn_appointments is not defined.");
    }
  }



  function processMessages(messages, mainUserId, startDate, endDate) {
    console.log("processMessages called with:");
    console.log("messages:", messages);
    console.log("mainUserId:", mainUserId);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);

    // Convert startDate and endDate to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Grouped Outputs
    const uniqueIds = {};
    const combinedNames = {};
    const chartColorsList = [];

    // Iterate through messages
    messages.forEach((message) => {
      const messageDate = new Date(message.date);

      // Check if the message falls within the period
      if (messageDate >= start && messageDate <= end) {
        message.participantIds.forEach((participantId, index) => {
          if (participantId !== mainUserId) {
            // If the participantId is already in uniqueIds, increment its count
            if (uniqueIds[participantId]) {
              uniqueIds[participantId]++;
            } else {
              // Add participantId with initial count of 1
              uniqueIds[participantId] = 1;

              // Add name or startup name to combinedNames
              combinedNames[participantId] =
                message.startupNames[index] &&
                message.startupNames[index].trim()
                  ? message.startupNames[index].trim()
                  : message.names[index].trim();
            }
          }
        });
      }
    });

    // Convert grouped data to ordered arrays
    const uniqueIdsList = Object.keys(uniqueIds);
    const messageCountsList = Object.values(uniqueIds);
    const combinedNamesList = uniqueIdsList.map((id) => combinedNames[id]);

    // Generate colors for each unique ID
    uniqueIdsList.forEach((_, index) => {
      chartColorsList.push(colorList[index % colorList.length]);
    });

    // Log results for debugging
    console.log("Unique IDs:", uniqueIdsList);
    console.log("Message Counts:", messageCountsList);
    console.log("Combined Names List:", combinedNamesList);

    // Call Bubble function with the results
    if (typeof bubble_fn_messages === "function") {
      bubble_fn_messages({
        outputlist1: uniqueIdsList, // Array of unique IDs
        outputlist2: messageCountsList, // Array of counts (matching uniqueIdsList)
        outputlist3: chartColorsList, // Array of colors (matching uniqueIdsList)
        outputlist4: combinedNamesList, // Combined list of names and startupNames
      });
    } else {
      console.error("Bubble function bubble_fn_messages is not defined.");
    }
  }




  return {
    processAll,
  };
};

// Expose the function globally
window["insights"] = insights;
