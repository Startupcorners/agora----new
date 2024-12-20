let baselineOutput1 = [];
let baselineOutput2 = [];
let baselineOutput3 = [];
let baselineOutput4 = [];
let baselineOutput5 = [];
let baselineOutput6 = [];
let baselineOutput7 = [];
let baselineOutput8 = [];
let baselineOutput9 = [];

function generateSlotsForWeek(
  availabilityList,
  viewerStartDate,
  alreadyBookedList,
  modifiedSlots,
  offset = 0,
  userOffsetInSeconds = 0,
  blockedByUserList,
  availabilityids,
  iteration
) {
  console.log("======== Function Start ========");
  console.log("Received iteration:", iteration);
  console.log("User IDs count:", availabilityids.length);

  const userOffsetInMinutes = userOffsetInSeconds / 60;

  console.log("User offset (in seconds):", userOffsetInSeconds);
  console.log("User offset (in minutes):", userOffsetInMinutes);

  const startDateLocal = moment
    .utc(viewerStartDate)
    .utcOffset(userOffsetInMinutes)
    .startOf("day")
    .add(offset * 7, "days");

  console.log("Start date local:", startDateLocal.format());

  if (!startDateLocal.isValid()) {
    console.error("Invalid viewerStartDate:", viewerStartDate);
    return emptyOutput();
  }

  let baseDailyStart = null;
  let baseDailyEnd = null;
  let baseSlotDuration = null;

  if (availabilityList.length > 0) {
    const firstAvailability = availabilityList[0];
    baseDailyStart = firstAvailability.daily_start_time;
    baseDailyEnd = firstAvailability.daily_end_time;
    baseSlotDuration = firstAvailability.slot_duration_minutes;

    console.log("Base daily start time:", baseDailyStart);
    console.log("Base daily end time:", baseDailyEnd);
    console.log("Base slot duration (minutes):", baseSlotDuration);
  } else {
    console.log("Availability list is empty.");
  }

  if (!baseDailyStart || !baseDailyEnd || !baseSlotDuration) {
    console.log("No baseline availability found. Exiting function.");
    return emptyOutput();
  }

  const outputlist6 = generateDayBoundaries(startDateLocal);
  console.log(
    "Generated outputlist6 (Day Boundaries):",
    JSON.stringify(outputlist6, null, 2)
  );

  const outputlist7 = generateWeeklySlots(
    startDateLocal,
    baseDailyStart,
    baseDailyEnd,
    baseSlotDuration,
    userOffsetInSeconds
  );

  console.log(
    "Generated outputlist7 (All Weekly Slots):",
    JSON.stringify(outputlist7, null, 2)
  );

  const firstSlotStart =
    outputlist7.length > 0
      ? moment.utc(outputlist7[0][0]).utcOffset(userOffsetInMinutes)
      : startDateLocal.clone();

  console.log("First slot start time (local):", firstSlotStart.format());

  let {
    outputlist1,
    outputlist2,
    outputlist3,
    outputlist4,
    outputlist8,
    outputlist9,
  } = assignSlotInfo(
    outputlist7,
    firstSlotStart,
    availabilityList,
    alreadyBookedList,
    userOffsetInSeconds,
    blockedByUserList,
    modifiedSlots
  );

  const globalStartUTC = availabilityList.length
    ? moment.min(availabilityList.map((a) => moment.utc(a.start_date)))
    : null;
  const globalEndUTC = availabilityList.length
    ? moment.max(availabilityList.map((a) => moment.utc(a.end_date)))
    : null;

  console.log("Global availability range UTC:");
  console.log("  Start:", globalStartUTC ? globalStartUTC.format() : "null");
  console.log("  End:", globalEndUTC ? globalEndUTC.format() : "null");

  const globalStart = globalStartUTC
    ? globalStartUTC.clone().utcOffset(userOffsetInMinutes)
    : null;
  const globalEnd = globalEndUTC
    ? globalEndUTC.clone().utcOffset(userOffsetInMinutes)
    : null;

  const outputlist5 = filterSlotsByAvailabilityRange(
    outputlist7,
    globalStart,
    globalEnd,
    userOffsetInSeconds
  );

  console.log(
    "Filtered outputlist5 (Slots Within Availability Range):",
    JSON.stringify(outputlist5, null, 2)
  );

  if (iteration === 1) {
    console.log("First iteration detected. Storing baseline outputs.");
    baselineOutput1 = [...outputlist1];
    baselineOutput2 = [...outputlist2];
    baselineOutput3 = [...outputlist3];
    baselineOutput4 = [...outputlist4];
    baselineOutput5 = [...outputlist5];
    baselineOutput6 = [...outputlist6];
    baselineOutput7 = [...outputlist7];
    baselineOutput8 = [...outputlist8];
    baselineOutput9 = [...outputlist9];

    if (iteration < availabilityids.length) {
      console.log("Moving to next iteration:", iteration + 1);
      bubble_fn_next(iteration + 1);
    } else {
      console.log("Only one user detected. Sending final results to Bubble.");
      bubble_fn_hours({
        outputlist1,
        outputlist2,
        outputlist3,
        outputlist4,
        outputlist5,
        outputlist6,
        outputlist7,
        outputlist8,
        outputlist9,
      });

      console.log(
        "Generated outputlist1 (Meeting Links):",
        JSON.stringify(outputlist1, null, 2)
      );
      console.log(
        "Generated outputlist2 (Addresses):",
        JSON.stringify(outputlist2, null, 2)
      );
      console.log("Generated outputlist3 (Already Booked):", outputlist3);
      console.log(
        "Generated outputlist4 (Modified Slots):",
        JSON.stringify(outputlist4, null, 2)
      );
      console.log(
        "Generated outputlist8 (Blocked by User):",
        JSON.stringify(outputlist8, null, 2)
      );
      console.log(
        "Generated outputlist9 (isStartupCorners):",
        JSON.stringify(outputlist9, null, 2)
      );
    }
  } else {
    console.log(
      `Processing iteration ${iteration} and updating baseline outputs, reflecting booked slots.`
    );

    // Map to store current booked slots
    const currentSlotsMap = {};
    outputlist7.forEach((slot) => {
      const slotKey = slot.join("|");

      // Find all booked entries for this slot
      const bookedEntries = alreadyBookedList.filter((booked) => {
        const bookedStart = moment.utc(booked.start_date);
        const bookedEnd = moment.utc(booked.end_date);
        const slotStart = moment.utc(slot[0]);
        const slotEnd = moment.utc(slot[1]);

        return (
          slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
          slotEnd.isBetween(bookedStart, bookedEnd, null, "(]") ||
          bookedStart.isBetween(slotStart, slotEnd, null, "[)") ||
          bookedEnd.isBetween(slotStart, slotEnd, null, "(]")
        );
      });

      const bookedBubbleIds = bookedEntries.map((entry) => entry.bubbleId);
      currentSlotsMap[slotKey] = { slot, bookedBubbleIds };
    });

    // Update baseline outputs without reducing slot count
    // Debugging: Verify alignment between outputlist7 and currentSlotsMap
    console.log(`Iteration ${iteration} - Starting baselineOutput3 update`);
    outputlist7.forEach((slot, index) => {
      const slotKey = slot.join("|");
      console.log(`Index ${index} - SlotKey: ${slotKey}`);
      if (!currentSlotsMap[slotKey]) {
        console.error(`Missing SlotKey in currentSlotsMap: ${slotKey}`);
      }
    });

    // Update baselineOutput3
    outputlist7.forEach((slot, index) => {
      const slotKey = slot.join("|");
      const entry = currentSlotsMap[slotKey];

      if (entry) {
        if (entry.bookedBubbleIds.length > 0) {
          let currentVal = baselineOutput3[index] || "";
          let currentIds = currentVal ? currentVal.split("_") : [];
          entry.bookedBubbleIds.forEach((bid) => {
            if (!currentIds.includes(bid)) {
              currentIds.push(bid);
            }
          });
          baselineOutput3[index] = currentIds.length
            ? currentIds.join("_")
            : null;
        }
      }
    });

    console.log(
      `Iteration ${iteration} - Updated baselineOutput3:`,
      baselineOutput3
    );

    // Ensure all outputs maintain the full set of weekly slots
    baselineOutput1 = [...outputlist1]; // Meeting links
    baselineOutput2 = [...outputlist2]; // Addresses
    baselineOutput3 = [...baselineOutput3]; // Already booked
    baselineOutput4 = [...outputlist4]; // Modified slots
    baselineOutput5 = filterSlotsByAvailabilityRange(
      outputlist7,
      globalStart,
      globalEnd,
      userOffsetInSeconds
    ); // Filtered by availability
    baselineOutput6 = [...outputlist6]; // Day boundaries
    baselineOutput7 = [...outputlist7]; // All weekly slots
    baselineOutput8 = [...outputlist8]; // Blocked by user
    baselineOutput9 = [...outputlist9]; // isStartupCorners

    if (iteration < availabilityids.length) {
      console.log("Moving to next iteration:", iteration + 1);
      bubble_fn_next(iteration + 1);
    } else {
      console.log("Final iteration completed. Sending results to Bubble.");
      bubble_fn_hours({
        outputlist1: baselineOutput1,
        outputlist2: baselineOutput2,
        outputlist3: baselineOutput3,
        outputlist4: baselineOutput4,
        outputlist5: baselineOutput5, // Only filtered list
        outputlist6: baselineOutput6,
        outputlist7: baselineOutput7,
        outputlist8: baselineOutput8,
        outputlist9: baselineOutput9,
      });

      console.log(
        "Generated outputlist1 (Meeting Links):",
        JSON.stringify(outputlist1, null, 2)
      );
      console.log(
        "Generated outputlist2 (Addresses):",
        JSON.stringify(outputlist2, null, 2)
      );
      console.log("Generated outputlist3 (Already Booked):", outputlist3);
      console.log(
        "Generated outputlist4 (Modified Slots):",
        JSON.stringify(outputlist4, null, 2)
      );
      console.log(
        "Generated outputlist5 (Filtered Slots):",
        JSON.stringify(outputlist5, null, 2)
      );
      console.log(
        "Generated outputlist8 (Blocked by User):",
        JSON.stringify(outputlist8, null, 2)
      );
      console.log(
        "Generated outputlist7 (All Weekly Slots):",
        JSON.stringify(outputlist7, null, 2)
      );
    }
  }

  console.log("======== Function End ========");
  // Add a 3-second delay before calling bubble_fn_ready
  setTimeout(() => {
    bubble_fn_ready();
  }, 3000);
}

