function processAppointments(appointments, mainUserId, startDate, endDate) {
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

  return {
    uniqueIdsList,
    meetingCounts,
  };
}

// Example usage:
const appointments = [
  {
    meetingParticipantsids: ["user1", "user2", "user3"],
    date: "2025-01-01",
  },
  {
    meetingParticipantsids: ["user2", "user4"],
    date: "2025-01-03",
  },
  {
    meetingParticipantsids: ["user1", "user5"],
    date: "2025-01-05",
  },
];

const mainUserId = "user1";
const startDate = "2025-01-01";
const endDate = "2025-01-04";

const result = processAppointments(
  appointments,
  mainUserId,
  startDate,
  endDate
);
console.log("Unique IDs:", result.uniqueIdsList);
console.log("Meeting Counts:", result.meetingCounts);
