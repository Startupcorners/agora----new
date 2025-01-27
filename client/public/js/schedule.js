
export const schedule = async function () {
  async function runProcess(
    timezoneOffsets,
    startDate,
    endDate,
    poll,
    bookedSlots,
    durationInMinutes
  ) {
    let maxDaysToAdd = 7;
    let updatedStartDate = new Date(startDate);
    let updatedEndDate = new Date(endDate);
    let WORKING_HOURS_START = 8; // Default start time
    let WORKING_HOURS_END = 20; // Default end time

    let selectedSlots = [];

    while (selectedSlots.length < 40 && maxDaysToAdd >= 0) {
      const overlappingSlots = findOverlappingSlots(
        timezoneOffsets,
        WORKING_HOURS_START,
        WORKING_HOURS_END
      );

      let availableSlots = generateAvailableSlots(
        updatedStartDate,
        updatedEndDate,
        overlappingSlots,
        durationInMinutes
      );

      // Filter out booked slots
      availableSlots = availableSlots.filter(
        (slot) => !bookedSlots.includes(slot)
      );

      // Select 20 evenly distributed slots
      selectedSlots = availableSlots
        .filter(
          (_, index) =>
            index % Math.max(1, Math.floor(availableSlots.length / 40)) === 0
        )
        .slice(0, 40);

      console.log(
        `[${new Date().toISOString()}] Attempt with endDate ${updatedEndDate.toISOString()}, Found Slots: ${
          selectedSlots.length
        }`
      );

      if (selectedSlots.length >= 40) {
        break;
      }

      // Extend end date by one more day if maxDaysToAdd is still available
      updatedEndDate.setUTCDate(updatedEndDate.getUTCDate() + 1);
      maxDaysToAdd--;

      // If all days are added but still not enough slots, adjust working hours
      if (maxDaysToAdd === 0 && selectedSlots.length < 40) {
        console.log(
          `[${new Date().toISOString()}] Adjusting working hours to extend availability...`
        );
        WORKING_HOURS_START = Math.max(WORKING_HOURS_START - 1, 0);
        WORKING_HOURS_END = Math.min(WORKING_HOURS_END + 1, 24);
        maxDaysToAdd = 7; // Reset max days to check again with adjusted hours
      }
    }

    if (selectedSlots.length > 0) {
      const pollResult = await generatePoll(selectedSlots, poll);
      if (pollResult) {
        console.log("Poll created successfully:", pollResult);
      } else {
        console.error("Failed to create poll.");
      }
    } else {
      console.error("No available slots found.");
    }
  }

  // Function to find overlapping working hours across multiple time zones
  function findOverlappingSlots(timezoneOffsets, startHour, endHour) {
    let overlappingSlots = [];

    for (let hour = 0; hour < 24; hour++) {
      let utcTime = new Date(Date.UTC(2025, 0, 28, hour)); // January 28, 2025 in UTC

      // Check if the hour fits in all timezone working hours
      let isOverlapping = timezoneOffsets.every((offsetInSeconds) => {
        let localTime = new Date(utcTime.getTime() + offsetInSeconds * 1000);
        return (
          localTime.getUTCHours() >= startHour &&
          localTime.getUTCHours() < endHour
        );
      });

      if (isOverlapping) {
        overlappingSlots.push(hour);
      }
    }
    return overlappingSlots;
  }

  // Function to generate available slots within overlapping hours
  function generateAvailableSlots(
    startDate,
    endDate,
    overlappingSlots,
    durationInMinutes
  ) {
    let availableSlots = [];
    let currentDate = new Date(startDate);

    while (
      currentDate <= new Date(new Date(endDate).setUTCHours(23, 59, 59, 999))
    ) {
      overlappingSlots.forEach((hour) => {
        let utcTime = new Date(currentDate);
        utcTime.setUTCHours(hour, 0, 0, 0);

        let endTime = new Date(utcTime);
        endTime.setMinutes(utcTime.getMinutes() + durationInMinutes);

        availableSlots.push(
          `${utcTime.toISOString().replace(".000", "")}Z_${endTime
            .toISOString()
            .replace(".000", "")}Z`
        );
      });

      let nextDate = new Date(currentDate);
      nextDate.setUTCDate(currentDate.getUTCDate() + 1);
      currentDate = nextDate;
    }
    return availableSlots;
  }
  // Function to generate the poll
  async function generatePoll(slots, poll) {
    try {
      // Sort slots chronologically before sending
      const sortedSlots = slots
        .slice()
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const requestBody = {
        slots: sortedSlots, // Ensuring slots are properly formatted and sorted
        poll: poll,
        iteration: 1, // Default iteration value
        iteration_plus_one: 2, // Required field for tracking
      };

      console.log(
        `[${new Date().toISOString()}] Sending poll request with body:`,
        requestBody
      );

      const response = await fetch(
        "https://agora-new.vercel.app/generatePoll",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Full response received:", result);

      if (!result.success) {
        console.error(
          "Error generating poll:",
          result.response?.error || "Unexpected response format"
        );
        return null;
      }

      console.log("Poll generated successfully:", result);
      return result;
    } catch (error) {
      console.error("Error in generatePoll function:", error.message);
      console.error("Stack Trace:", error.stack);
      return null;
    }
  }

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
      // Fix: add the offset instead of subtracting to correctly handle positive and negative timezones
      return new Date(dateUTC.getTime() + offsetInSeconds * 1000);
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

  function adjustDatesToOffset(
    oldOffsetSeconds,
    newOffsetSeconds,
    startDateISO,
    endDateISO
  ) {
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
    const slotDuration = mainAvailability.slot_duration_minutes;

    // Compute week range
    const {
      globalStart,
      globalEnd,
      commonDailyStart,
      commonDailyEnd,
      realStart,
      realEnd,
      exit,
    } = computeWeekRange(
      mainAvailability,
      viewerStartDate,
      offset,
      userOffsetInSeconds
    );

    // Generate day boundaries
    let outputlist6 = generateDayBoundaries(globalStart);

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
      // Generate weekly slots
      outputlist7 = generateWeeklySlots(
        globalStart,
        commonDailyStart,
        commonDailyEnd,
        slotDuration
      );

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
        const slotStart = moment.utc(slot[0]); // Parse in UTC
        const slotEnd = moment.utc(slot[1]);

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

          if (slotEnd.isBefore(earliestBookableMoment)) {
            result = "beforeMinimumDay";
          }
        }

        // 3) EXCLUDED DAY CHECK (only if NOT booked and NOT before min day)
        if (!result) {
          const { timeOffsetSeconds, excludedDays } = mainAvailability || {};
          if (timeOffsetSeconds && excludedDays) {
            // Convert slot time to the local timezone
            const offsetInMinutes = timeOffsetSeconds / 60;
            const localSlotStart = moment(slotStart).utcOffset(offsetInMinutes);

            // Get the correct local day number
            const localDayNumber = localSlotStart.day(); // 0 = Sunday, 1 = Monday, etc.

            // Check if the local day is excluded
            if (excludedDays.includes(localDayNumber)) {
              result = "excludedDay";
            }
          }
        }

        return result;
      });

      // Filter available slots based on actual availability
      outputlist5 = filterSlotsByAvailabilityRange(
        outputlist7,
        realStart,
        realEnd
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

    console.log(result);

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
    const userOffsetInMinutes = userOffsetInSeconds / 60;

    // Step 1: Calculate the adjusted start date based on the user's timezone
    const viewerStartLocal = moment
      .utc(viewerStartDate)
      .utcOffset(userOffsetInMinutes)
      .startOf("day")
      .add(offset * 7, "days");

    if (!viewerStartLocal.isValid()) {
      console.error("Invalid viewerStartDate:", viewerStartDate);
      return { error: "Invalid start date", exit: true };
    }

    // Step 2: Parse the main availability start and end dates
    const availabilityStart = moment.utc(mainAvailability.start_date);
    const availabilityEnd = moment.utc(mainAvailability.end_date);

    // Step 3: Compute the global and real start/end times
    const globalStartLocal = viewerStartLocal.clone().startOf("day");
    const globalEndLocal = globalStartLocal.clone().add(6, "days").endOf("day");

    const realStartLocal = moment.max(globalStartLocal, availabilityStart);
    const realEndLocal = moment.min(globalEndLocal, availabilityEnd);

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

    // Step 5: Convert all outputs to UTC strings
    const globalStartUTC = globalStartLocal.clone().utc().format();
    const globalEndUTC = globalEndLocal.clone().utc().format();
    const realStartUTC = realStartLocal.clone().utc().format();
    const realEndUTC = realEndLocal.clone().utc().format();

    // Check for overlap and determine if processing should continue
    const hasOverlap = realEndLocal.isSameOrAfter(realStartLocal);

    // Return computed range and exit flag
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

    // Parse daily start and end times
    const [startHour, startMin] = commonDailyStartStr.split(":").map(Number);
    const [endHour, endMin] = commonDailyEndStr.split(":").map(Number);

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

    // Ensure slots start on or after globalStart
    if (globalStart.isAfter(endMoment)) {
      startMoment.add(1, "day").set({ hour: startHour, minute: startMin });
      endMoment.add(1, "day").set({ hour: endHour, minute: endMin });
    } else if (globalStart.isAfter(startMoment)) {
      startMoment = globalStart.clone();
    }

    // Generate slots
    let currentStart = startMoment.clone();
    while (currentStart.isBefore(endMoment)) {
      const nextSlot = currentStart.clone().add(slotDuration, "minutes");
      if (nextSlot.isAfter(endMoment)) break;

      baseSlots.push([
        currentStart.format("YYYY-MM-DDTHH:mm:ssZ"),
        nextSlot.format("YYYY-MM-DDTHH:mm:ssZ"),
      ]);

      currentStart = nextSlot;
    }

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
    if (!mainAvailability) {
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

      if (slotStart.isBetween(startDate, endDate, null, "[]")) {
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
    runProcess,
  };
};

window["schedule"] = schedule;



