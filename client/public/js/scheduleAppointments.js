
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
    earliestBookableDay,
  ) {
    console.log("======== Function Start ========");
    console.log(
      "mainAvailabilityList:",
      JSON.stringify(mainAvailabilityList, null, 2)
    );
    console.log(
      "allAvailabilityLists:",
      JSON.stringify(allAvailabilityLists, null, 2)
    );
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
    console.log(
      "earliestBookableDay:",
      JSON.stringify(earliestBookableDay, null, 2)
    );

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

    console.log("globalStart:", globalStart);
    console.log("globalEnd:", globalEnd);
    console.log("commonDailyStart:", commonDailyStart);
    console.log("commonDailyEnd:", commonDailyEnd);

    // Generate day boundaries (always necessary)
    const outputlist6 = generateDayBoundaries(globalStart);
    console.log("Generated outputlist6 (Day Boundaries):", outputlist6);

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
      console.log("Overlap found. Generating remaining slot outputs...");

      // Generate weekly slots
      outputlist7 = generateWeeklySlots(
        globalStart,
        commonDailyStart,
        commonDailyEnd,
        slotDuration
      );
      console.log("Generated outputlist7 (All Weekly Slots):", outputlist7);

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
            .add(earliestBookableDay, "days");
          console.log(
            `Checking earliest bookable day (${earliestBookableDay} days ahead):`,
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
          let isExcluded = false;

          for (const availability of allAvailabilityLists) {
            const { timeOffsetSeconds, excludedDays } = availability || {};
            if (!timeOffsetSeconds || !excludedDays) {
              console.warn(
                "Skipping availability due to missing offset or excludedDays:",
                availability
              );
              continue;
            }

            // Convert the slot's UTC start to this availability's local time
            const offsetInMinutes = timeOffsetSeconds / 60;
            const localSlotStart = slotStart
              .clone()
              .utcOffset(offsetInMinutes, true);
            const localDay = localSlotStart.day();

            console.log("Availability being checked:", availability);
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
              isExcluded = true;
              break; // Stop checking further if any availability excludes this day
            }
          }

          if (isExcluded) {
            result = "excludedDay";
          }
        }

        console.log("Final slot result:", result);
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
    } else {
      console.warn("No overlap found. Skipping remaining slot generation.");
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

  function computeWeekRangeAndDailyIntersection(
    allAvailabilityLists,
    viewerStartDate,
    offset,
    userOffsetInSeconds
  ) {
    console.log("=== Function Start ===");
    console.log("Input - allAvailabilityLists:", allAvailabilityLists);
    console.log("Input - viewerStartDate:", viewerStartDate);
    console.log("Input - offset:", offset);
    console.log("Input - userOffsetInSeconds:", userOffsetInSeconds);

    const userOffsetInMinutes = userOffsetInSeconds / 60;
    console.log("Computed userOffsetInMinutes:", userOffsetInMinutes);

    // Step 1: Calculate viewer's start date for the given week in user timezone
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

    let overallEarliestStart = null;
    let overallLatestEnd = null;
    let dailyStartInMinutesArray = [];
    let dailyEndInMinutesArray = [];

    // Step 2: Parse each availability and compute overall earliest/latest dates
    allAvailabilityLists.forEach((availability, index) => {
      console.log(`Processing availability [${index}]:`, availability);

      const availabilityStart = moment.utc(availability.start_date);
      const availabilityEnd = moment.utc(availability.end_date);
      console.log(`Availability start_date (UTC):`, availabilityStart.format());
      console.log(`Availability end_date (UTC):`, availabilityEnd.format());

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

      console.log("Daily start (mins):", startHour * 60 + startMin);
      console.log("Daily end (mins):", endHour * 60 + endMin);
    });

    console.log("Overall earliest start:", overallEarliestStart?.format());
    console.log("Overall latest end:", overallLatestEnd?.format());
    console.log("Daily start times (mins):", dailyStartInMinutesArray);
    console.log("Daily end times (mins):", dailyEndInMinutesArray);

    // Step 3: Compute default global range for the week
    const globalStartLocal = viewerStartLocal.clone().startOf("day");
    const globalEndLocal = globalStartLocal.clone().add(6, "days").endOf("day");
    console.log("Global week start (local):", globalStartLocal.format());
    console.log("Global week end (local):", globalEndLocal.format());

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

    console.log("Real start (local):", realStartLocal.format());
    console.log("Real end (local):", realEndLocal.format());

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

    console.log("Final daily start (UTC):", commonDailyStart.format("HH:mm"));
    console.log("Final daily end (UTC):", commonDailyEnd.format("HH:mm"));

    // Step 6: Convert all outputs back to UTC
    const globalStartUTC = globalStartLocal.clone().utc();
    const globalEndUTC = globalEndLocal.clone().utc();
    const realStartUTC = realStartLocal.clone().utc();
    const realEndUTC = realEndLocal.clone().utc();

    console.log("Global start (UTC):", globalStartUTC.format());
    console.log("Global end (UTC):", globalEndUTC.format());
    console.log("Real start (UTC):", realStartUTC.format());
    console.log("Real end (UTC):", realEndUTC.format());

    // Check for overlap and set exit flag
    const hasOverlap = realEndLocal.isSameOrAfter(realStartLocal);
    console.log("Has overlap:", hasOverlap);

    // Return results
    console.log("=== Function End ===");
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
    availabilityList,
    blockedByUserList,
    modifiedSlots
  ) {
    console.log("Modified slots:", modifiedSlots);
    console.log("blockedByUserList:", blockedByUserList);
    console.log("outputlist7:", outputlist7);
    console.log("In assignSlotInfo, availabilityList:", availabilityList);
    console.log(
      "Array.isArray(availabilityList):",
      Array.isArray(availabilityList)
    );

    if (!availabilityList || !Array.isArray(availabilityList)) {
      console.error(
        "availabilityList is undefined or not an array:",
        availabilityList
      );
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
    generateSlotsForWeek,
    findOverlappingTimeRanges,
  };
};

window["scheduleAppointments"] = scheduleAppointments;



