
export const scheduleAppointments = async function () {
  function generateSlotsForWeek(
    mainAvailability,
    allAvailabilityLists,
    viewerDate,
    alreadyBookedList,
    modifiedSlots,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  ) {
    const moment = window.moment; // Assume moment.js is loaded for date manipulation

    // Adjust the viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = moment(viewerDate)
      .add(offset, "weeks")
      .utc()
      .startOf("day")
      .subtract(userOffsetInSeconds, "seconds");

    const weekStart = adjustedViewerDate.clone();
    const weekEnd = weekStart.clone().add(7, "days").subtract(1, "second");

    // Calculate the earliest bookable time (now + earliestBookableDay)
    const earliestBookableTime = moment()
      .utc()
      .add(earliestBookableDay, "days");

    // Helper function to calculate slots for a given availability
    function generateSlots(availability, start, end) {
      const slots = [];
      const localStart = start
        .clone()
        .add(availability.timeOffsetSeconds, "seconds");
      const localEnd = end
        .clone()
        .add(availability.timeOffsetSeconds, "seconds");
      const startOfDay = moment(availability.daily_start_time, "HH:mm");
      const endOfDay = moment(availability.daily_end_time, "HH:mm");

      let current = localStart.clone();
      while (current.isBefore(localEnd)) {
        const dayOfWeek = current.day();
        if (!availability.excludedDays.includes(dayOfWeek)) {
          const dayStart = current
            .clone()
            .startOf("day")
            .add(startOfDay.hours(), "hours")
            .add(startOfDay.minutes(), "minutes");
          const dayEnd = current
            .clone()
            .startOf("day")
            .add(endOfDay.hours(), "hours")
            .add(endOfDay.minutes(), "minutes");

          let slot = dayStart.clone();
          while (slot.isBefore(dayEnd) && slot.isBefore(localEnd)) {
            if (slot.isAfter(localStart)) {
              slots.push({
                start_date: slot.clone().utc().toISOString(),
                end_date: slot
                  .clone()
                  .add(availability.slot_duration_minutes, "minutes")
                  .utc()
                  .toISOString(),
              });
            }
            slot.add(availability.slot_duration_minutes, "minutes");
          }
        }
        current.add(1, "day");
      }

      return slots;
    }

    // Generate main availability slots
    const mainSlots = generateSlots(mainAvailability, weekStart, weekEnd);

    // If allAvailabilityLists is empty, return main slots
    if (!allAvailabilityLists || allAvailabilityLists.length === 0) {
      // Filter main slots to ensure they respect the earliest bookable day and exclude booked/modified slots
      return mainSlots
        .filter((slot) =>
          moment(slot.start_date).isSameOrAfter(earliestBookableTime)
        )
        .filter(
          (slot) =>
            !alreadyBookedList.some(
              (booked) =>
                moment(slot.start_date).isBetween(
                  booked.start_date,
                  booked.end_date,
                  null,
                  "[)"
                ) ||
                moment(slot.end_date).isBetween(
                  booked.start_date,
                  booked.end_date,
                  null,
                  "(]"
                )
            )
        )
        .filter(
          (slot) =>
            !modifiedSlots.some((mod) => mod.start_date === slot.start_date)
        );
    }

    // Generate other availability slots and find common slots
    let commonSlots = [...mainSlots];
    allAvailabilityLists.forEach((availability) => {
      const slots = generateSlots(availability, weekStart, weekEnd);
      commonSlots = commonSlots.filter((mainSlot) =>
        slots.some(
          (slot) =>
            slot.start_date === mainSlot.start_date &&
            slot.end_date === mainSlot.end_date
        )
      );
    });

    // Filter out slots before the earliest bookable time
    commonSlots = commonSlots.filter((slot) =>
      moment(slot.start_date).isSameOrAfter(earliestBookableTime)
    );

    // Exclude already booked slots
    commonSlots = commonSlots.filter(
      (slot) =>
        !alreadyBookedList.some(
          (booked) =>
            moment(slot.start_date).isBetween(
              booked.start_date,
              booked.end_date,
              null,
              "[)"
            ) ||
            moment(slot.end_date).isBetween(
              booked.start_date,
              booked.end_date,
              null,
              "(]"
            )
        )
    );

    // Exclude modified slots if needed
    const modifiedSlotKeys = new Set(
      modifiedSlots.map((slot) => slot.start_date + slot.end_date)
    );
    commonSlots = commonSlots.filter(
      (slot) => !modifiedSlotKeys.has(slot.start_date + slot.end_date)
    );

    console.log(commonSlots)

    return commonSlots;
  }


  return {
    generateSlotsForWeek,
  };
};

window["scheduleAppointments"] = scheduleAppointments;



