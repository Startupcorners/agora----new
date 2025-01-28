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

  function assignSimplifiedSlotInfo(
    mainAvailability,
    modifiedSlots,
    generatedSlots
  ) {
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

    // Validate slotDurationMinutes
    if (
      typeof slotDurationMinutes !== "number" ||
      slotDurationMinutes <= 0 ||
      !Number.isInteger(slotDurationMinutes)
    ) {
      console.warn(
        "Invalid slotDurationMinutes provided. Defaulting to 30 minutes."
      );
      slotDurationMinutes = 30; // Default value
    }

    for (let i = 0; i < daysInWeek; i++) {
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

      // Check if slotStartLocal is before slotEndLocal
      if (!slotStartLocal.isBefore(slotEndLocal)) {
        console.warn(
          `No slot generation for day ${i}: slotStartLocal (${slotStartLocal.format()}) is not before slotEndLocal (${slotEndLocal.format()}).`
        );
        continue; // Skip to next day
      }

      // Safeguard: Limit the number of slots per day to prevent infinite loops
      let maxSlotsPerDay = 100; // Arbitrary large number
      let slotsGenerated = 0;

      while (
        slotStartLocal.isBefore(slotEndLocal) &&
        slotsGenerated < maxSlotsPerDay
      ) {
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

        // Push as a single date range
        standardizedSlots.push([slotStartUTC, slotEndUTC]);

        slotStartLocal = slotEndLocalTime;
        slotsGenerated++;
      }

      if (slotsGenerated >= maxSlotsPerDay) {
        console.error(
          `Maximum slot generation limit reached for day ${i}. Potential infinite loop detected.`
        );
      }
    }

    return standardizedSlots;
  }
