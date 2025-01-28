export const scheduleAppointments = async function () {
  function generateSlotsForWeek(
    mainAvailability,
    allAvailabilityLists,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  ) {
    // Adjust the viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = moment(viewerDate)
      .add(offset, "weeks")
      .utc()
      .startOf("day")
      .subtract(userOffsetInSeconds, "seconds");

    // Adjust the range to start 2 days before viewerDate and end 9 days after
    const rangeStart = adjustedViewerDate.clone().subtract(2, "days");
    const rangeEnd = adjustedViewerDate.clone().add(9, "days").endOf("day");

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
    const mainSlots = generateSlots(mainAvailability, rangeStart, rangeEnd);

    // If allAvailabilityLists is empty, return main slots
    if (!allAvailabilityLists || allAvailabilityLists.length === 0) {
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
        );
    }

    // Generate other availability slots and find common slots
    let commonSlots = [...mainSlots];
    allAvailabilityLists.forEach((availability) => {
      const slots = generateSlots(availability, rangeStart, rangeEnd);
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

    return commonSlots;
  }


  function generateWeekRanges(viewerDate, offset, userOffsetInSeconds) {
    const moment = window.moment; // Assume moment.js is loaded

    // Adjust viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = moment(viewerDate)
      .add(offset, "weeks")
      .startOf("day")
      .add(userOffsetInSeconds, "seconds"); // Align with the viewer's local time

    const weekRanges = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = adjustedViewerDate.clone().add(i, "days");
      const dayEnd = dayStart.clone().add(1, "day").subtract(1, "second"); // Full day in local time

      weekRanges.push({
        start: dayStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ"), // Keep it in the viewer's time zone
        end: dayEnd.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
      });
    }

    return weekRanges;
  }


  function assignSimplifiedSlotInfo(mainAvailability, modifiedSlots, generatedSlots) {
  if (!mainAvailability || !Array.isArray(generatedSlots)) {
    return [[], [], [], []]; // Empty arrays for urls, addresses, isModified, and isStartupCorners
  }

  const urls = []; // Meeting links
  const addresses = []; // Addresses
  const isModified = []; // Modified slot info (null for non-modified, bubbleId for modified)
  const isStartupCorners = []; // Startup corners information

  generatedSlots.forEach((slot) => {
    const slotStart = moment.utc(slot.start_date);
    const slotEnd = moment.utc(slot.end_date);

    let slotInfo = {
      meetingLink: mainAvailability.meetingLink,
      Address: mainAvailability.Address,
      isModified: null, // Default: not modified
      isStartupCorners: mainAvailability.isStartupCorners,
    };

    // Check if the slot is modified
    const modifiedSlot = modifiedSlots.find((modSlot) => {
      const modStart = moment.utc(modSlot.start_date);
      const modEnd = moment.utc(modSlot.end_date);

      return (
        slotStart.isBetween(modStart, modEnd, null, "[)") ||
        slotEnd.isBetween(modStart, modEnd, null, "(]") ||
        (slotStart.isSame(modStart) && slotEnd.isSame(modEnd)) ||
        (modStart.isBetween(slotStart, slotEnd, null, "[)") &&
          modEnd.isBetween(slotStart, slotEnd, null, "(]"))
      );
    });

    if (modifiedSlot) {
      // Use modified slot info
      slotInfo = {
        meetingLink: modifiedSlot.meetingLink,
        Address: modifiedSlot.Address,
        isModified: modifiedSlot.bubbleId || true, // Mark as modified
        isStartupCorners: modifiedSlot.isStartupcorners,
      };
    }

    // Push slot info to output lists
    urls.push(slotInfo.meetingLink);
    addresses.push(slotInfo.Address);
    isModified.push(slotInfo.isModified);
    isStartupCorners.push(slotInfo.isStartupCorners);
  });

  return [urls, addresses, isModified, isStartupCorners];
}





  // Wrapper function
  function generateScheduleWrapper(
    mainAvailability,
    modifiedSlots,
    viewerDate,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  ) {
    // Generate the slots for the expanded range (-2 days to +9 days)
    const slots = generateSlotsForWeek(
      mainAvailability,
      [], // No additional availability lists
      viewerDate,
      [], // No already booked slots
      offset,
      userOffsetInSeconds,
      earliestBookableDay
    );

    // Generate the week ranges
    const weekRanges = generateWeekRanges(
      viewerDate,
      offset,
      userOffsetInSeconds
    );

    // Get the outputs from assignSimplifiedSlotInfo
    const [urls, addresses, isModified, isStartupCorners] =
      assignSimplifiedSlotInfo(mainAvailability, modifiedSlots, slots);

    // Assign outputs to the appropriate variables
    let outputlist1 = urls; // Meeting links
    let outputlist2 = addresses; // Addresses
    let outputlist4 = isModified; // Modified slot info
    let outputlist5 = slots; // The slots themselves
    let outputlist6 = weekRanges; // Week ranges
    let outputlist9 = isStartupCorners; // Startup corners information

    console.log({
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist6,
    });

    // Send result to Bubble
    bubble_fn_hours({
      outputList1: outputList1,
      outputList2: outputList2,
      outputList4: outputList4,
      outputList5: outputList5,
      outputList6: outputList6,
      outputList9: outputList9,
    });

    return {
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist6,
    };
  }



  return {
    generateScheduleWrapper,
  };
};

window["scheduleAppointments"] = scheduleAppointments;
