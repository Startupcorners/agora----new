
export const checkOverlaps = async function () {
  function checkCommonAvailableSlots(
    allAvailabilities, // Single list of availabilities with userId
    alreadyBookedList, // List of booked slots, e.g. [["2025-05-01T10:00:00Z", "2025-05-01T11:00:00Z"], ...]
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

    // Step 1: Group all availabilities by userId
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

    // Step 2: Generate available time slots for each user (raw slots, not yet excluding booked)
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

          // Convert start and end dates to a day-based range in local time
          const startDate = moment.max(
            moment
              .utc(start_date)
              .utcOffset(timeOffsetSeconds / 60)
              .startOf("day"),
            periodStart
          );
          const endDate = moment.min(
            moment
              .utc(end_date)
              .utcOffset(timeOffsetSeconds / 60)
              .endOf("day"),
            periodEnd
          );

          let currentDate = startDate.clone();

          while (currentDate.isBefore(endDate)) {
            // Convert to local timezone based on offset
            const localDate = currentDate
              .clone()
              .utcOffset(timeOffsetSeconds / 60);
            const dayOfWeekLocal = localDate.day(); // Local day of the week

            // If today's local day is NOT excluded:
            if (!excludedDays.includes(dayOfWeekLocal)) {
              // Parse daily schedule
              const [startHour, startMinute] = daily_start_time
                .split(":")
                .map((val) => parseInt(val, 10));
              const [endHour, endMinute] = daily_end_time
                .split(":")
                .map((val) => parseInt(val, 10));

              const localStart = localDate.clone().set({
                hour: startHour,
                minute: startMinute,
                second: 0,
              });

              const localEnd = localDate.clone().set({
                hour: endHour,
                minute: endMinute,
                second: 0,
              });

              // Handle local availability that might span past midnight
              if (localEnd.isBefore(localStart)) {
                localEnd.add(1, "day");
              }

              // Convert back to UTC for consistency
              const utcStart = localStart.utc();
              const utcEnd = localEnd.utc();

              let slotStart = utcStart.clone();

              while (slotStart.isBefore(utcEnd)) {
                const slotEnd = slotStart
                  .clone()
                  .add(slot_duration_minutes, "minutes");

                // If the slot ends before the earliestBookableMoment, skip it
                if (slotEnd.isBefore(earliestBookableMoment)) {
                  slotStart.add(slot_duration_minutes, "minutes");
                  continue;
                }

                userSlots.push([
                  slotStart.clone().format(), // store as ISO string
                  slotEnd.clone().format(),
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

    // Step 2.1: EXCLUDE ALREADY BOOKED SLOTS
    // For each user's slot list, remove those that overlap with any booked slot
    const cleanedUserSlots = usersProcessedSlots.map((userSlots) => {
      return userSlots.filter(([slotStartStr, slotEndStr]) => {
        const slotStart = moment.utc(slotStartStr);
        const slotEnd = moment.utc(slotEndStr);

        // Check if this slot overlaps with any in the alreadyBookedList
        const isOverlapped = alreadyBookedList.some(
          ([bookedStartStr, bookedEndStr]) => {
            const bookedStart = moment.utc(bookedStartStr);
            const bookedEnd = moment.utc(bookedEndStr);
            return isSlotOverlapping(
              slotStart,
              slotEnd,
              bookedStart,
              bookedEnd
            );
          }
        );

        // Keep only if it does NOT overlap
        return !isOverlapped;
      });
    });

    console.log(
      "Slots after excluding booked times (one array per user):",
      JSON.stringify(cleanedUserSlots, null, 2)
    );

    // Step 3: Find the intersection of slots across all users
    let commonSlots = cleanedUserSlots[0] || [];

    for (let i = 1; i < cleanedUserSlots.length; i++) {
      // Filter the current commonSlots by checking containment in the next user's slots
      commonSlots = commonSlots.filter(([startA, endA]) => {
        const startAMoment = moment.utc(startA);
        const endAMoment = moment.utc(endA);

        // We say the slot from user A is valid only if we find it contained in user B's time ranges
        return cleanedUserSlots[i].some(([startB, endB]) => {
          const startBMoment = moment.utc(startB);
          const endBMoment = moment.utc(endB);
          // Check if user B's slot fully contains user A's slot
          return (
            startAMoment.isSameOrAfter(startBMoment) &&
            endAMoment.isSameOrBefore(endBMoment)
          );
        });
      });

      if (commonSlots.length === 0) {
        console.log("No common slots found.");
        bubble_fn_overlaps("no");
        return "no";
      }
    }

    console.log(
      "Final common slots found:",
      JSON.stringify(commonSlots, null, 2)
    );
    bubble_fn_overlaps("yes");

    // Return "yes" if at least one common slot remains
    return commonSlots.length > 0 ? "yes" : "no";
  }

  return {
    checkCommonAvailableSlots,
  };
};

// Helper function to check if two slots overlap at all
function isSlotOverlapping(startA, endA, startB, endB) {
  // Overlap if times cross at all
  return startA.isBefore(endB) && endA.isAfter(startB);
}

// Attach to window for Bubble
window["checkOverlaps"] = checkOverlaps;
