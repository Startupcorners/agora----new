export const checkOverlaps = async function () {
  function checkCommonAvailableSlots(
    allAvailabilities, // Single list of availabilities with userId
    alreadyBookedList, // List of booked slots
    earliestBookableDay // Minimum bookable day in days
  ) {
    const earliestBookableMoment = moment
      .utc()
      .add(earliestBookableDay, "days");

    // Step 1: Group availabilities by userId
    const groupedAvailabilities = allAvailabilities.reduce(
      (acc, availability) => {
        if (!acc[availability.userId]) {
          acc[availability.userId] = [];
        }
        acc[availability.userId].push(availability);
        return acc;
      },
      {}
    );

    // Step 2: Generate available time slots for each user
    const usersProcessedSlots = Object.values(groupedAvailabilities).map(
      (availabilityList) => {
        let userSlots = [];

        availabilityList.forEach((availability) => {
          const {
            start_date,
            end_date,
            daily_start_time,
            daily_end_time,
            slot_duration_minutes,
            excludedDays,
            timeOffsetSeconds,
          } = availability;

          // Convert start and end dates to moment UTC
          const startDate = moment.utc(start_date);
          const endDate = moment.utc(end_date);

          let currentDate = startDate.clone();

          while (currentDate.isBefore(endDate)) {
            const dayOfWeek = currentDate
              .clone()
              .utcOffset(timeOffsetSeconds / 60)
              .day();

            if (!excludedDays.includes(dayOfWeek)) {
              // Generate slots within daily start and end time
              const localStart = currentDate
                .clone()
                .utcOffset(timeOffsetSeconds / 60)
                .set({
                  hour: parseInt(daily_start_time.split(":")[0]),
                  minute: parseInt(daily_start_time.split(":")[1]),
                  second: 0,
                });

              const localEnd = currentDate
                .clone()
                .utcOffset(timeOffsetSeconds / 60)
                .set({
                  hour: parseInt(daily_end_time.split(":")[0]),
                  minute: parseInt(daily_end_time.split(":")[1]),
                  second: 0,
                });

              let slotStart = localStart.clone();

              while (slotStart.isBefore(localEnd)) {
                const slotEnd = slotStart
                  .clone()
                  .add(slot_duration_minutes, "minutes");

                // Convert slots to UTC for comparison
                if (slotEnd.isBefore(earliestBookableMoment)) {
                  slotStart.add(slot_duration_minutes, "minutes");
                  continue;
                }

                userSlots.push([
                  slotStart.clone().utc().format(),
                  slotEnd.clone().utc().format(),
                ]);

                slotStart.add(slot_duration_minutes, "minutes");
              }
            }

            currentDate.add(1, "day");
          }
        });

        return userSlots;
      }
    );

    // Step 3: Remove booked slots
    const filteredUserSlots = usersProcessedSlots.map((userSlots) => {
      return userSlots.filter(([slotStart, slotEnd]) => {
        return !alreadyBookedList.some((booked) => {
          const bookedStart = moment.utc(booked.start_date);
          const bookedEnd = moment.utc(booked.end_date);
          return isSlotOverlapping(
            moment.utc(slotStart),
            moment.utc(slotEnd),
            bookedStart,
            bookedEnd
          );
        });
      });
    });

    // Step 4: Find common slots across all users
    let commonSlots = filteredUserSlots[0];

    for (let i = 1; i < filteredUserSlots.length; i++) {
      commonSlots = commonSlots.filter(([startA, endA]) => {
        return filteredUserSlots[i].some(([startB, endB]) => {
          return isSlotOverlapping(
            moment.utc(startA),
            moment.utc(endA),
            moment.utc(startB),
            moment.utc(endB)
          );
        });
      });

      if (commonSlots.length === 0) {
        bubble_fn_overlaps("no"); // Notify Bubble with "no"
        return "no"; // No common available slots
      }
    }

    bubble_fn_overlaps("yes"); // Notify Bubble with "yes"
    return commonSlots.length > 0 ? "yes" : "no";
  }

  // Expose function to Bubble
  return {
    checkCommonAvailableSlots,
  };
};

// Helper function to check slot overlap
function isSlotOverlapping(startA, endA, startB, endB) {
  return startA.isBefore(endB) && endA.isAfter(startB);
}

// Attach the function to the window object for Bubble to call
window["checkOverlaps"] = checkOverlaps;