function generateDayBoundaries(startDateLocal) {
  const outputlist6 = [];
  for (let i = 0; i < 7; i++) {
    const currentDayLocal = startDateLocal.clone().add(i, "days");
    const startOfDayLocal = currentDayLocal.clone().startOf("day");
    const endOfDayLocal = currentDayLocal.clone().endOf("day");
    outputlist6.push([
      startOfDayLocal.format("YYYY-MM-DDT00:00:00Z"),
      endOfDayLocal.format("YYYY-MM-DDT23:59:59Z"),
    ]);
  }
  return outputlist6;
}

function generateWeeklySlots(
  startDateLocal,
  baseDailyStart,
  baseDailyEnd,
  slotDuration,
  userOffsetInSeconds
) {
  const userOffsetInMinutes = userOffsetInSeconds / 60;
  const outputlist7 = [];

  console.log("Start date local:", startDateLocal.format());
  console.log("User offset (seconds):", userOffsetInSeconds);
  console.log("Base daily start time:", baseDailyStart);
  console.log("Base daily end time:", baseDailyEnd);
  console.log("Slot duration (minutes):", slotDuration);

  // Determine the entire week's start and end in local time, plus one day before and after
  const endDateLocal = startDateLocal.clone().add(7, "days").endOf("day");
  const extendedStartLocal = startDateLocal.clone().subtract(1, "day");
  const extendedEndLocal = startDateLocal.clone().add(7, "days").endOf("day");

  console.log("Extended week start (local):", extendedStartLocal.format());
  console.log("Extended week end (local):", extendedEndLocal.format());

  for (let i = 0; i < 8; i++) {
    const currentDayLocal = startDateLocal.clone().add(i, "days");
    console.log(`\nProcessing day ${i + 1}: ${currentDayLocal.format()}`);

    // Convert daily start/end times to UTC and then apply offset
    const currentDayUTC = currentDayLocal.clone().utc();
    console.log("Current day (UTC):", currentDayUTC.format());

    const dailyStartTimeUTC = moment.utc(
      currentDayUTC.format("YYYY-MM-DD") + " " + baseDailyStart,
      "YYYY-MM-DD HH:mm"
    );
    const dailyEndTimeUTC = moment.utc(
      currentDayUTC.format("YYYY-MM-DD") + " " + baseDailyEnd,
      "YYYY-MM-DD HH:mm"
    );

    // Apply user offset
    const dailyStartTimeLocal = dailyStartTimeUTC
      .clone()
      .utcOffset(userOffsetInMinutes);
    const dailyEndTimeLocal = dailyEndTimeUTC
      .clone()
      .utcOffset(userOffsetInMinutes);

    console.log(
      "Daily start time (local w/ offset):",
      dailyStartTimeLocal.format()
    );
    console.log(
      "Daily end time (local w/ offset):",
      dailyEndTimeLocal.format()
    );

    // Generate slots for the entire daily range
    outputlist7.push(
      ...generateSlotsForInterval(
        dailyStartTimeLocal,
        dailyEndTimeLocal,
        slotDuration
      )
    );
  }

  // Filter all slots to only those within the extended range
  console.log(
    "Filtering slots to ensure they fit within the extended weekly range."
  );
  const filteredSlots = outputlist7.filter((slotRange) => {
    const slotStart = moment.utc(slotRange[0]).utcOffset(userOffsetInMinutes);
    const slotEnd = moment.utc(slotRange[1]).utcOffset(userOffsetInMinutes);
    const isInExtendedRange =
      slotStart.isSameOrAfter(startDateLocal) &&
      slotEnd.isSameOrBefore(endDateLocal);
    if (!isInExtendedRange) {
      console.log(
        "Excluding slot:",
        slotStart.format(),
        "to",
        slotEnd.format(),
        "(outside extended weekly range)"
      );
    }
    return isInExtendedRange;
  });

  console.log("Final slots (with extra days):", filteredSlots);
  return filteredSlots;
}

