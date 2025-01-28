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



function findEarliestAndLatestSlotsUserTime(slots, userOffsetInSeconds) {
  let earliest = null;
  let latest = null;

  slots.forEach((slot) => {
    // Convert slot times from UTC to user's local time
    const slotStartLocal = moment
      .utc(slot[0])
      .add(userOffsetInSeconds, "seconds");
    const slotEndLocal = moment
      .utc(slot[1])
      .add(userOffsetInSeconds, "seconds");

    if (!earliest || slotStartLocal.isBefore(earliest)) {
      earliest = slotStartLocal.clone();
    }
    if (!latest || slotEndLocal.isAfter(latest)) {
      latest = slotEndLocal.clone();
    }
  });

  // Normalize earliest and latest to start and end of their respective days
  const earliestTime = earliest.clone().startOf("day");
  const latestTime = latest.clone().endOf("day");

  return { earliestTime, latestTime };
}


function generateStandardizedSlots(
  earliestTime,
  latestTime,
  slotDurationMinutes,
  userOffsetInSeconds
) {
  const standardizedSlots = [];
  const daysInWeek = 7;

  for (let i = 0; i < daysInWeek; i++) {
    const daySlots = [];
    // Clone the earliestTime and add 'i' days
    const currentDay = earliestTime.clone().add(i, "days");

    // Set the start and end times for the day based on earliest and latest times
    let slotStartLocal = currentDay
      .clone()
      .hour(earliestTime.hour())
      .minute(earliestTime.minute())
      .second(0)
      .millisecond(0);
    const slotEndLocal = currentDay
      .clone()
      .hour(latestTime.hour())
      .minute(latestTime.minute())
      .second(0)
      .millisecond(0);

    while (slotStartLocal.isBefore(slotEndLocal)) {
      const slotEndLocalTime = slotStartLocal
        .clone()
        .add(slotDurationMinutes, "minutes");

      // Convert back to UTC for consistency
      const slotStartUTC = slotStartLocal
        .clone()
        .subtract(userOffsetInSeconds, "seconds")
        .toISOString();
      const slotEndUTC = slotEndLocalTime
        .clone()
        .subtract(userOffsetInSeconds, "seconds")
        .toISOString();

      daySlots.push([slotStartUTC, slotEndUTC]);

      slotStartLocal = slotEndLocalTime;
    }

    standardizedSlots.push(daySlots);
  }

  return standardizedSlots;
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
    earliestBookableDay
  ) {
    console.log("generateScheduleWrapper received:");
    console.log("mainAvailability:", mainAvailability);
    console.log("modifiedSlots:", modifiedSlots);
    console.log("viewerDate:", viewerDate);
    console.log("offset:", offset);
    console.log("userOffsetInSeconds:", userOffsetInSeconds);
    console.log("earliestBookableDay:", earliestBookableDay);
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
    const weekRanges = generateWeekRanges(
      viewerDate,
      offset,
      userOffsetInSeconds
    );

    // Step 1: Find earliest and latest slot times in user's local time
    const { earliestTime, latestTime } = findEarliestAndLatestSlotsUserTime(
      slots,
      userOffsetInSeconds
    );

    // Step 2: Generate standardized slots
    const allSlots = generateStandardizedSlots(
      earliestTime,
      latestTime,
      mainAvailability.duration,
      userOffsetInSeconds
    );

    // Get the outputs from assignSimplifiedSlotInfo
    const [urls, addresses, isModified, isStartupCorners] =
      assignSimplifiedSlotInfo(
        mainAvailability,
        modifiedSlots,
        allSlots.map((slot) => ({ start_date: slot[0], end_date: slot[1] })) // Convert back to object format for compatibility
      );

    // Assign outputs to the appropriate variables
    let outputlist1 = urls; // Meeting links
    let outputlist2 = addresses; // Addresses
    let outputlist4 = isModified; // Modified slot info
    let outputlist5 = slots; // The slots themselves (array of arrays)
    let outputlist6 = weekRanges; // Week ranges
    let outputlist7 = allSlots; // Week ranges
    let outputlist9 = isStartupCorners; // Startup corners information

    console.log({
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist7,
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
      outputlist9: outputlist9,
    });

    return {
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist6,
      outputlist7,
    };
  }




  return {
    generateScheduleWrapper,
  };
};

window["scheduleAppointments"] = scheduleAppointments;
