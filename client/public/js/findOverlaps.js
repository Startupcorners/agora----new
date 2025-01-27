// Make sure you import moment if needed
// import moment from "moment";
// or
// const moment = require("moment");

export const checkOverlaps = async function () {
  function checkCommonAvailableSlots(
    allAvailabilities, // Single list of availabilities with userId
    alreadyBookedList, // List of booked slots
    earliestBookableDay // Minimum bookable day in days
  ) {
    console.log("Received availabilities:", JSON.stringify(allAvailabilities));
    console.log("Received booked slots:", JSON.stringify(alreadyBookedList));
    console.log("Earliest bookable day:", earliestBookableDay);

    const earliestBookableMoment = moment
      .utc()
      .add(earliestBookableDay, "days");
    console.log("Earliest bookable moment:", earliestBookableMoment.format());

    // Calculate the next 7-day period
    const periodStart = moment
      .utc()
      .add(earliestBookableDay, "days")
      .startOf("day");
    const periodEnd = periodStart.clone().add(7, "days").endOf("day");

    console.log(
      `Checking availability between: ${periodStart.format()} - ${periodEnd.format()}`
    );

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
    console.log(
      "Grouped availabilities:",
      JSON.stringify(groupedAvailabilities)
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
            userId,
          } = availability;

          console.log(`Processing availability for user: ${userId}`);
          console.log(
            `Daily schedule: ${daily_start_time} - ${daily_end_time}`
          );
          console.log(`Excluded days (based on local time): ${excludedDays}`);

          const startDate = moment.max(moment.utc(start_date), periodStart);
          const endDate = moment.min(moment.utc(end_date), periodEnd);

          let currentDate = startDate.clone();

          while (currentDate.isBefore(endDate)) {
            // Convert to local timezone based on offset
            const localDate = currentDate
              .clone()
              .utcOffset(timeOffsetSeconds / 60);
            const dayOfWeekLocal = localDate.day(); // Local day of the week

            // If today's local day is NOT excluded:
            if (!excludedDays.includes(dayOfWeekLocal)) {
              const localStart = localDate
                .clone()
                .set({
                  hour: parseInt(daily_start_time.split(":")[0], 10),
                  minute: parseInt(daily_start_time.split(":")[1], 10),
                  second: 0,
                })
                .utc(); // Convert back to UTC

              const localEnd = localDate
                .clone()
                .set({
                  hour: parseInt(daily_end_time.split(":")[0], 10),
                  minute: parseInt(daily_end_time.split(":")[1], 10),
                  second: 0,
                })
                .utc(); // Convert back to UTC

              let slotStart = localStart.clone();

              while (slotStart.isBefore(localEnd)) {
                const slotEnd = slotStart
                  .clone()
                  .add(slot_duration_minutes, "minutes");

                // Skip if the entire slot ends before the earliest bookable moment
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

        console.log(
          `Generated slots for user: ${JSON.stringify(userSlots, null, 2)}`
        );
        return userSlots;
      }
    );

    console.log(
      "All processed slots (array of arrays, one per user):",
      JSON.stringify(usersProcessedSlots, null, 2)
    );

    // Step 3: Remove booked slots (FIXED LOGIC)
    const filteredUserSlots = usersProcessedSlots.map((userSlots) => {
      return userSlots.filter(([slotStart, slotEnd]) => {
        // 'hasOverlap' will be true if this slot overlaps ANY booking
        const hasOverlap = alreadyBookedList.some((booked) => {
          const bookedStart = moment.utc(booked.start_date);
          const bookedEnd = moment.utc(booked.end_date);
          return isSlotOverlapping(
            moment.utc(slotStart),
            moment.utc(slotEnd),
            bookedStart,
            bookedEnd
          );
        });

        if (hasOverlap) {
          console.log(
            `Slot ${slotStart} - ${slotEnd} removed due to booking conflict.`
          );
          return false; // exclude this slot
        }
        return true; // keep this slot
      });
    });

    console.log(
      "Filtered slots after booked removal:",
      JSON.stringify(filteredUserSlots, null, 2)
    );

    // Step 4: Find common slots across all users
    // Start with the first user's filtered slots as the "base"
    let commonSlots = filteredUserSlots[0];

    // Intersect with each subsequent user's slots
    for (let i = 1; i < filteredUserSlots.length; i++) {
      commonSlots = commonSlots.filter(([startA, endA]) => {
        return filteredUserSlots[i].some(([startB, endB]) => {
          return (
            moment.utc(startA).isSameOrAfter(moment.utc(startB)) &&
            moment.utc(endA).isSameOrBefore(moment.utc(endB))
          );
        });
      });

      console.log(
        `Common slots after checking with user ${i + 1}:`,
        JSON.stringify(commonSlots, null, 2)
      );

      if (commonSlots.length === 0) {
        console.log("No common slots found.");
        // bubble_fn_overlaps("no"); // <-- your Bubble function
        return "no"; // or whatever you do to handle no slots
      }
    }

    console.log(
      "Final common slots found:",
      JSON.stringify(commonSlots, null, 2)
    );

    // If there are common slots, return "yes", otherwise "no"
    if (commonSlots.length > 0) {
      bubble_fn_overlaps("yes");
      return "yes";
    } else {
      bubble_fn_overlaps("no");
      return "no";
    }
  }

  // Expose function for Bubble
  return {
    checkCommonAvailableSlots,
  };
};

// Helper function to check overlap
function isSlotOverlapping(startA, endA, startB, endB) {
  // Overlap if the start is before the other end, and the end is after the other start
  return startA.isBefore(endB) && endA.isAfter(startB);
}

// Attach to window
window["checkOverlaps"] = checkOverlaps;