function generateSlotsForInterval(startTimeLocal, endTimeLocal, duration) {
  const result = [];
  let current = startTimeLocal.clone();

  console.log("Generating slots...");
  console.log(
    "Start time (local):",
    startTimeLocal.format("YYYY-MM-DDTHH:mm:ssZ")
  );
  console.log("End time (local):", endTimeLocal.format("YYYY-MM-DDTHH:mm:ssZ"));
  console.log("Slot duration (minutes):", duration);

  while (current.isBefore(endTimeLocal)) {
    const slotEnd = current.clone().add(duration, "minutes");

    console.log(
      "Generated slot:",
      current.format("YYYY-MM-DDTHH:mm:ssZ"),
      "to",
      slotEnd.format("YYYY-MM-DDTHH:mm:ssZ")
    );

    result.push([
      current.format("YYYY-MM-DDTHH:mm:ssZ"),
      slotEnd.format("YYYY-MM-DDTHH:mm:ssZ"),
    ]);

    current.add(duration, "minutes");
  }

  console.log("Total slots generated:", result.length);
  return result;
}

function assignSlotInfo(
  outputlist7,
  startDateLocal,
  availabilityList,
  alreadyBookedList,
  userOffsetInSeconds,
  blockedByUserList,
  modifiedSlots
) {
  console.log("modifiedSlots", modifiedSlots);
  const userOffsetInMinutes = userOffsetInSeconds / 60;
  const outputlist1 = [];
  const outputlist2 = [];
  const outputlist3 = [];
  const outputlist4 = [];
  const outputlist8 = [];
  const outputlist9 = [];

  availabilityList.forEach((availability) => {
    const startDate = moment
      .utc(availability.start_date)
      .utcOffset(userOffsetInMinutes)
      .startOf("day");
    const endDate = moment
      .utc(availability.end_date)
      .utcOffset(userOffsetInMinutes)
      .endOf("day");

    outputlist7.forEach((slotRange) => {
      const slotStart = moment.utc(slotRange[0]).utcOffset(userOffsetInMinutes);
      const slotEnd = moment.utc(slotRange[1]).utcOffset(userOffsetInMinutes);
      const includesCurrentDayLocal = slotStart.isBetween(
        startDate,
        endDate,
        null,
        "[]"
      );

      if (includesCurrentDayLocal) {
        let slotInfo = {
          slotTimeRange: slotRange,
          meetingLink: availability.meetingLink,
          Address: availability.Address,
          alreadyBooked: null,
          isModified: null,
          blockedByUser: false,
          isStartupCorners: availability.isStartupCorners,
        };

        // Collect bubbleIds for overlapping booked slots
        const bookedBubbleIds = [];
        alreadyBookedList.forEach((bookedSlot) => {
          const bookedStart = moment
            .utc(bookedSlot.start_date)
            .utcOffset(userOffsetInMinutes);
          const bookedEnd = moment
            .utc(bookedSlot.end_date)
            .utcOffset(userOffsetInMinutes);

          if (
            slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
            slotEnd.isBetween(bookedStart, bookedEnd, null, "(]") ||
            (slotStart.isSame(bookedStart) && slotEnd.isSame(bookedEnd)) ||
            (bookedStart.isBetween(slotStart, slotEnd, null, "[)") &&
              bookedEnd.isBetween(slotStart, slotEnd, null, "(]"))
          ) {
            bookedBubbleIds.push(bookedSlot.bubbleId);
          }
        });

        // Assign concatenated bubbleIds or null
        slotInfo.alreadyBooked =
          bookedBubbleIds.length > 0 ? bookedBubbleIds.join("_") : null;

        // Check against blocked by user slots
        blockedByUserList.forEach((blockedSlot) => {
          const blockedStart = moment
            .utc(blockedSlot.start_date)
            .utcOffset(userOffsetInMinutes);
          const blockedEnd = moment
            .utc(blockedSlot.end_date)
            .utcOffset(userOffsetInMinutes);

          if (
            slotStart.isBetween(blockedStart, blockedEnd, null, "[)") ||
            slotEnd.isBetween(blockedStart, blockedEnd, null, "(]") ||
            (slotStart.isSame(blockedStart) && slotEnd.isSame(blockedEnd)) ||
            (blockedStart.isBetween(slotStart, slotEnd, null, "[)") &&
              blockedEnd.isBetween(slotStart, slotEnd, null, "(]"))
          ) {
            slotInfo.blockedByUser = true;
          }
        });

        // Check against modified slots
        modifiedSlots.forEach((modifiedSlot) => {
          const modifiedStart = moment
            .utc(modifiedSlot.start_date)
            .utcOffset(userOffsetInMinutes);
          const modifiedEnd = moment
            .utc(modifiedSlot.end_date)
            .utcOffset(userOffsetInMinutes);

          if (
            slotStart.isBetween(modifiedStart, modifiedEnd, null, "[)") ||
            slotEnd.isBetween(modifiedStart, modifiedEnd, null, "(]") ||
            (slotStart.isSame(modifiedStart) && slotEnd.isSame(modifiedEnd)) ||
            (modifiedStart.isBetween(slotStart, slotEnd, null, "[)") &&
              modifiedEnd.isBetween(slotStart, slotEnd, null, "(]"))
          ) {
            slotInfo.isModified = modifiedSlot.bubbleId;
            slotInfo.meetingLink = modifiedSlot.meetingLink;
            slotInfo.Address = modifiedSlot.Address;
            slotInfo.isStartupCorners = modifiedSlot.isStartupcorners;
          }
        });

        // Push slot info to the corresponding lists
        outputlist1.push(slotInfo.meetingLink);
        outputlist2.push(slotInfo.Address);
        outputlist3.push(slotInfo.alreadyBooked); // Push null or concatenated string
        outputlist4.push(slotInfo.isModified);
        outputlist8.push(slotInfo.blockedByUser);
        outputlist9.push(slotInfo.isStartupCorners);
      }
    });
  });

  return {
    outputlist1,
    outputlist2,
    outputlist3,
    outputlist4,
    outputlist8,
    outputlist9,
  };
}

function filterSlotsByAvailabilityRange(
  allSlots,
  globalStart,
  globalEnd,
  userOffsetInSeconds
) {
  const userOffsetInMinutes = userOffsetInSeconds / 60;
  const outputlist5 = [];
  if (globalStart && globalEnd) {
    allSlots.forEach((slotRange) => {
      const slotStart = moment.utc(slotRange[0]).utcOffset(userOffsetInMinutes);
      const slotEnd = moment.utc(slotRange[1]).utcOffset(userOffsetInMinutes);

      if (slotStart.isBefore(globalEnd) && slotEnd.isAfter(globalStart)) {
        outputlist5.push(slotRange);
      }
    });
  }
  return outputlist5;
}

function emptyOutput() {
  return {
    outputlist1: [],
    outputlist2: [],
    outputlist3: [],
    outputlist4: [],
    outputlist5: [],
    outputlist6: [],
    outputlist7: [],
    outputlist9: [],
  };
}
