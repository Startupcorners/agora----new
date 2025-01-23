
export const scheduleAppointments = async function () {
  function generateSlotsForWeek(
    mainAvailabilityList,
    allAvailabilityLists,
    viewerStartDate,
    alreadyBookedList,
    modifiedSlots,
    offset,
    userOffsetInSeconds,
    blockedByUserList,
    earliestBookableDay
  ) {
    const slotDuration = mainAvailabilityList[0].slot_duration_minutes;

    // Compute week range and daily intersection
    const {
      globalStart,
      globalEnd,
      commonDailyStart,
      commonDailyEnd,
      realStart,
      realEnd,
      exit,
    } = computeWeekRangeAndDailyIntersection(
      allAvailabilityLists,
      viewerStartDate,
      offset,
      userOffsetInSeconds
    );

    // Generate day boundaries (always necessary)
    const outputlist6 = generateDayBoundaries(globalStart);

    // Declare other outputs
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
        mainAvailabilityList,
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
            .add(earliestBookableDay, "days");

          if (slotEnd.isBefore(earliestBookableMoment)) {
            result = "beforeMinimumDay";
          }
        }

        // 3) EXCLUDED DAY CHECK (only if NOT booked and NOT before min day)
        if (!result) {
          let isExcluded = false;

          for (const availability of allAvailabilityLists) {
            const { timeOffsetSeconds, excludedDays } = availability || {};
            if (!timeOffsetSeconds || !excludedDays) {
              continue;
            }

            // Convert the slot's UTC start to this availability's local time
            const offsetInMinutes = timeOffsetSeconds / 60;
            const localSlotStart = moment(slotStart).utcOffset(offsetInMinutes);

            // Get the correct local day number
            const localDayNumber = localSlotStart.day(); // 0 = Sunday, 1 = Monday, etc.

            // Check if the local day is in the excludedDays array
            if (excludedDays.includes(localDayNumber)) {
              isExcluded = true;
              break; // Stop checking further if any availability excludes this day
            }
          }

          if (isExcluded) {
            result = "excludedDay";
          }
        }

        return result;
      });

      // Generate outputlist5 (filtered slots by availability)
      outputlist5 = filterSlotsByAvailabilityRange(
        outputlist7,
        realStart,
        realEnd
      );

      // Adjust slot ranges to viewer timezone
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
    const adjustedOutputlist6 = adjustSlotsToViewerTimezone(
      outputlist6,
      userOffsetInSeconds
    );

    // Final output
    const result = {
      outputlist1,
      outputlist2,
      outputlist3,
      outputlist4,
      outputlist5,
      outputlist6: adjustedOutputlist6,
      outputlist7,
      outputlist8,
      outputlist9,
      exit,
    };

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

  function computeWeekRangeAndDailyIntersection(
    allAvailabilityLists,
    viewerStartDate,
    offset,
    userOffsetInSeconds
  ) {
    const userOffsetInMinutes = userOffsetInSeconds / 60;

    // Step 1: Calculate viewer's start date for the given week in user timezone
    const viewerStartLocal = moment
      .utc(viewerStartDate)
      .utcOffset(userOffsetInMinutes)
      .startOf("day")
      .add(offset * 7, "days");

    if (!viewerStartLocal.isValid()) {
      return { error: "Invalid start date", exit: true };
    }

    let overallEarliestStart = null;
    let overallLatestEnd = null;
    let dailyStartInMinutesArray = [];
    let dailyEndInMinutesArray = [];

    // Step 2: Parse each availability and compute overall earliest/latest dates
    allAvailabilityLists.forEach((availability) => {
      const availabilityStart = moment.utc(availability.start_date);
      const availabilityEnd = moment.utc(availability.end_date);

      if (
        !overallEarliestStart ||
        availabilityStart.isAfter(overallEarliestStart)
      ) {
        overallEarliestStart = availabilityStart.clone();
      }

      if (!overallLatestEnd || availabilityEnd.isBefore(overallLatestEnd)) {
        overallLatestEnd = availabilityEnd.clone();
      }

      // Extract daily start and end times in minutes
      const [startHour, startMin] = availability.daily_start_time
        .split(":")
        .map(Number);
      const [endHour, endMin] = availability.daily_end_time
        .split(":")
        .map(Number);

      dailyStartInMinutesArray.push(startHour * 60 + startMin);
      dailyEndInMinutesArray.push(endHour * 60 + endMin);
    });

    // Step 3: Compute default global range for the week
    const globalStartLocal = viewerStartLocal.clone().startOf("day");
    const globalEndLocal = globalStartLocal.clone().add(6, "days").endOf("day");

    // Step 4: Compute realStart and realEnd
    const realStartLocal = overallEarliestStart
      ? moment.max(
          globalStartLocal,
          overallEarliestStart.utcOffset(userOffsetInMinutes)
        )
      : globalStartLocal;

    const realEndLocal = overallLatestEnd
      ? moment.min(
          globalEndLocal,
          overallLatestEnd.utcOffset(userOffsetInMinutes)
        )
      : globalEndLocal;

    // Step 5: Compute the daily intersection window
    const finalDailyStartMins = dailyStartInMinutesArray.length
      ? Math.max(...dailyStartInMinutesArray)
      : 0; // Default to midnight if no availability
    const finalDailyEndMins = dailyEndInMinutesArray.length
      ? Math.min(...dailyEndInMinutesArray)
      : 23 * 60 + 59; // Default to 23:59 if no availability

    const dailyStartHour = Math.floor(finalDailyStartMins / 60);
    const dailyStartMinute = finalDailyStartMins % 60;
    const dailyEndHour = Math.floor(finalDailyEndMins / 60);
    const dailyEndMinute = finalDailyEndMins % 60;

    const commonDailyStart = moment.utc().set({
      hour: dailyStartHour,
      minute: dailyStartMinute,
      second: 0,
      millisecond: 0,
    });

    const commonDailyEnd = moment.utc().set({
      hour: dailyEndHour,
      minute: dailyEndMinute,
      second: 0,
      millisecond: 0,
    });

    // Step 6: Convert all outputs back to UTC
    const globalStartUTC = globalStartLocal.clone().utc();
    const globalEndUTC = globalEndLocal.clone().utc();
    const realStartUTC = realStartLocal.clone().utc();
    const realEndUTC = realEndLocal.clone().utc();

    // Check for overlap and set exit flag
    const hasOverlap = realEndLocal.isSameOrAfter(realStartLocal);

    // Return results
    return {
      globalStart: globalStartUTC.format("YYYY-MM-DDTHH:mm:ssZ"),
      globalEnd: globalEndUTC.format("YYYY-MM-DDTHH:mm:ssZ"),
      commonDailyStart: commonDailyStart.format("HH:mm"),
      commonDailyEnd: commonDailyEnd.format("HH:mm"),
      realStart: realStartUTC.format("YYYY-MM-DDTHH:mm:ssZ"),
      realEnd: realEndUTC.format("YYYY-MM-DDTHH:mm:ssZ"),
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
    availabilityList,
    blockedByUserList,
    modifiedSlots
  ) {
    if (!availabilityList || !Array.isArray(availabilityList)) {
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
    const outputlist9 = []; // Startup corners information

    availabilityList.forEach((availability) => {
      const startDate = moment.utc(availability.start_date).startOf("day");
      const endDate = moment.utc(availability.end_date).endOf("day");

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
            meetingLink: availability.meetingLink,
            Address: availability.Address,
            isModified: null,
            blockedByUser: false,
            isStartupCorners: availability.isStartupCorners,
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
              (slotStart.isSame(modifiedStart) &&
                slotEnd.isSame(modifiedEnd)) ||
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

  function checkAllMainUserAvailabilities(
    mainUserAvailabilities,
    mergedAlreadyBookedList
  ) {
    // We'll accumulate bubble IDs and boolean results in parallel arrays
    const outputlist1 = []; // bubble IDs
    const outputlist2 = []; // true/false

    // Loop over all main-user availabilities
    for (const availability of mainUserAvailabilities) {
      // If each availability has a bubbleid:
      const bubbleid = availability.bubbleid;

      // Check if there's at least one open slot
      const hasSlot = hasAnyOpenSlotForAvailability(
        availability,
        mergedAlreadyBookedList
      );

      // Append to our arrays
      outputlist1.push(bubbleid);
      outputlist2.push(hasSlot);
    }

    // Now call your Bubble function, passing the arrays
    bubble_fn_finalMainUserAvailabilityList({
      outputlist1,
      outputlist2,
      // If Bubble expects a third list, you can add outputlist3 here
    });

    // Finally, signal readiness
    setTimeout(() => bubble_fn_ready(), 3000);
  }


  function hasAnyOpenSlotForAvailability(availability, alreadyBookedList) {
    const {
      start_date,
      end_date,
      daily_start_time,
      daily_end_time,
      slot_duration_minutes,
      timeOffsetSeconds,
      excludedDays,
      earliestBookableDay = 0, // default if none provided
    } = availability;

    const startOfRange = moment.utc(start_date).startOf("day");
    const endOfRange = moment.utc(end_date).endOf("day");

    // If invalid date or start > end, just return false
    if (
      !startOfRange.isValid() ||
      !endOfRange.isValid() ||
      endOfRange.isBefore(startOfRange)
    ) {
      return false;
    }

    // Parse daily start/end times (e.g. "09:00" => 9,0)
    const [startHour, startMin] = daily_start_time.split(":").map(Number);
    const [endHour, endMin] = daily_end_time.split(":").map(Number);
    const duration = slot_duration_minutes || 60;

    // Earliest bookable cutoff
    const earliestBookableMoment = moment
      .utc()
      .add(earliestBookableDay, "days");

    // Loop day by day in [startOfRange, endOfRange]
    let currentDay = startOfRange.clone();
    while (currentDay.isSameOrBefore(endOfRange, "day")) {
      // Build the day's start/end within the user’s daily availability
      const dayStart = currentDay
        .clone()
        .set({ hour: startHour, minute: startMin, second: 0 });
      const dayEnd = currentDay
        .clone()
        .set({ hour: endHour, minute: endMin, second: 0 });

      // If daily end < daily start, assume it crosses midnight
      if (dayEnd.isBefore(dayStart)) {
        dayEnd.add(1, "day");
      }

      // Skip if no overlap with overall availability
      const actualDayStart = moment.max(dayStart, startOfRange);
      const actualDayEnd = moment.min(dayEnd, endOfRange);
      if (actualDayEnd.isBefore(actualDayStart)) {
        currentDay.add(1, "day");
        continue;
      }

      // Check excludedDays if provided
      let dayIsExcluded = false;
      if (
        excludedDays &&
        excludedDays.length > 0 &&
        typeof timeOffsetSeconds === "number"
      ) {
        const offsetInMinutes = timeOffsetSeconds / 60;
        const localDayStart = actualDayStart.clone().utcOffset(offsetInMinutes);
        const localDayNumber = localDayStart.day(); // 0=Sunday,...6=Saturday
        if (excludedDays.includes(localDayNumber)) {
          dayIsExcluded = true;
        }
      }

      if (!dayIsExcluded) {
        // Generate slot increments
        let slotStart = actualDayStart.clone();
        while (slotStart.isBefore(actualDayEnd)) {
          const slotEnd = slotStart.clone().add(duration, "minutes");
          if (slotEnd.isAfter(actualDayEnd)) {
            break;
          }

          // Earliest bookable check
          if (slotEnd.isBefore(earliestBookableMoment)) {
            slotStart = slotEnd;
            continue;
          }

          // Check if booked/blocked
          if (!isSlotOverlapped(slotStart, slotEnd, alreadyBookedList)) {
            // Found a slot that is not booked => free
            return true;
          }

          slotStart = slotEnd;
        }
      }

      // Move to next day
      currentDay.add(1, "day");
    }

    // If we reached here, no free slot was found
    return false;
  }

  /**
   * isSlotOverlapped
   *   Returns true if the given slot (slotStart, slotEnd) overlaps
   *   with *any* item in bookedList. Otherwise false.
   */
  function isSlotOverlapped(slotStart, slotEnd, bookedList) {
    if (!bookedList || bookedList.length === 0) return false;
    for (const booked of bookedList) {
      const bookedStart = moment.utc(booked.start_date);
      const bookedEnd = moment.utc(booked.end_date);

      if (
        slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
        slotEnd.isBetween(bookedStart, bookedEnd, null, "(]") ||
        bookedStart.isBetween(slotStart, slotEnd, null, "[)") ||
        bookedEnd.isBetween(slotStart, slotEnd, null, "(]")
      ) {
        return true; // Overlap found
      }
    }
    return false;
  }

  return {
    generateSlotsForWeek,
    checkAllMainUserAvailabilities,
  };
};

window["scheduleAppointments"] = scheduleAppointments;



