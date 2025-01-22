
export const schedule = async function () {
  function generate42CalendarDates(anchorDateUTC, offsetInSeconds, isStart) {
    console.log(anchorDateUTC);
    console.log(offsetInSeconds);
    // 1) Parse the input date string into a Date object in UTC.
    const parsedDate = new Date(anchorDateUTC);

    // 2) Extract the year and month from that UTC date.
    const year = parsedDate.getUTCFullYear();
    const month = parsedDate.getUTCMonth() + 1; // 1..12

    // 3) Build a Date for "year-month-1 00:00:00 UTC" (start of the month in UTC).
    const firstOfMonthUTC = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));

    // Helper to construct a Date object that corresponds to "local-midnight" at the given offset.
    // local-midnight = "that day’s 00:00" in local time => which is "that day’s 00:00 - offset" in UTC
    function makeLocalMidnight(dateUTC) {
      // dateUTC.getTime() is the absolute UTC timestamp in ms.
      // Subtract offsetInSeconds * 1000 => this new Date is the absolute moment of "local 00:00"
      return new Date(dateUTC.getTime() - offsetInSeconds * 1000);
    }

    // 4) Convert that "start-of-month in UTC" to local-midnight for the given offset.
    const firstOfMonthLocalMidnight = makeLocalMidnight(firstOfMonthUTC);

    // 5) Figure out the local day-of-week for that day. (0=Sunday,...,6=Saturday)
    const firstDayLocalDOW = firstOfMonthLocalMidnight.getUTCDay();

    // 6) We want the calendar to start on that Sunday.
    //    If firstDayLocalDOW=0 => Sunday => offsetDays=0
    //    If firstDayLocalDOW=3 => Wed => offsetDays=3 => go back 3 days to Sunday, etc.
    const offsetDays = firstDayLocalDOW;

    // 7) The first Sunday "local-midnight" => firstOfMonthLocalMidnight minus offsetDays
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startDateLocal = new Date(
      firstOfMonthLocalMidnight.getTime() - offsetDays * oneDayMs
    );

    // 8) Build the 42 consecutive days
    const dates = [];
    for (let i = 0; i < 42; i++) {
      // Each step is 24h after the previous local-midnight
      const currentLocalMidnight = new Date(
        startDateLocal.getTime() + i * oneDayMs
      );

      // 9) Format that moment as UTC in "YYYY-MM-DDTHH:mm:ssZ"
      //    We read the UTC components, because `currentLocalMidnight` is pinned to
      //    the absolute moment of local-midnight at the given offset.
      //    But we want the final output as an ISO string with trailing "Z".
      const utcYear = currentLocalMidnight.getUTCFullYear();
      const utcMonth = String(currentLocalMidnight.getUTCMonth() + 1).padStart(
        2,
        "0"
      );
      const utcDay = String(currentLocalMidnight.getUTCDate()).padStart(2, "0");
      const utcHour = String(currentLocalMidnight.getUTCHours()).padStart(
        2,
        "0"
      );
      const utcMinute = String(currentLocalMidnight.getUTCMinutes()).padStart(
        2,
        "0"
      );
      const utcSecond = String(currentLocalMidnight.getUTCSeconds()).padStart(
        2,
        "0"
      );

      const dateStr = `${utcYear}-${utcMonth}-${utcDay}T${utcHour}:${utcMinute}:${utcSecond}Z`;
      dates.push(dateStr);
    }

    // 10) Return or bubble
    console.log(dates);
    console.log(isStart);
    if (isStart) {
      bubble_fn_listOfStartDates(dates);
    } else {
      bubble_fn_listOfEndDates(dates);
    }
  }

  function adjustDatesToOffset(oldOffsetSeconds, newOffsetSeconds, startDateISO, endDateISO) {

    console.log("startDateISO", startDateISO);
    console.log("endDateISO", endDateISO);
  // Shift a single date from oldOffset -> newOffset
  function shiftDate(dateISO) {
    if (!dateISO) return null;

    // Parse the original date string (e.g. "2024-12-10T11:00:00Z")
    const oldDateUTC = new Date(dateISO);

    // The difference between oldOffset and newOffset (in ms)
    // Example: oldOffset=-39600 (-11 hours), newOffset=-36000 (-10 hours) => delta=-3600
    const deltaSeconds = oldOffsetSeconds - newOffsetSeconds;
    const deltaMs = deltaSeconds * 1000;

    // Add the delta, shifting from old local-midnight to new local-midnight
    const newDateUTC = new Date(oldDateUTC.getTime() + deltaMs);

    // Return the new date as an ISO string (e.g. "2024-12-10T10:00:00.000Z")
    return newDateUTC.toISOString();
  }

  // Shift the two dates
  const adjustedStartDate = shiftDate(startDateISO);
  const adjustedEndDate = shiftDate(endDateISO);

  console.log("adjustedStartDate", adjustedStartDate);
  console.log("adjustedEndDate", adjustedEndDate);

  // Send them to Bubble
  bubble_fn_newStart(adjustedStartDate);
  bubble_fn_newEnd(adjustedEndDate);
}



  function generateStartTimes(startTime, duration) {
    const times = [];
    let [startHour, startMinute] = startTime.split(":").map(Number);

    // Convert start time to minutes
    let currentTimeInMinutes = startHour * 60 + startMinute;
    console.log("Initial start time in minutes:", currentTimeInMinutes);

    // Determine the last possible start time based on duration
    const endTimeInMinutes = 23 * 60 + (60 - duration);
    console.log("End time in minutes:", endTimeInMinutes);

    while (currentTimeInMinutes <= endTimeInMinutes) {
      const hours = Math.floor(currentTimeInMinutes / 60);
      const minutes = currentTimeInMinutes % 60;
      const time = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      times.push(time);
      console.log("Generated start time:", time);
      currentTimeInMinutes += duration;
      console.log("Next start time in minutes:", currentTimeInMinutes);
    }

    console.log("starttimes", times);
    bubble_fn_startTime(times);
  }

  function generateEndTimes(startTime, duration) {
    const times = [];
    let [startHour, startMinute] = startTime.split(":").map(Number);

    // Convert start time to minutes and add duration
    let currentTimeInMinutes = startHour * 60 + startMinute + duration;
    console.log("Initial end time in minutes:", currentTimeInMinutes);

    // Loop until 24:00
    const endTimeInMinutes = 24 * 60;
    console.log("Final end time in minutes:", endTimeInMinutes);

    while (currentTimeInMinutes <= endTimeInMinutes) {
      const hours = Math.floor(currentTimeInMinutes / 60);
      const minutes = currentTimeInMinutes % 60;
      const time = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      times.push(time);
      console.log("Generated end time:", time);
      currentTimeInMinutes += duration;
      console.log("Next end time in minutes:", currentTimeInMinutes);
    }
    console.log("endtimes", times);
    bubble_fn_endTime(times);
  }

  function generateSlotsForWeek(
    mainAvailability,
    viewerStartDate,
    alreadyBookedList,
    modifiedSlots,
    offset = 0,
    userOffsetInSeconds = 0,
    blockedByUserList
  ) {
    console.log("======== Function Start ========");
    console.log("mainAvailability:", JSON.stringify(mainAvailability, null, 2));
    console.log("viewerStartDate:", viewerStartDate);
    console.log(
      "alreadyBookedList:",
      JSON.stringify(alreadyBookedList, null, 2)
    );
    console.log("modifiedSlots:", JSON.stringify(modifiedSlots, null, 2));
    console.log("offset:", offset);
    console.log("userOffsetInSeconds:", userOffsetInSeconds);
    console.log(
      "blockedByUserList:",
      JSON.stringify(blockedByUserList, null, 2)
    );

    console.log("mainAvailability:", mainAvailability);

    const slotDuration = mainAvailability.slot_duration_minutes;

    // Compute week range
    const { globalStart, globalEnd, exit } = computeWeekRange(
      mainAvailability,
      viewerStartDate,
      offset,
      userOffsetInSeconds
    );

    console.log("globalStart:", globalStart);
    console.log("globalEnd:", globalEnd);

    // Generate day boundaries
    let outputlist6 = generateDayBoundaries(globalStart);
    console.log("Generated outputlist6 (Day Boundaries):", outputlist6);

    // Declare slot outputs
    let outputlist7 = [];
    let outputlist1 = [];
    let outputlist2 = [];
    let outputlist3 = [];
    let outputlist4 = [];
    let outputlist5 = [];
    let outputlist8 = [];
    let outputlist9 = [];

    if (!exit) {
      console.log("Generating available slots...");

      // Generate weekly slots
      outputlist7 = generateWeeklySlots(
        globalStart,
        mainAvailability.daily_start_time,
        mainAvailability.daily_end_time,
        slotDuration
      );
      console.log("Generated outputlist7 (All Weekly Slots):", outputlist7);

      // Assign slot information
      const slotInfoResults = assignSlotInfo(
        outputlist7,
        mainAvailability,
        blockedByUserList,
        modifiedSlots
      );
      outputlist1 = slotInfoResults.outputlist1;
      outputlist2 = slotInfoResults.outputlist2;
      outputlist4 = slotInfoResults.outputlist4;
      outputlist8 = slotInfoResults.outputlist8;
      outputlist9 = slotInfoResults.outputlist9;

      // Generate outputlist3 (already booked slots)
      outputlist3 = outputlist7.map((slot) => {
        const slotStart = moment.utc(slot[0]);
        const slotEnd = moment.utc(slot[1]);

        console.log(
          "Processing slot:",
          slotStart.format(),
          "-",
          slotEnd.format()
        );

        // 1) ALREADY BOOKED CHECK
        const bookedBubbleIds = alreadyBookedList
          .filter((booked) => {
            const bookedStart = moment.utc(booked.start_date);
            const bookedEnd = moment.utc(booked.end_date);
            return isSlotOverlapping(
              slotStart,
              slotEnd,
              bookedStart,
              bookedEnd
            );
          })
          .map((booked) => booked.bubbleId);

        let result =
          bookedBubbleIds.length > 0 ? bookedBubbleIds.join("_") : null;

        // 2) BEFORE MINIMUM BOOKABLE DAY CHECK (only if NOT booked)
        if (!result) {
          const earliestBookableMoment = moment
            .utc()
            .add(mainAvailability.earliestBookableDay, "days");
          console.log(
            `Checking earliest bookable day (${mainAvailability.earliestBookableDay} days ahead):`,
            earliestBookableMoment.format()
          );

          if (slotEnd.isBefore(earliestBookableMoment)) {
            console.log(
              "Slot before earliest bookable day:",
              slotStart.format()
            );
            result = "beforeMinimumDay";
          }
        }

        // 3) EXCLUDED DAY CHECK (only if NOT booked and NOT before min day)
        if (!result) {
          const { timeOffsetSeconds, excludedDays } = mainAvailability || {};
          if (!timeOffsetSeconds || !excludedDays) {
            console.warn(
              "Skipping exclusion check due to missing offset or excludedDays."
            );
          } else {
            // Convert slot time to the mainAvailability's timezone
            const offsetInMinutes = timeOffsetSeconds / 60;
            const localSlotStart = slotStart
              .clone()
              .utcOffset(offsetInMinutes, true);
            const localDay = localSlotStart.day();

            console.log("Checking slot against excluded days...");
            console.log(
              `Converted slot time with offset (${timeOffsetSeconds} seconds):`,
              localSlotStart.format(),
              "Day of week:",
              localDay
            );
            console.log("Excluded days list:", excludedDays);

            // Check if the local day is in the excludedDays array
            if (excludedDays.includes(localDay)) {
              console.log(
                `Slot falls on excluded day (${localDay}), marking as excluded.`
              );
              result = "excludedDay";
            }
          }
        }

        console.log("Final slot result:", result);
        return result;
      });


      // Filter available slots based on actual availability
      outputlist5 = filterSlotsByAvailabilityRange(
        outputlist7,
        globalStart,
        globalEnd
      );

      // Adjust slots to the viewer's timezone
      outputlist7 = adjustSlotsToViewerTimezone(
        outputlist7,
        userOffsetInSeconds
      );
      outputlist5 = adjustSlotsToViewerTimezone(
        outputlist5,
        userOffsetInSeconds
      );
    } else {
      console.warn("No valid availability found. Skipping slot generation.");
    }

    // Adjust `outputlist6` to viewer timezone
    outputlist6 = adjustSlotsToViewerTimezone(outputlist6, userOffsetInSeconds);

    // Final output
    const result = {
      outputlist1,
      outputlist2,
      outputlist3,
      outputlist4,
      outputlist5,
      outputlist6,
      outputlist7,
      outputlist8,
      outputlist9,
      exit,
    };

    console.log("Final output:", result);
    console.log("======== Function End ========");

    // Send result to Bubble
    bubble_fn_hours(result);

    // Signal readiness after a delay
    setTimeout(() => bubble_fn_ready(), 3000);

    return result;
  }

  // Helper functions
  function adjustSlotsToViewerTimezone(slotList, userOffsetInSeconds) {
    const userOffsetInMinutes = userOffsetInSeconds / 60;

    return slotList.map((slotRange) =>
      slotRange.map((slot) =>
        moment
          .utc(slot)
          .utcOffset(userOffsetInMinutes)
          .format("YYYY-MM-DDTHH:mm:ssZ")
      )
    );
  }

  function isSlotOverlapping(slotStart, slotEnd, bookedStart, bookedEnd) {
    return (
      slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
      slotEnd.isBetween(bookedStart, bookedEnd, null, "(]") ||
      bookedStart.isBetween(slotStart, slotEnd, null, "[)") ||
      bookedEnd.isBetween(slotStart, slotEnd, null, "(]")
    );
  }

  function computeWeekRange(
    mainAvailability,
    viewerStartDate,
    offset,
    userOffsetInSeconds
  ) {
    console.log("=== Function Start ===");
    console.log("Input - mainAvailability:", mainAvailability);
    console.log("Input - viewerStartDate:", viewerStartDate);
    console.log("Input - offset:", offset);
    console.log("Input - userOffsetInSeconds:", userOffsetInSeconds);

    const userOffsetInMinutes = userOffsetInSeconds / 60;
    console.log("Computed userOffsetInMinutes:", userOffsetInMinutes);

    // Step 1: Calculate the adjusted start date based on the user's timezone
    const viewerStartLocal = moment
      .utc(viewerStartDate)
      .utcOffset(userOffsetInMinutes)
      .startOf("day")
      .add(offset * 7, "days");

    console.log("Computed viewerStartLocal:", viewerStartLocal.format());

    if (!viewerStartLocal.isValid()) {
      console.error("Invalid viewerStartDate:", viewerStartDate);
      return { error: "Invalid start date", exit: true };
    }

    // Step 2: Parse the main availability start and end dates
    const availabilityStart = moment.utc(mainAvailability.start_date);
    const availabilityEnd = moment.utc(mainAvailability.end_date);

    console.log("Availability start_date (UTC):", availabilityStart.format());
    console.log("Availability end_date (UTC):", availabilityEnd.format());

    // Step 3: Compute the global and real start/end times
    const globalStartLocal = viewerStartLocal.clone().startOf("day");
    const globalEndLocal = globalStartLocal.clone().add(6, "days").endOf("day");

    const realStartLocal = moment.max(globalStartLocal, availabilityStart);
    const realEndLocal = moment.min(globalEndLocal, availabilityEnd);

    console.log("Global start (local):", globalStartLocal.format());
    console.log("Global end (local):", globalEndLocal.format());
    console.log("Real start (local):", realStartLocal.format());
    console.log("Real end (local):", realEndLocal.format());

    // Step 4: Calculate the daily start and end times
    const [startHour, startMin] = mainAvailability.daily_start_time
      .split(":")
      .map(Number);
    const [endHour, endMin] = mainAvailability.daily_end_time
      .split(":")
      .map(Number);

    const commonDailyStart = moment.utc().set({
      hour: startHour,
      minute: startMin,
      second: 0,
      millisecond: 0,
    });

    const commonDailyEnd = moment.utc().set({
      hour: endHour,
      minute: endMin,
      second: 0,
      millisecond: 0,
    });

    console.log("Final daily start (UTC):", commonDailyStart.format("HH:mm"));
    console.log("Final daily end (UTC):", commonDailyEnd.format("HH:mm"));

    // Step 5: Convert all outputs to UTC strings
    const globalStartUTC = globalStartLocal.clone().utc().format();
    const globalEndUTC = globalEndLocal.clone().utc().format();
    const realStartUTC = realStartLocal.clone().utc().format();
    const realEndUTC = realEndLocal.clone().utc().format();

    console.log("Global start (UTC):", globalStartUTC);
    console.log("Global end (UTC):", globalEndUTC);
    console.log("Real start (UTC):", realStartUTC);
    console.log("Real end (UTC):", realEndUTC);

    // Check for overlap and determine if processing should continue
    const hasOverlap = realEndLocal.isSameOrAfter(realStartLocal);
    console.log("Has overlap:", hasOverlap);

    // Return computed range and exit flag
    console.log("=== Function End ===");
    return {
      globalStart: globalStartUTC,
      globalEnd: globalEndUTC,
      commonDailyStart: commonDailyStart.format("HH:mm"),
      commonDailyEnd: commonDailyEnd.format("HH:mm"),
      realStart: realStartUTC,
      realEnd: realEndUTC,
      exit: !hasOverlap, // Exit is true if there's no overlap
    };
  }



  function generateDayBoundaries(globalStartStr, totalDays = 7) {
    // Parse the incoming string (with offset) and preserve the offset
    const globalStart = moment.parseZone(globalStartStr);

    const outputlist6 = [];
    for (let i = 0; i < totalDays; i++) {
      // Calculate day boundaries using the offset-preserved time
      const dayStart = globalStart.clone().add(i, "days");
      const dayEnd = dayStart.clone().add(1, "days").subtract(1, "second");

      // Format in ISO8601 with the *original* offset
      outputlist6.push([
        dayStart.format("YYYY-MM-DDTHH:mm:ssZ"),
        dayEnd.format("YYYY-MM-DDTHH:mm:ssZ"),
      ]);
    }
    return outputlist6;
  }

  function generateBaseDay(
    globalStartStr,
    commonDailyStartStr,
    commonDailyEndStr,
    slotDuration
  ) {
    const baseSlots = [];
    const globalStart = moment.parseZone(globalStartStr);

    console.log("=== generateBaseDay ===");
    console.log("Input - globalStartStr:", globalStartStr);
    console.log("Input - commonDailyStartStr:", commonDailyStartStr);
    console.log("Input - commonDailyEndStr:", commonDailyEndStr);
    console.log("Input - slotDuration:", slotDuration);

    // Parse daily start and end times
    const [startHour, startMin] = commonDailyStartStr.split(":").map(Number);
    const [endHour, endMin] = commonDailyEndStr.split(":").map(Number);
    console.log("Parsed commonDailyStart:", { startHour, startMin });
    console.log("Parsed commonDailyEnd:", { endHour, endMin });

    // Calculate the daily start and end times based on globalStart's day
    let startMoment = globalStart.clone().set({
      hour: startHour,
      minute: startMin,
      second: 0,
      millisecond: 0,
    });

    let endMoment = globalStart.clone().set({
      hour: endHour,
      minute: endMin,
      second: 0,
      millisecond: 0,
    });

    // Adjust for cases where the end time is on the next day
    if (endMoment.isBefore(startMoment)) {
      endMoment.add(1, "day");
    }

    console.log("Daily range - startMoment:", startMoment.format());
    console.log("Daily range - endMoment:", endMoment.format());

    // Ensure slots start on or after globalStart
    if (globalStart.isAfter(endMoment)) {
      console.log(
        "GlobalStart is after today's daily range. Moving to next day..."
      );
      startMoment.add(1, "day").set({ hour: startHour, minute: startMin });
      endMoment.add(1, "day").set({ hour: endHour, minute: endMin });
      console.log("Next day startMoment:", startMoment.format());
      console.log("Next day endMoment:", endMoment.format());
    } else if (globalStart.isAfter(startMoment)) {
      console.log(
        "GlobalStart is within today's range. Adjusting startMoment..."
      );
      startMoment = globalStart.clone();
      console.log("Adjusted startMoment:", startMoment.format());
    }

    // Generate slots
    let currentStart = startMoment.clone();
    console.log("Starting slot generation...");
    while (currentStart.isBefore(endMoment)) {
      const nextSlot = currentStart.clone().add(slotDuration, "minutes");
      if (nextSlot.isAfter(endMoment)) break;

      baseSlots.push([
        currentStart.format("YYYY-MM-DDTHH:mm:ssZ"),
        nextSlot.format("YYYY-MM-DDTHH:mm:ssZ"),
      ]);

      console.log(
        "Generated slot:",
        currentStart.format("YYYY-MM-DDTHH:mm:ssZ"),
        "to",
        nextSlot.format("YYYY-MM-DDTHH:mm:ssZ")
      );

      currentStart = nextSlot;
    }

    console.log("Slot generation completed. Total slots:", baseSlots.length);
    console.log("Generated slots:", baseSlots);
    console.log("=== End of generateBaseDay ===");

    return baseSlots;
  }







  function generateWeeklySlots(
    globalStartStr,
    commonDailyStartStr,
    commonDailyEndStr,
    slotDuration // e.g. 60
  ) {
    // 1) Base day of N slots (where N is dynamic)
    const base = generateBaseDay(
      globalStartStr,
      commonDailyStartStr,
      commonDailyEndStr,
      slotDuration
    );

    // 2) For 7 days total, replicate
    const outputlist7 = [];
    for (let day = 0; day < 7; day++) {
      for (let [startStr, endStr] of base) {
        const newStart = moment.parseZone(startStr).add(day, "days");
        const newEnd = moment.parseZone(endStr).add(day, "days");
        outputlist7.push([
          newStart.format("YYYY-MM-DDTHH:mm:ssZ"),
          newEnd.format("YYYY-MM-DDTHH:mm:ssZ"),
        ]);
      }
    }

    return outputlist7;
  }

  function assignSlotInfo(
    outputlist7,
    mainAvailability,
    blockedByUserList,
    modifiedSlots
  ) {
    console.log("Modified slots:", modifiedSlots);
    console.log("blockedByUserList:", blockedByUserList);
    console.log("outputlist7:", outputlist7);
    console.log("In assignSlotInfo, mainAvailability:", mainAvailability);

    if (!mainAvailability) {
      console.error("mainAvailability is undefined:", mainAvailability);
      return {
        outputlist1: [],
        outputlist2: [],
        outputlist4: [],
        outputlist8: [],
        outputlist9: [],
      };
    }

    const outputlist1 = []; // Meeting links
    const outputlist2 = []; // Addresses
    const outputlist4 = []; // Modified slot information
    const outputlist8 = []; // Blocked by user
    const outputlist9 = []; // StartupCorners information

    const startDate = moment.utc(mainAvailability.start_date).startOf("day");
    const endDate = moment.utc(mainAvailability.end_date).endOf("day");

    outputlist7.forEach((slotRange) => {
      const slotStart = moment.utc(slotRange[0]);
      const slotEnd = moment.utc(slotRange[1]);

      const includesCurrentDay = slotStart.isBetween(
        startDate,
        endDate,
        null,
        "[]"
      );

      if (includesCurrentDay) {
        let slotInfo = {
          slotTimeRange: slotRange,
          meetingLink: mainAvailability.meetingLink,
          Address: mainAvailability.Address,
          isModified: null,
          blockedByUser: false,
          isStartupCorners: mainAvailability.isStartupCorners,
        };

        // Check if the slot is blocked by the user
        blockedByUserList.forEach((blockedSlot) => {
          const blockedStart = moment.utc(blockedSlot.start_date);
          const blockedEnd = moment.utc(blockedSlot.end_date);

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
          const modifiedStart = moment.utc(modifiedSlot.start_date);
          const modifiedEnd = moment.utc(modifiedSlot.end_date);

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
        outputlist4.push(slotInfo.isModified);
        outputlist8.push(slotInfo.blockedByUser);
        outputlist9.push(slotInfo.isStartupCorners);
      }
    });

    return {
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist8,
      outputlist9,
    };
  }


  function filterSlotsByAvailabilityRange(allSlots, globalStart, globalEnd) {
    const outputlist5 = [];
    console.log("Input allSlots:", allSlots);
    console.log("Global start:", globalStart);
    console.log("Global end:", globalEnd);

    if (globalStart && globalEnd) {
      allSlots.forEach((slotRange, index) => {
        const slotStart = moment.utc(slotRange[0]);
        const slotEnd = moment.utc(slotRange[1]);

        if (slotStart.isBefore(globalEnd) && slotEnd.isAfter(globalStart)) {
          outputlist5.push(slotRange);
        }
      });
    } else {
      console.warn(
        "Global start or global end is undefined. No filtering applied."
      );
    }

    console.log("Filtered slots (outputlist5):", outputlist5);
    return outputlist5;
  }

  function findOverlappingTimeRanges(availabilities, userids, mainuserid) {
    console.log("Received Availabilities:", availabilities);

    // Validate input
    if (!Array.isArray(availabilities)) {
      console.error("Invalid input: availabilities should be an array.");
      return [];
    }

    // Map bubbleids to userids
    const bubbleToUser = {};
    const allUserIds = new Set();
    for (const a of availabilities) {
      if (!a.bubbleid || !a.userid) {
        console.error(
          "Invalid availability object: missing bubbleid or userid."
        );
        return [];
      }
      bubbleToUser[a.bubbleid] = a.userid;
      allUserIds.add(a.userid);
    }

    const overlappingBubbleIds = new Set();

    // Compare each availability with all others
    for (let i = 0; i < availabilities.length; i++) {
      const availability1 = availabilities[i];
      const dateStart1 = moment.utc(availability1.start_date);
      const dateEnd1 = moment.utc(availability1.end_date);

      for (let j = i + 1; j < availabilities.length; j++) {
        const availability2 = availabilities[j];
        const dateStart2 = moment.utc(availability2.start_date);
        const dateEnd2 = moment.utc(availability2.end_date);

        // Check if the date ranges overlap
        const dateOverlap =
          dateStart1.isBefore(dateEnd2) && dateStart2.isBefore(dateEnd1);

        if (!dateOverlap) {
          continue; // Skip if no date overlap
        }

        // Check daily time ranges for overlap
        const dailyStart1 = moment.utc(
          "1970-01-01T" + availability1.daily_start_time + ":00Z"
        );
        const dailyEnd1 = moment.utc(
          "1970-01-01T" + availability1.daily_end_time + ":00Z"
        );
        const dailyStart2 = moment.utc(
          "1970-01-01T" + availability2.daily_start_time + ":00Z"
        );
        const dailyEnd2 = moment.utc(
          "1970-01-01T" + availability2.daily_end_time + ":00Z"
        );

        // Adjust for crossing midnight
        if (dailyEnd1.isBefore(dailyStart1)) dailyEnd1.add(1, "day");
        if (dailyEnd2.isBefore(dailyStart2)) dailyEnd2.add(1, "day");

        const dailyOverlap =
          dailyStart1.isBefore(dailyEnd2) && dailyStart2.isBefore(dailyEnd1);

        if (dailyOverlap) {
          console.log(
            `Overlap found between Bubble IDs ${availability1.bubbleid} and ${availability2.bubbleid}`
          );
          overlappingBubbleIds.add(availability1.bubbleid);
          overlappingBubbleIds.add(availability2.bubbleid);
        }
      }
    }

    const overlappingBubbleIdsArray = Array.from(overlappingBubbleIds);

    // Determine which user IDs overlap
    const overlappingUserIds = new Set(
      overlappingBubbleIdsArray.map((bid) => bubbleToUser[bid])
    );

    // Determine user IDs that do not overlap (among those who had availabilities)
    const nonOverlappingUserIds = Array.from(allUserIds).filter(
      (uid) => !overlappingUserIds.has(uid)
    );

    // Find user IDs that have no availabilities at all
    const noAvailabilityUserIds = userids.filter((uid) => !allUserIds.has(uid));

    // Combine non-overlapping with no-availability user IDs
    const finalNonOverlappingUserIds = nonOverlappingUserIds.concat(
      noAvailabilityUserIds
    );

    // Convert sets to arrays
    const overlappingUserIdsArray = Array.from(overlappingUserIds);

    // Special case: Only one userid or no overlaps
    let finalOutputList1 = overlappingBubbleIdsArray;
    if (userids.length === 1 || overlappingBubbleIdsArray.length === 0) {
      // Include all availabilities of mainuserid
      finalOutputList1 = availabilities
        .filter((a) => a.userid === mainuserid)
        .map((a) => a.bubbleid);
    }

    console.log(
      "Final iteration completed. Sending results to Bubble.",
      finalOutputList1,
      overlappingUserIdsArray,
      finalNonOverlappingUserIds
    );

    // Send to bubble in a similar format as requested
    bubble_fn_overlapAvailabilities({
      outputlist1: finalOutputList1,
      outputlist2: overlappingUserIdsArray,
      outputlist3: finalNonOverlappingUserIds,
    });

    setTimeout(() => bubble_fn_ready(), 3000);

    return finalOutputList1;
  }

  return {
    // generateUniqueDates,
    generateStartTimes,
    generateEndTimes,
    adjustDatesToOffset,
    generate42CalendarDates,
    generateSlotsForWeek,
    findOverlappingTimeRanges,
  };
};

window["schedule"] = schedule;