function distributeSlotsByDay(slots, weekRanges) {
  // Initialize day variables as empty arrays
  const days = {
    dayOne: [],
    dayTwo: [],
    dayThree: [],
    dayFour: [],
    dayFive: [],
    daySix: [],
    daySeven: [],
  };

  // Define an array to map index to day names
  const dayNames = [
    "dayOne",
    "dayTwo",
    "dayThree",
    "dayFour",
    "dayFive",
    "daySix",
    "daySeven",
  ];

  // Iterate through each slot
  slots.forEach((slot) => {
    const slotStart = moment.utc(slot[0]);
    const slotEnd = moment.utc(slot[1]);

    // Iterate through each week range to find where the slot belongs
    for (let i = 0; i < weekRanges.length; i++) {
      const dayRange = weekRanges[i];
      const dayStart = moment.utc(dayRange[0]);
      const dayEnd = moment.utc(dayRange[1]);

      // Check if the slot falls within the current day range
      if (slotStart.isSameOrAfter(dayStart) && slotEnd.isSameOrBefore(dayEnd)) {
        const dayKey = dayNames[i]; // Correctly map to 'dayOne', 'dayTwo', etc.
        days[dayKey].push(slot);
        break; // Move to the next slot after assigning
      }
    }
  });

  return days;
}

  function findEarliestAndLatestFromDistributedDays(
    distributedDays,
    userOffsetInSeconds
  ) {
    let earliestTime = null;
    let latestTime = null;

    // Iterate through each day
    Object.keys(distributedDays).forEach((dayKey) => {
      const daySlots = distributedDays[dayKey];

      daySlots.forEach((slot) => {
        const slotStartLocal = moment
          .utc(slot[0])
          .add(userOffsetInSeconds, "seconds");
        const slotEndLocal = moment
          .utc(slot[1])
          .add(userOffsetInSeconds, "seconds");

        if (!earliestTime || slotStartLocal.isBefore(earliestTime)) {
          earliestTime = slotStartLocal.clone();
        }

        if (!latestTime || slotEndLocal.isAfter(latestTime)) {
          latestTime = slotEndLocal.clone();
        }
      });
    });

    // Handle cases where there are no slots
    if (!earliestTime || !latestTime) {
      console.warn(
        "No slots available to determine earliest and latest times. Setting default time range."
      );
      // Set default times, e.g., 8 AM to 8 PM in user's local time
      earliestTime = moment()
        .utc()
        .add(userOffsetInSeconds, "seconds")
        .startOf("day")
        .add(8, "hours");
      latestTime = moment()
        .utc()
        .add(userOffsetInSeconds, "seconds")
        .startOf("day")
        .add(20, "hours");
    }

    return { earliestTime, latestTime };
  }

  
  function createAllSlotsForWeekRange(
    weekRanges,
    earliestTime,
    latestTime,
    slotDurationMinutes,
  ) {
    const allGeneratedSlots = [];

    // Validate slotDurationMinutes
    if (
      typeof slotDurationMinutes !== "number" ||
      slotDurationMinutes <= 0 ||
      !Number.isInteger(slotDurationMinutes)
    ) {
      console.warn(
        "Invalid slotDurationMinutes provided. Defaulting to 30 minutes."
      );
      slotDurationMinutes = 30; // Default value
    }

    weekRanges.forEach((dayRange, index) => {
      const dayStartUTC = moment.utc(dayRange[0]);
      const dayEndUTC = moment.utc(dayRange[1]);

      // Determine the day's earliest and latest times in UTC
      let currentDayEarliestUTC = earliestTime.clone().utc();
      let currentDayLatestUTC = latestTime.clone().utc();

      // Adjust earliest and latest times per day
      // Ensure that earliestTime and latestTime are within the day's range
      if (currentDayEarliestUTC.isBefore(dayStartUTC)) {
        currentDayEarliestUTC = dayStartUTC.clone();
      }
      if (currentDayLatestUTC.isAfter(dayEndUTC)) {
        currentDayLatestUTC = dayEndUTC.clone();
      }

      // If after adjustments, earliest is not before latest, skip slot generation for the day
      if (!currentDayEarliestUTC.isBefore(currentDayLatestUTC)) {
        console.warn(
          `No slot generation for day ${
            index + 1
          }: earliest (${currentDayEarliestUTC.toISOString()}) is not before latest (${currentDayLatestUTC.toISOString()}).`
        );
        return; // Skip to the next day
      }

      let slotStartUTC = currentDayEarliestUTC.clone();
      let slotEndUTC = slotStartUTC.clone().add(slotDurationMinutes, "minutes");

      // Safeguard: Limit the number of slots per day to prevent infinite loops
      let maxSlotsPerDay = 100; // Arbitrary large number
      let slotsGenerated = 0;

      while (
        slotEndUTC.isSameOrBefore(currentDayLatestUTC) &&
        slotsGenerated < maxSlotsPerDay
      ) {
        // Push the slot as [start, end] in ISO format
        allGeneratedSlots.push([
          slotStartUTC.toISOString(),
          slotEndUTC.toISOString(),
        ]);

        // Advance to the next slot
        slotStartUTC = slotEndUTC.clone();
        slotEndUTC = slotStartUTC.clone().add(slotDurationMinutes, "minutes");
        slotsGenerated++;
      }

      if (slotsGenerated >= maxSlotsPerDay) {
        console.error(
          `Maximum slot generation limit reached for day ${
            index + 1
          }. Potential infinite loop detected.`
        );
      }
    });

    return allGeneratedSlots;
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
  try {
    // Log received parameters for debugging
    console.log("generateScheduleWrapper received:");
    console.log("mainAvailability:", mainAvailability);
    console.log("modifiedSlots:", modifiedSlots);
    console.log("viewerDate:", viewerDate);
    console.log("offset:", offset);
    console.log("userOffsetInSeconds:", userOffsetInSeconds);
    console.log("earliestBookableDay:", earliestBookableDay);
    
    // Step 1: Generate initial slots based on availability
    const slots = generateSlotsForWeek(
      mainAvailability,
      allAvailabilityLists,
      viewerDate,
      alreadyBookedList,
      offset,
      userOffsetInSeconds,
      earliestBookableDay
    );

    // Step 2: Generate week ranges (start and end times for each day)
    const weekRanges = generateWeekRanges(
      viewerDate,
      offset,
      userOffsetInSeconds
    );

    // Step 3: Distribute slots into day-specific variables
    const distributedDays = distributeSlotsByDay(slots, weekRanges);

    // Step 4: Find the earliest and latest times from the distributed slots
    const { earliestTime, latestTime } =
      findEarliestAndLatestFromDistributedDays(
        distributedDays,
        userOffsetInSeconds
      );

    // Step 5: Generate all slots for the week range based on earliest and latest times
    const allSlotsForWeekRange = createAllSlotsForWeekRange(
      weekRanges,
      earliestTime,
      latestTime,
      mainAvailability.duration,
      userOffsetInSeconds
    );

    // Step 6: Assign simplified slot information for Bubble
    const [urls, addresses, isModified, isStartupCorners] =
      assignSimplifiedSlotInfo(
        mainAvailability,
        modifiedSlots,
        allSlotsForWeekRange.map((slot) => ({
          start_date: slot[0],
          end_date: slot[1],
        })) // Convert back to object format for compatibility
      );

    // Step 7: Check if slots are available after processing
    if (!slots || slots.length === 0) {
      console.warn("No available slots generated.");

      // Initialize all output lists as empty
      const emptyOutput = {
        outputlist1: [], // Meeting links
        outputlist2: [], // Addresses
        outputlist4: [], // Modified slot info
        outputlist5: [], // The slots themselves (array of arrays)
        outputlist6: [], // Week ranges
        outputlist7: [], // All slots for week range
        outputlist9: [], // Startup corners information
      };

      // Log the empty output for debugging
      console.log("Empty Output:", emptyOutput);

      // Send empty data to Bubble
      bubble_fn_hours(emptyOutput);

      // Return empty output
      return emptyOutput;
    }

    // Step 8: Assign outputs to the appropriate variables with descriptive names
    let outputlist1 = urls; // Meeting links
    let outputlist2 = addresses; // Addresses
    let outputlist4 = isModified; // Modified slot info
    let outputlist5 = slots; // The slots themselves (array of arrays)
    let outputlist6 = weekRanges; // Week ranges
    let outputlist7 = allSlotsForWeekRange; // All slots for week range
    let outputlist9 = isStartupCorners; // Startup corners information

    // Log the outputs for debugging
    console.log({
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist7,
      outputlist6,
    });

    // Step 9: Send the results to Bubble
    bubble_fn_hours({
      outputlist1: outputlist1,
      outputlist2: outputlist2,
      outputlist4: outputlist4,
      outputlist5: outputlist5,
      outputlist6: outputlist6,
      outputlist7: outputlist7,
      outputlist9: outputlist9,
    });

    // Return the outputs for potential further use
    return {
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist6,
      outputlist7,
    };
  } catch (error) {
    // Handle any unexpected errors
    console.error("Error in generateScheduleWrapper:", error);

    // Initialize output lists as empty arrays to prevent Bubble from crashing
    const emptyOutput = {
      outputlist1: [], // Meeting links
      outputlist2: [], // Addresses
      outputlist4: [], // Modified slot info
      outputlist5: [], // The slots themselves (array of arrays)
      outputlist6: [], // Week ranges
      outputlist7: [], // All slots for week range
      outputlist9: [], // Startup corners information
    };

    // Log the empty output for debugging
    console.log("Empty Output due to Error:", emptyOutput);

    // Send empty data to Bubble to maintain consistency
    bubble_fn_hours(emptyOutput);

    // Return empty outputs
    return emptyOutput;
  }
}

return {
  generateScheduleWrapper,
};
};

window["scheduleAppointments"] = scheduleAppointments;
