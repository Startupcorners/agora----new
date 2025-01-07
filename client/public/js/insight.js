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

  function processAppointments(appointments, mainUserId, startDate, endDate) {
    // Log the inputs received
    console.log("processAppointments called with:");
    console.log("appointments:", appointments);
    console.log("mainUserId:", mainUserId);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);

    // Predefined list of colors
    

    // Convert startDate and endDate to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set to collect unique IDs (excluding mainUserId)
    const uniqueIds = new Set();

    // Object to count meetings per ID
    const meetingCounts = {};

    // Iterate through appointments
    appointments.forEach((appointment) => {
      const appointmentDate = new Date(appointment.date);

      // Check if the appointment falls within the period
      if (appointmentDate >= start && appointmentDate <= end) {
        appointment.meetingParticipantsids.forEach((participantId, index) => {
          if (participantId !== mainUserId) {
            // Add the participant ID to unique IDs set
            uniqueIds.add(participantId);

            // Increment the meeting count for the participant
            if (!meetingCounts[participantId]) {
              meetingCounts[participantId] = 0;
            }
            meetingCounts[participantId]++;
          } else {
            // Remove mainUserId and corresponding name/startupName
            appointment.meetingParticipantsids.splice(index, 1);
            appointment.name.splice(index, 1);
            appointment.startupName.splice(index, 1);
          }
        });
      }
    });

    // Convert the uniqueIds Set to an array
    const uniqueIdsList = Array.from(uniqueIds);

    // Generate the meeting counts as an array (in the same order as uniqueIdsList)
    const meetingCountsList = uniqueIdsList.map((id) => meetingCounts[id] || 0);

    // Generate chart colors as an array (in the same order as uniqueIdsList)
    const chartColorsList = uniqueIdsList.map(
      (id, index) => colorList[index % colorList.length] // Cycle through colors
    );

    // Generate outputlist4 by combining name and startupName
    const combinedNamesList = appointments.flatMap((appointment) =>
      appointment.name.map((name, index) =>
        appointment.startupName[index] ? appointment.startupName[index] : name
      )
    );

      bubble_fn_appointments({
        outputlist1: uniqueIdsList, // Array of unique IDs
        outputlist2: meetingCountsList, // Array of counts (matching uniqueIdsList)
        outputlist3: chartColorsList, // Array of colors (matching uniqueIdsList)
        outputlist4: combinedNamesList, // Combined list of names and startupNames
      });
  }

  function processMessages(messages, mainUserId, startDate, endDate) {
    // Log the inputs received
    console.log("processMessages called with:");
    console.log("messages:", messages);
    console.log("mainUserId:", mainUserId);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);

    // Convert startDate and endDate to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set to collect unique IDs (excluding mainUserId)
    const uniqueIds = new Set();

    // Object to count messages per ID
    const messageCounts = {};

    // Iterate through messages
    messages.forEach((message) => {
      const messageDate = new Date(message.date);

      // Check if the message falls within the period
      if (messageDate >= start && messageDate <= end) {
        message.participantIds.forEach((participantId, index) => {
          if (participantId !== mainUserId) {
            // Add the participant ID to unique IDs set
            uniqueIds.add(participantId);

            // Increment the message count for the participant
            if (!messageCounts[participantId]) {
              messageCounts[participantId] = 0;
            }
            messageCounts[participantId]++;
          } else {
            // Remove mainUserId and corresponding name/startupName
            message.participantIds.splice(index, 1);
            message.names.splice(index, 1);
            message.startupNames.splice(index, 1);
          }
        });
      }
    });

    // Convert the uniqueIds Set to an array
    const uniqueIdsList = Array.from(uniqueIds);

    // Generate the message counts as an array (in the same order as uniqueIdsList)
    const messageCountsList = uniqueIdsList.map((id) => messageCounts[id] || 0);

    // Generate chart colors as an array (in the same order as uniqueIdsList)
    const chartColorsList = uniqueIdsList.map(
      (id, index) => colorList[index % colorList.length] // Cycle through colors
    );

    // Generate outputlist4 by combining names and startupNames
    const combinedNamesList = messages.flatMap((message) =>
      message.names.map((name, index) =>
        message.startupNames[index] ? message.startupNames[index] : name
      )
    );

    console.log(uniqueIdsList);
    console.log(messageCountsList);
    console.log(chartColorsList);
    console.log(combinedNamesList);

      bubble_fn_messages({
        outputlist1: uniqueIdsList, // Array of unique IDs
        outputlist2: messageCountsList, // Array of counts (matching uniqueIdsList)
        outputlist3: chartColorsList, // Array of colors (matching uniqueIdsList)
        outputlist4: combinedNamesList, // Combined list of names and startupNames
      });

  }


  return {
    processAppointments,
    processMessages,
  };
};

// Expose the function globally
window["insights"] = insights;
