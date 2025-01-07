export const insights = async function () {
  function processAppointments(appointments, mainUserId, startDate, endDate) {
    // Log the inputs received
    console.log("processAppointments called with:");
    console.log("appointments:", appointments);
    console.log("mainUserId:", mainUserId);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);

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
        appointment.meetingParticipantsids.forEach((participantId) => {
          if (participantId !== mainUserId) {
            // Add to unique IDs set
            uniqueIds.add(participantId);

            // Increment the meeting count for the participant
            if (!meetingCounts[participantId]) {
              meetingCounts[participantId] = 0;
            }
            meetingCounts[participantId]++;
          }
        });
      }
    });

    // Convert the uniqueIds Set to an array
    const uniqueIdsList = Array.from(uniqueIds);

    // Call Bubble function with results in an object format
    if (typeof bubble_fn_appointments === "function") {
      bubble_fn_appointments({
        outputlist1: uniqueIdsList,
        outputlist2: meetingCounts,
      });
    } else {
      console.error("Bubble function bubble_fn_appointments is not defined.");
    }
  }

  return {
    processAppointments,
  };
};

// Expose the function globally
window["insights"] = insights;
