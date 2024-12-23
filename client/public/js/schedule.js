
export const schedule = async function () {
  //   function generateUniqueDates(inputList) {
  //     const availabilityList = inputList[0];
  //     const currentUserDate = inputList[1];
  //     const daysInAdvance = inputList[2];
  //     const excludeWeekendAndHolidays = inputList[3];

  //     console.log(availabilityList);
  //     console.log(currentUserDate);
  //     console.log(daysInAdvance);
  //     console.log(excludeWeekendAndHolidays);

  //     const uniqueDates = new Set();
  //     const currentMoment = moment.utc(currentUserDate);
  //     const minBookableDate = currentMoment
  //       .clone()
  //       .add(daysInAdvance, "days")
  //       .startOf("day");

  //     availabilityList.forEach((availability) => {
  //       // Start and end dates are already in UTC, no need for time zone conversion
  //       const startDate = moment.utc(availability.start_date).startOf("day");
  //       const endDate = moment.utc(availability.end_date).endOf("day");

  //       let currentDate = startDate.clone();

  //       while (currentDate.isSameOrBefore(endDate)) {
  //         let dailyStart = currentDate.clone().startOf("day");
  //         const currentDateStr = dailyStart
  //           .utc()
  //           .format("YYYY-MM-DDT00:00:00[Z]");
  //         const isHoliday =
  //           availability.holidays &&
  //           availability.holidays.includes(currentDateStr.split("T")[0]);
  //         const isWeekend = dailyStart.day() === 0 || dailyStart.day() === 6; // 0 = Sunday, 6 = Saturday

  //         if (dailyStart.isAfter(minBookableDate)) {
  //           if (excludeWeekendAndHolidays) {
  //             if (!isHoliday && !isWeekend) {
  //               uniqueDates.add(currentDateStr);
  //             }
  //           } else {
  //             uniqueDates.add(currentDateStr);
  //           }
  //         }

  //         currentDate.add(1, "days");
  //       }
  //     });

  //     console.log("uniquedatestart");
  //     console.log(Array.from(uniqueDates).sort());
  //     console.log("uniquedateend");
  //     bubble_fn_uniqueDatesBubble(Array.from(uniqueDates).sort());
  //   }

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
    mainAvailabilityList,
    allAvailabilityLists,
    viewerStartDate,
    alreadyBookedList,
    modifiedSlots,
    offset = 0,
    userOffsetInSeconds = 0,
    blockedByUserList
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
      const result = generateWeeklySlots(
        globalStart,
        commonDailyStart,
        commonDailyEnd,
        slotDuration
      );
      outputlist7 = result.outputlist7;
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

        return bookedBubbleIds.length > 0 ? bookedBubbleIds.join("_") : null;
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
    const userOffsetInMinutes = userOffsetInSeconds / 60;

    // Step 1: Calculate viewer's start date for the given week in user timezone
    const viewerStartLocal = moment
      .utc(viewerStartDate)
      .utcOffset(userOffsetInMinutes)
      .startOf("day")
      .add(offset * 7, "days");

    if (!viewerStartLocal.isValid()) {
      console.error("Invalid viewerStartDate:", viewerStartDate);
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




  function generateWeeklySlots(globalStartStr, commonDailyStartStr, commonDailyEndStr, slotDuration) {
  const globalStart = moment.parseZone(globalStartStr);
  const [startHour, startMinute] = commonDailyStartStr.split(":").map(Number);
  const [endHour, endMinute] = commonDailyEndStr.split(":").map(Number);

  const outputlist7 = [];

  // Calculate total slots per day
  const totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const slotsPerDay = Math.floor(totalMinutes / slotDuration);

  // Generate base slots for the first day
  let currentSlotStart = globalStart.clone().set({
    hour: startHour,
    minute: startMinute,
    second: 0,
    millisecond: 0,
  });

  // Adjust the first slot start to align with globalStart
  if (currentSlotStart.isBefore(globalStart)) {
    while (currentSlotStart.isBefore(globalStart)) {
      currentSlotStart.add(slotDuration, "minutes");
    }
  }

  for (let i = 0; i < slotsPerDay; i++) {
    const slotEnd = currentSlotStart.clone().add(slotDuration, "minutes");
    outputlist7.push([
      currentSlotStart.format("YYYY-MM-DDTHH:mm:ssZ"),
      slotEnd.format("YYYY-MM-DDTHH:mm:ssZ"),
    ]);
    currentSlotStart.add(slotDuration, "minutes");
  }

  // Generate slots for the remaining days by adding 1 day
  const baseSlots = [...outputlist7];
  for (let day = 1; day < 7; day++) {
    baseSlots.forEach(([start, end]) => {
      outputlist7.push([
        moment.parseZone(start).add(day, "days").format("YYYY-MM-DDTHH:mm:ssZ"),
        moment.parseZone(end).add(day, "days").format("YYYY-MM-DDTHH:mm:ssZ"),
      ]);
    });
  }

  return { outputlist7 };
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

    return finalOutputList1;
  }

  return {
    // generateUniqueDates,
    generateStartTimes,
    generateEndTimes,
    generateSlotsForWeek,
    findOverlappingTimeRanges,
  };
};

window["schedule"] = schedule;




// function generateSlotsForDate(
//   availabilityList,
//   viewerDate,
//   viewerTimeZone,
//   alreadyBookedList,
//   modifiedSlots
// ) {
//   console.log(
//     "Received availabilityList:",
//     JSON.stringify(availabilityList, null, 2)
//   );
//   console.log("Received viewerDate:", viewerDate);
//   console.log("Received viewerTimeZone:", viewerTimeZone);
//   console.log(
//     "Received alreadyBookedList:",
//     JSON.stringify(alreadyBookedList, null, 2)
//   );
//   console.log(
//     "Received modifiedSlots:",
//     JSON.stringify(modifiedSlots, null, 2)
//   );

//   if (!Array.isArray(availabilityList)) {
//     console.error("availabilityList should be an array");
//     return {
//       outputlist1: [],
//       outputlist2: [],
//       outputlist3: [],
//       outputlist4: [],
//       outputlist5: [],
//     };
//   }

//   const outputlist1 = [];
//   const outputlist2 = [];
//   const outputlist3 = [];
//   const outputlist4 = [];
//   const outputlist5 = [];

//   // Parse viewerDate in viewer's timezone and define local boundaries
//   const viewerDateLocal = moment.tz(viewerDate, viewerTimeZone).startOf("day");
//   if (!viewerDateLocal.isValid()) {
//     console.error("Invalid viewerDate:", viewerDate);
//     return {
//       outputlist1: [],
//       outputlist2: [],
//       outputlist3: [],
//       outputlist4: [],
//       outputlist5: [],
//     };
//   }

//   // Local day start: e.g. 2024-12-15T00:00:00 local time
//   const localDayStart = viewerDateLocal.clone();
//   // Local day end: use the start of the next day (not endOf('day')) for a clean boundary
//   // e.g. 2024-12-16T00:00:00 local time
//   const localDayEnd = viewerDateLocal.clone().add(1, "day").startOf("day");

//   // Convert local day start to UTC day reference
//   const viewerDateUTC = viewerDateLocal.clone().utc();
//   const viewerNextDateUTC = viewerDateUTC.clone().add(1, "day");

//   availabilityList.forEach((availability) => {
//     const startDate = moment.utc(availability.start_date).startOf("day");
//     const endDate = moment.utc(availability.end_date).endOf("day");

//     // Check if either current or next UTC date intersects availability
//     const includesCurrentDateUTC = viewerDateUTC.isBetween(
//       startDate,
//       endDate,
//       "day",
//       "[]"
//     );
//     const includesNextDateUTC = viewerNextDateUTC.isBetween(
//       startDate,
//       endDate,
//       "day",
//       "[]"
//     );

//     if (!includesCurrentDateUTC && !includesNextDateUTC) {
//       return;
//     }

//     function generateDailySlotsForUTCDate(utcDate) {
//       const dailyStartTimeUTC = moment.utc(
//         utcDate.format("YYYY-MM-DD") + " " + availability.daily_start_time,
//         "YYYY-MM-DD HH:mm"
//       );
//       const dailyEndTimeUTC = moment.utc(
//         utcDate.format("YYYY-MM-DD") + " " + availability.daily_end_time,
//         "YYYY-MM-DD HH:mm"
//       );

//       const dailyStartTimeViewer = dailyStartTimeUTC.clone().tz(viewerTimeZone);
//       const dailyEndTimeViewer = dailyEndTimeUTC.clone().tz(viewerTimeZone);

//       let currentTime = dailyStartTimeViewer.clone();
//       while (currentTime.isBefore(dailyEndTimeViewer)) {
//         const startSlot = currentTime.clone();
//         const endSlot = startSlot
//           .clone()
//           .add(availability.slot_duration_minutes, "minutes");

//         // If slot would surpass daily end time, break
//         if (endSlot.isAfter(dailyEndTimeViewer)) break;

//         // Ensure the slot falls fully within the local requested day [localDayStart, localDayEnd)
//         // Since localDayEnd is midnight of the next day, a slot ending exactly at localDayEnd is allowed.
//         if (startSlot.isBefore(localDayStart) || endSlot.isAfter(localDayEnd)) {
//           currentTime.add(availability.slot_duration_minutes, "minutes");
//           continue;
//         }

//         const formattedStartSlotUTC = startSlot
//           .clone()
//           .utc()
//           .format("YYYY-MM-DDTHH:mm:ss[Z]");
//         const formattedEndSlotUTC = endSlot
//           .clone()
//           .utc()
//           .format("YYYY-MM-DDTHH:mm:ss[Z]");

//         let slotInfo = {
//           slotTimeRange: [formattedStartSlotUTC, formattedEndSlotUTC],
//           meetingLink: availability.meetingLink,
//           Address: availability.Address,
//           alreadyBooked: false,
//           isModified: false,
//         };

//         // Check booked slots
//         alreadyBookedList.forEach((bookedSlot) => {
//           const bookedStartDate = moment.utc(bookedSlot.start_date);
//           const bookedEndDate = moment.utc(bookedSlot.end_date);
//           if (
//             (startSlot.isSame(bookedStartDate) &&
//               endSlot.isSame(bookedEndDate)) ||
//             (startSlot.isBefore(bookedEndDate) &&
//               endSlot.isAfter(bookedStartDate))
//           ) {
//             slotInfo.alreadyBooked = true;
//           }
//         });

//         // Check modified slots
//         modifiedSlots.forEach((modifiedSlot) => {
//           const modifiedStartDate = moment.utc(modifiedSlot.start_date);
//           const modifiedEndDate = moment.utc(modifiedSlot.end_date);
//           if (
//             (startSlot.isSame(modifiedStartDate) &&
//               endSlot.isSame(modifiedEndDate)) ||
//             (startSlot.isBefore(modifiedEndDate) &&
//               endSlot.isAfter(modifiedStartDate))
//           ) {
//             slotInfo = {
//               ...slotInfo,
//               meetingLink: modifiedSlot.meetingLink,
//               Address: modifiedSlot.Address,
//               isModified: true,
//             };
//           }
//         });

//         outputlist1.push(slotInfo.meetingLink);
//         outputlist2.push(slotInfo.Address);
//         outputlist3.push(slotInfo.alreadyBooked);
//         outputlist4.push(slotInfo.isModified);
//         outputlist5.push(slotInfo.slotTimeRange);

//         currentTime.add(availability.slot_duration_minutes, "minutes");
//       }
//     }

//     if (includesCurrentDateUTC) {
//       generateDailySlotsForUTCDate(viewerDateUTC);
//     }
//     if (includesNextDateUTC) {
//       generateDailySlotsForUTCDate(viewerNextDateUTC);
//     }
//   });

//   console.log("Generated outputlist1:", JSON.stringify(outputlist1, null, 2));
//   console.log("Generated outputlist2:", JSON.stringify(outputlist2, null, 2));
//   console.log("Generated outputlist3:", JSON.stringify(outputlist3, null, 2));
//   console.log("Generated outputlist4:", JSON.stringify(outputlist4, null, 2));
//   console.log("Generated outputlist5:", JSON.stringify(outputlist5, null, 2));

//   bubble_fn_hours({
//     outputlist1: outputlist1,
//     outputlist2: outputlist2,
//     outputlist3: outputlist3,
//     outputlist4: outputlist4,
//     outputlist5: outputlist5,
//   });
// }

// function getDaysInMonth(dateString, timezone) {
//   // Parse the date string in the given timezone
//   console.log("dateString", dateString);
//   console.log("timezone", timezone);
//   const date = moment.tz(dateString, timezone);
//   const days = [];

//   // Get the first and last days of the month in the given timezone
//   const firstDayOfMonth = date.clone().startOf("month");
//   const lastDayOfMonth = date.clone().endOf("month");

//   // Adjusting the start day of the week (Sunday)
//   const startDayOfWeek = firstDayOfMonth.day();

//   // Fill in the days before the first day of the month
//   for (let i = 0; i < startDayOfWeek; i++) {
//     const day = firstDayOfMonth
//       .clone()
//       .subtract(startDayOfWeek - i, "days")
//       .tz(timezone)
//       .toDate();
//     days.push(day);
//   }

//   // Fill in the days of the month
//   for (
//     let d = firstDayOfMonth.clone();
//     d.isSameOrBefore(lastDayOfMonth, "day");
//     d.add(1, "day")
//   ) {
//     const day = d.tz(timezone).toDate();
//     days.push(day);
//   }

//   // Adjusting the end day of the week (Saturday)
//   const endDayOfWeek = lastDayOfMonth.day();

//   // Fill in the days after the last day of the month to complete the week
//   for (let i = 1; i <= 6 - endDayOfWeek; i++) {
//     const day = lastDayOfMonth.clone().add(i, "days").tz(timezone).toDate();
//     days.push(day);
//   }

//   // Ensure the days array length is a multiple of 7 (to complete the calendar grid)
//   while (days.length % 7 !== 0) {
//     const lastDay = days[days.length - 1];
//     const day = moment(lastDay).clone().add(1, "day").tz(timezone).toDate();
//     days.push(day);
//   }

//   console.log(days);
//   bubble_fn_daysInMonth(days);
// }