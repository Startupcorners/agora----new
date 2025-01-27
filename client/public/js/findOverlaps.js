export const checkOverlaps = async function () {
  // Helper function to generate available date ranges within the next 7 days considering different time zones
  function generateDateRanges(
    startDate,
    endDate,
    excludedDays,
    timeOffsetSeconds,
    earliestBookableDay
  ) {
    console.log("Generating date ranges...");
    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);
    console.log("Excluded Days:", excludedDays);
    console.log("Time Offset (seconds):", timeOffsetSeconds);
    console.log("Earliest Bookable Day:", earliestBookableDay);

    const ranges = [];
    const start = moment
      .utc()
      .add(earliestBookableDay, "days")
      .startOf("day")
      .utcOffset(timeOffsetSeconds / 60);
    const end = moment
      .utc()
      .add(earliestBookableDay + 7, "days")
      .endOf("day")
      .utcOffset(timeOffsetSeconds / 60);
    let current = moment.max(
      start,
      moment
        .utc(startDate)
        .utcOffset(timeOffsetSeconds / 60)
        .startOf("day")
    );
    const maxEnd = moment.min(
      end,
      moment
        .utc(endDate)
        .utcOffset(timeOffsetSeconds / 60)
        .endOf("day")
    );

    console.log("Start Date (localized):", start.format());
    console.log("End Date (localized):", end.format());

    while (current.isSameOrBefore(maxEnd)) {
      if (!excludedDays.includes(current.day())) {
        ranges.push(current.clone().utc());
      }
      current.add(1, "day");
    }

    console.log(
      "Generated Date Ranges (UTC):",
      ranges.map((r) => r.format())
    );
    return ranges;
  }

  // Helper function to generate time slots for each available day considering different time zones
  function generateTimeSlots(
    date,
    dailyStartTime,
    dailyEndTime,
    slotDurationMinutes,
    timeOffsetSeconds
  ) {
    console.log("Generating time slots...");
    console.log("Date:", date.format());
    console.log("Daily Start Time:", dailyStartTime);
    console.log("Daily End Time:", dailyEndTime);
    console.log("Slot Duration (minutes):", slotDurationMinutes);
    console.log("Time Offset (seconds):", timeOffsetSeconds);

    const slots = [];
    const [startHour, startMinute] = dailyStartTime.split(":").map(Number);
    const [endHour, endMinute] = dailyEndTime.split(":").map(Number);

    const localStart = date
      .clone()
      .utcOffset(timeOffsetSeconds / 60)
      .set({ hour: startHour, minute: startMinute, second: 0 });
    let localEnd = date
      .clone()
      .utcOffset(timeOffsetSeconds / 60)
      .set({ hour: endHour, minute: endMinute, second: 0 });
    if (localEnd.isBefore(localStart)) {
      localEnd.add(1, "day");
    }

    let slotStart = localStart.clone().utc();
    while (slotStart.isBefore(localEnd.utc())) {
      const slotEnd = slotStart.clone().add(slotDurationMinutes, "minutes");
      slots.push([slotStart.clone().format(), slotEnd.clone().format()]);
      slotStart = slotEnd;
    }

    console.log("Generated Slots (UTC):", slots);
    return slots;
  }

  async function checkCommonAvailableSlots(
    allAvailabilities,
    alreadyBookedList,
    earliestBookableDay
  ) {
    console.log("Checking common available slots...");
    console.log(
      "All Availabilities:",
      JSON.stringify(allAvailabilities, null, 2)
    );
    console.log("Already Booked List:", alreadyBookedList);
    console.log("Earliest Bookable Day:", earliestBookableDay);

    let commonSlots = null;

    for (const userAvailability of allAvailabilities) {
      const {
        start_date,
        end_date,
        daily_start_time,
        daily_end_time,
        slot_duration_minutes,
        excludedDays,
        timeOffsetSeconds,
      } = userAvailability;

      console.log("Processing user availability...");
      console.log("User Availability:", userAvailability);

      const dateRanges = generateDateRanges(
        start_date,
        end_date,
        excludedDays,
        timeOffsetSeconds,
        earliestBookableDay
      );
      let userSlots = [];

      for (const date of dateRanges) {
        const slots = generateTimeSlots(
          date,
          daily_start_time,
          daily_end_time,
          slot_duration_minutes,
          timeOffsetSeconds
        );
        userSlots.push(...slots);
      }

      console.log("User Slots before filtering:", userSlots);

      userSlots = userSlots.filter(([slotStart, slotEnd]) => {
        return !alreadyBookedList.some(([bookedStart, bookedEnd]) => {
          return (
            moment.utc(slotStart).isBefore(moment.utc(bookedEnd)) &&
            moment.utc(slotEnd).isAfter(moment.utc(bookedStart))
          );
        });
      });

      console.log("User Slots after filtering:", userSlots);

      if (commonSlots === null) {
        commonSlots = userSlots;
      } else {
        commonSlots = commonSlots.filter(([startA, endA]) =>
          userSlots.some(
            ([startB, endB]) =>
              moment.utc(startA).isSameOrAfter(moment.utc(startB)) &&
              moment.utc(endA).isSameOrBefore(moment.utc(endB))
          )
        );
      }

      if (commonSlots.length === 0) {
        console.log("No common slots found.");
        return "no";
      }
    }

    console.log("Final common slots:", JSON.stringify(commonSlots, null, 2));
    return commonSlots.length > 0 ? "yes" : "no";
  }

  return {
    checkCommonAvailableSlots,
  };
};

// Attach to window for Bubble
window["checkOverlaps"] = checkOverlaps;
