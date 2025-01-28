export const scheduleAppointments = async function () {
  function generateSlotsForWeek(
    mainAvailability,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableDay,
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
      const timeOffsetSeconds = availability.timeOffsetSeconds;
      const dailyStartDuration = moment.duration(availability.daily_start_time);
      const dailyEndDuration = moment.duration(availability.daily_end_time);

      let current = start.clone();
      while (current.isBefore(end)) {
        const dayOfWeek = current.day();
        if (!availability.excludedDays.includes(dayOfWeek)) {
          // Calculate dayStartUTC and dayEndUTC by converting local times to UTC
          const dayStartUTC = current
            .clone()
            .startOf("day")
            .subtract(timeOffsetSeconds, "seconds")
            .add(dailyStartDuration);

          const dayEndUTC = current
            .clone()
            .startOf("day")
            .subtract(timeOffsetSeconds, "seconds")
            .add(dailyEndDuration);

          let slot = dayStartUTC.clone();
          while (slot.isBefore(dayEndUTC) && slot.isBefore(end)) {
            if (slot.isSameOrAfter(start)) {
              slots.push([
                slot.clone().toISOString(),
                slot
                  .clone()
                  .add(availability.slot_duration_minutes, "minutes")
                  .toISOString(),
              ]);
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

    // If allAvailabilityLists is empty, return main slots filtered by earliestBookableTime
    if (!allAvailabilityLists || allAvailabilityLists.length === 0) {
      return mainSlots.filter((slot) => {
        const slotStart = moment.utc(slot[0]);
        return slotStart.isSameOrAfter(earliestBookableTime);
      });
    }

    // Generate other availability slots and find common slots
    let commonSlots = [...mainSlots];
    allAvailabilityLists.forEach((availability) => {
      const slots = generateSlots(availability, rangeStart, rangeEnd);
      commonSlots = commonSlots.filter((mainSlot) =>
        slots.some((slot) => slot[0] === mainSlot[0] && slot[1] === mainSlot[1])
      );
    });

    // Filter out slots before the earliest bookable time
    commonSlots = commonSlots.filter((slot) => {
      const slotStart = moment.utc(slot[0]);
      return slotStart.isSameOrAfter(earliestBookableTime);
    });

    // Exclude already booked slots
    commonSlots = commonSlots.filter((slot) => {
      const slotStart = moment.utc(slot[0]);
      const slotEnd = moment.utc(slot[1]);
      return !alreadyBookedList.some((booked) => {
        const bookedStart = moment.utc(booked.start_date);
        const bookedEnd = moment.utc(booked.end_date);
        return (
          slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
          slotEnd.isBetween(bookedStart, bookedEnd, null, "(]")
        );
      });
    });

    return commonSlots;
  }





  function generateWeekRanges(viewerDate, offset, userOffsetInSeconds) {
    const moment = window.moment; // Ensure moment.js is loaded

    console.log("----- generateWeekRanges -----");
    console.log("Input Parameters:");
    console.log("viewerDate:", viewerDate);
    console.log("offset (weeks):", offset);
    console.log("userOffsetInSeconds:", userOffsetInSeconds);

    // Parse viewerDate as UTC to prevent local time interpretation
    const viewerDateUTC = moment.utc(viewerDate, "YYYY-MM-DD");
    console.log("Parsed viewerDate as UTC:", viewerDateUTC.toISOString());

    // Adjust viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = viewerDateUTC
      .add(offset, "weeks")
      .startOf("day")
      .subtract(userOffsetInSeconds, "seconds"); // Convert local midnight to UTC

    console.log(
      "Adjusted Viewer Date (UTC):",
      adjustedViewerDate.toISOString()
    );

    const weekRanges = [];
    for (let i = 0; i < 7; i++) {
      const dayStartUTC = adjustedViewerDate.clone().add(i, "days");
      const dayEndUTC = dayStartUTC.clone().add(1, "day").subtract(1, "second");

      console.log(`Day ${i} Start UTC:`, dayStartUTC.toISOString());
      console.log(`Day ${i} End UTC:  `, dayEndUTC.toISOString());

      weekRanges.push([dayStartUTC.toISOString(), dayEndUTC.toISOString()]);
    }

    console.log("Generated Week Ranges:", weekRanges);
    console.log("----- End of generateWeekRanges -----\n");

    return weekRanges;
  }






  function assignSimplifiedSlotInfo(
    mainAvailability,
    modifiedSlots,
    generatedSlots,
    blockedByUserSlots
  ) {
    if (!mainAvailability || !Array.isArray(generatedSlots)) {
      return [[], [], [], [], []]; // Empty arrays for urls, addresses, isModified, isStartupCorners, and isBlockedByUser
    }

    const urls = []; // Meeting links
    const addresses = []; // Addresses
    const isModified = []; // Modified slot info (null for non-modified, bubbleId for modified)
    const isStartupCorners = []; // Startup corners information
    const isBlockedByUser = []; // Blocked by user (null or bubbleId)

    generatedSlots.forEach((slot) => {
      const slotStart = moment.utc(slot.start_date);
      const slotEnd = moment.utc(slot.end_date);

      let slotInfo = {
        meetingLink: mainAvailability.meetingLink,
        Address: mainAvailability.Address,
        isModified: null, // Default: not modified
        isStartupCorners: mainAvailability.isStartupCorners,
        isBlockedByUser: null, // Default: not blocked
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
          isBlockedByUser: null, // Reset default for modified slots
        };
      }

      // Check if the slot is blocked by the user
      const blockedSlot = blockedByUserSlots.find((blockedSlot) => {
        const blockedStart = moment.utc(blockedSlot.start_date);
        const blockedEnd = moment.utc(blockedSlot.end_date);

        return (
          slotStart.isBetween(blockedStart, blockedEnd, null, "[)") ||
          slotEnd.isBetween(blockedStart, blockedEnd, null, "(]") ||
          (slotStart.isSame(blockedStart) && slotEnd.isSame(blockedEnd)) ||
          (blockedStart.isBetween(slotStart, slotEnd, null, "[)") &&
            blockedEnd.isBetween(slotStart, slotEnd, null, "(]"))
        );
      });

      if (blockedSlot) {
        // Mark slot as blocked by the user's bubbleId
        slotInfo.isBlockedByUser = blockedSlot.bubbleId || null;
      }

      // Push slot info to output lists
      urls.push(slotInfo.meetingLink);
      addresses.push(slotInfo.Address);
      isModified.push(slotInfo.isModified);
      isStartupCorners.push(slotInfo.isStartupCorners);
      isBlockedByUser.push(slotInfo.isBlockedByUser);
    });

    return [urls, addresses, isModified, isStartupCorners, isBlockedByUser];
  }



function generateAllPossibleSlots(slots, weekRanges) {
  const allPossibleSlots = new Set();

  const isSlotInRange = (slot, range) => {
    const slotTime = new Date(slot).getTime();
    const rangeStart = new Date(range[0]).getTime();
    const rangeEnd = new Date(range[1]).getTime();
    return slotTime >= rangeStart && slotTime <= rangeEnd;
  };

  const addSlotAndNeighbors = (baseSlot, dayOffsets, duration) => {
    const baseDate = new Date(baseSlot);
    dayOffsets.forEach((offset) => {
      const newStartDate = new Date(baseDate);
      newStartDate.setDate(baseDate.getDate() + offset);
      const newEndDate = new Date(newStartDate.getTime() + duration);
      const slotPair = JSON.stringify([
        newStartDate.toISOString(),
        newEndDate.toISOString(),
      ]);
      allPossibleSlots.add(slotPair);
    });
  };

  slots.forEach((slotRange) => {
    const [slotStart, slotEnd] = slotRange;
    const slotDuration =
      new Date(slotEnd).getTime() - new Date(slotStart).getTime();

    weekRanges.forEach((weekRange, index) => {
      if (isSlotInRange(slotStart, weekRange)) {
        const dayOffsets =
          index === 0
            ? [0, 1, 2, 3, 4, 5, 6, 7] // Week 0 offsets
            : [-1, 0, 1, 2, 3, 4, 5, 6]; // Other week offsets

        addSlotAndNeighbors(slotStart, dayOffsets, slotDuration);
      }
    });
  });

  return Array.from(allPossibleSlots)
    .map((slotPair) => JSON.parse(slotPair))
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
}






  // Wrapper function
  function generateScheduleWrapper(
  mainAvailability,
  allAvailabilityLists,
  viewerDate,
  alreadyBookedList,
  modifiedSlots,
  offset,
  userOffsetInSeconds,
  earliestBookableDay,
  blockedByUser // Function parameter
) {
  console.log("generateScheduleWrapper received:");
  console.log("mainAvailability:", mainAvailability);
  console.log("modifiedSlots:", modifiedSlots);
  console.log("viewerDate:", viewerDate);
  console.log("offset:", offset);
  console.log("userOffsetInSeconds:", userOffsetInSeconds);
  console.log("earliestBookableDay:", earliestBookableDay);
  console.log("blockedByUser:", blockedByUser);

  // Generate the slots for the expanded range (-2 days to +9 days)
  const slots = generateSlotsForWeek(
    mainAvailability,
    allAvailabilityLists,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  );

  // Generate the week ranges
  const weekRanges = generateWeekRanges(viewerDate, offset, userOffsetInSeconds);

  const allPossibleSlots = generateAllPossibleSlots(slots, weekRanges);

  // Get the outputs from assignSimplifiedSlotInfo
  const [urls, addresses, isModified, isStartupCorners, blockedByUserOutput] =
    assignSimplifiedSlotInfo(
      mainAvailability,
      modifiedSlots,
      allPossibleSlots.map((slot) => ({
        start_date: slot[0],
        end_date: slot[1],
      })), // Convert back to object format for compatibility
      blockedByUser // Pass the original blockedByUser parameter
    );

  // Assign outputs to the appropriate variables
  let outputlist1 = urls; // Meeting links
  let outputlist2 = addresses; // Addresses
  let outputlist4 = isModified; // Modified slot info
  let outputlist5 = slots; // The slots themselves (array of arrays)
  let outputlist6 = weekRanges; // Week ranges
  let outputlist7 = allPossibleSlots; // All possible slots
  let outputlist8 = blockedByUserOutput; // Output from assignSimplifiedSlotInfo
  let outputlist9 = isStartupCorners; // Startup corners information

  console.log({
    outputlist1,
    outputlist2,
    outputlist4,
    outputlist9,
    outputlist5,
    outputlist7,
    outputlist8,
    outputlist6,
  });

  // Send result to Bubble
  bubble_fn_hours({
    outputlist1: outputlist1,
    outputlist2: outputlist2,
    outputlist4: outputlist4,
    outputlist5: outputlist5,
    outputlist6: outputlist6,
    outputlist7: outputlist7,
    outputlist8: outputlist8,
    outputlist9: outputlist9,
  });

  return {
    outputlist1,
    outputlist2,
    outputlist4,
    outputlist9,
    outputlist5,
    outputlist6,
    outputlist8,
    outputlist7,
  };
}

return {
  generateScheduleWrapper,
};
}
window["scheduleAppointments"] = scheduleAppointments;
