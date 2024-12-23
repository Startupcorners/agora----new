
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
    console.log("endtimes", times)
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
    console.log("allAvailabilityLists", allAvailabilityLists);
    console.log("mainAvailabilityList", mainAvailabilityList);
    console.log("alreadyBookedList", alreadyBookedList);
    console.log("userOffsetInSeconds", userOffsetInSeconds);

    const slotDuration = mainAvailabilityList[0].slot_duration_minutes;

     const {
       globalStart,
       globalEnd,
       commonDailyStart,
       commonDailyEnd,
       } = computeWeekRangeAndDailyIntersection(
       allAvailabilityLists,
       viewerStartDate,
       offset,
       userOffsetInSeconds,
     );

     console.log("globalStart", globalStart);
     console.log("globalEnd", globalEnd);
     console.log("commonDailyStart", commonDailyStart);
     console.log("commonDailyEnd", commonDailyEnd);

    // Generate outputlist6 (day boundaries)
    const outputlist6 = generateDayBoundaries(globalStart);
    console.log("Generated outputlist6 (Day Boundaries):", outputlist6);


    // Generate outputlist7 (all weekly slots)
    const { outputlist7 } = generateWeeklySlots(
      globalStart,
      globalEnd,
      commonDailyStart,
      commonDailyEnd,
      slotDuration,
    );

    console.log("Generated outputlist7 (All Weekly Slots):", outputlist7);

    // Assign slot information (excluding outputlist3)
    const { outputlist1, outputlist2, outputlist4, outputlist8, outputlist9 } =
      assignSlotInfo(
        outputlist7,
        mainAvailabilityList,
        userOffsetInSeconds,
        blockedByUserList,
        modifiedSlots
      );

    // Generate outputlist3 (all booked slots)
    const outputlist3 = outputlist7.map((slot, index) => {
      const slotStart = moment(slot[0]).utcOffset(userOffsetInMinutes);
      const slotEnd = moment(slot[1]).utcOffset(userOffsetInMinutes);

      const bookedBubbleIds = alreadyBookedList
        .filter((booked) => {
          const bookedStart = moment
            .utc(booked.start_date)
            .utcOffset(userOffsetInMinutes);
          const bookedEnd = moment
            .utc(booked.end_date)
            .utcOffset(userOffsetInMinutes);

          return (
            slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
            slotEnd.isBetween(bookedStart, bookedEnd, null, "(]") ||
            bookedStart.isBetween(slotStart, slotEnd, null, "[)") ||
            bookedEnd.isBetween(slotStart, slotEnd, null, "(]")
          );
        })
        .map((booked) => booked.bubbleId);
      return bookedBubbleIds.length > 0 ? bookedBubbleIds.join("_") : null;
    });


    const outputlist5 = filterSlotsByAvailabilityRange(
      outputlist7,
      commonDailyStart,
      commonDailyEnd,
    );


    // Final output object
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
    };

    console.log("Final output:", result);
    console.log("======== Function End ========");

    // Send the result to Bubble
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

    setTimeout(() => {
      bubble_fn_ready();
    }, 3000);

    return result;
  }


  function computeWeekRangeAndDailyIntersection(
  allAvailabilityLists,
  viewerStartDate,
  offset,
  userOffsetInSeconds
) {
  const userOffsetInMinutes = userOffsetInSeconds / 60;

  // 1) Convert viewerStartDate -> local midnight -> shift by `offset` weeks
  const viewerStartLocal = moment
    .utc(viewerStartDate)
    .utcOffset(userOffsetInMinutes)
    .startOf("day")
    .add(offset * 7, "days");

  // If you truly trust the date is valid, you can skip this check
  if (!viewerStartLocal.isValid()) {
    console.error("Invalid viewerStartDate:", viewerStartDate);
    return { error: "Invalid start date" };
  }

  // 2) We'll find the combined date range + daily window:
  //    - overallEarliestStart = MAX of all start dates
  //    - overallLatestEnd     = MIN of all end dates
  //    - dailyStartInMinutes  = MAX of all daily_start_time (HH:mm)
  //    - dailyEndInMinutes    = MIN of all daily_end_time   (HH:mm)
  let overallEarliestStart = null;
  let overallLatestEnd = null;

  let dailyStartInMinutesArray = [];
  let dailyEndInMinutesArray = [];

  // 3) Parse each availability
  allAvailabilityLists.forEach((availability) => {
    // Convert start_date / end_date to local time
    const availabilityStart = moment
      .utc(availability.start_date)
      .utcOffset(userOffsetInMinutes);
    const availabilityEnd = moment
      .utc(availability.end_date)
      .utcOffset(userOffsetInMinutes);

    // Update overallEarliestStart
    if (!overallEarliestStart) {
      overallEarliestStart = availabilityStart.clone();
    } else if (availabilityStart.isAfter(overallEarliestStart)) {
      overallEarliestStart = availabilityStart.clone();
    }

    // Update overallLatestEnd
    if (!overallLatestEnd) {
      overallLatestEnd = availabilityEnd.clone();
    } else if (availabilityEnd.isBefore(overallLatestEnd)) {
      overallLatestEnd = availabilityEnd.clone();
    }

    // Convert daily_start_time / daily_end_time to numeric minutes
    const [startHour, startMin] = availability.daily_start_time.split(":").map(Number);
    const [endHour, endMin] = availability.daily_end_time.split(":").map(Number);

    dailyStartInMinutesArray.push(startHour * 60 + startMin);
    dailyEndInMinutesArray.push(endHour * 60 + endMin);
  });

  // If you truly know there's always overlap, you could skip these checks
  if (!overallEarliestStart || !overallLatestEnd) {
    console.error("No valid availability range found.");
    return { error: "No availability data" };
  }

  // 4) Compute final daily intersection
  const finalDailyStartMins = Math.max(...dailyStartInMinutesArray);
  const finalDailyEndMins = Math.min(...dailyEndInMinutesArray);

  // 5) Build commonDailyStart / commonDailyEnd as times-of-day
  const dailyStartHour = Math.floor(finalDailyStartMins / 60);
  const dailyStartMinute = finalDailyStartMins % 60;
  const dailyEndHour = Math.floor(finalDailyEndMins / 60);
  const dailyEndMinute = finalDailyEndMins % 60;

  const commonDailyStart = moment().set({
    hour: dailyStartHour,
    minute: dailyStartMinute,
    second: 0,
    millisecond: 0,
  });
  const commonDailyEnd = moment().set({
    hour: dailyEndHour,
    minute: dailyEndMinute,
    second: 0,
    millisecond: 0,
  });

  // 6) Our final "global" start is the max of (viewerStartLocal, overallEarliestStart)
  const globalStartDate = moment.max(viewerStartLocal, overallEarliestStart);

  // 7) For a 7-day window from globalStartDate, but not exceeding overallLatestEnd
  const sevenDaysLater = globalStartDate.clone().add(6, "days").endOf("day");
  const globalEndDate = moment.min(sevenDaysLater, overallLatestEnd);

  // Optionally skip the overlap check if you're sure there's always some
  if (globalEndDate.isBefore(globalStartDate)) {
    console.error("No overlap once we clamp to 7 days or overallLatestEnd.");
    return { error: "No final overlap" };
  }
    // 10) Return final results
    return {
      globalStart: globalStartDate
        .clone()
        .utcOffset(userOffsetInMinutes)
        .format("YYYY-MM-DDTHH:mm:ssZ"),
      globalEnd: globalEndDate
        .clone()
        .utcOffset(userOffsetInMinutes)
        .format("YYYY-MM-DDTHH:mm:ssZ"),
      commonDailyStart: commonDailyStart.format("HH:mm"),
      commonDailyEnd: commonDailyEnd.format("HH:mm"),
    };

  }




  function generateDayBoundaries(globalStartStr, totalDays = 7) {
    // Parse the incoming string (which includes offset)
    const globalStart = moment(globalStartStr, "YYYY-MM-DDTHH:mm:ssZ");

    const outputlist6 = [];
    for (let i = 0; i < totalDays; i++) {
      // dayStart: local midnight of day i
      const dayStart = globalStart.clone().add(i, "days").startOf("day");

      // dayEnd: 23:59 on that same day, preserving offset
      const dayEnd = dayStart.clone().set({
        hour: 23,
        minute: 59,
        second: 0,
        millisecond: 0,
      });

      // Format them with offset in ISO8601
      outputlist6.push([
        dayStart.format("YYYY-MM-DDTHH:mmZ"),
        dayEnd.format("YYYY-MM-DDTHH:mmZ"),
      ]);
    }
    return outputlist6;
  }


function generateWeeklySlots(
  globalStartStr, // e.g. "2024-12-23T00:00-11:00"
  globalEndStr, // The end of your 7-day window (local time)
  commonDailyStart, // A Moment object representing the daily start time (only .hours() / .minutes() matter)
  commonDailyEnd, // A Moment object representing the daily end time
  slotDuration // Slot length in minutes
) {
  const outputlist7 = [];

  const globalStart = moment(globalStartStr, "YYYY-MM-DDTHH:mm:ssZ");
  const globalEnd = moment(globalEndStr, "YYYY-MM-DDTHH:mm:ssZ");

  // Determine how many days are in your globalStart -> globalEnd range.
  // Typically 7, but let's compute dynamically in case you are doing +/- offset logic.
  const totalDays = Math.ceil(globalEnd.diff(globalStart, "days", true));
  console.log(
    `Generating up to ${totalDays} days of slots from ${globalStart.format()} to ${globalEnd.format()}`
  );

  for (let i = 0; i < totalDays; i++) {
    // 1) Current day in local time
    const currentDayLocal = globalStart.clone().add(i, "days");
    if (currentDayLocal.isAfter(globalEnd, "day")) {
      // If we’ve gone past globalEnd, stop
      break;
    }

    // 2) For this day, build dailyStartTime / dailyEndTime
    const dailyStartTime = currentDayLocal.clone().set({
      hour: commonDailyStart.hours(),
      minute: commonDailyStart.minutes(),
      second: 0,
      millisecond: 0,
    });

    const dailyEndTime = currentDayLocal.clone().set({
      hour: commonDailyEnd.hours(),
      minute: commonDailyEnd.minutes(),
      second: 0,
      millisecond: 0,
    });

    // Ensure we're not going beyond globalEnd on this day
    if (dailyEndTime.isAfter(globalEnd)) {
      dailyEndTime.endOf("day").min(globalEnd);
    }

    // If daily end is <= daily start, skip (no valid time range)
    if (!dailyEndTime.isAfter(dailyStartTime)) {
      continue;
    }

    // 3) Generate slots for this day
    const daySlots = generateSlotsForInterval(
      dailyStartTime,
      dailyEndTime,
      slotDuration
    );

    // 4) Add them to outputlist7
    outputlist7.push(...daySlots);
  }

  return { outputlist7 };
}


function generateSlotsForInterval(startTimeLocal, endTimeLocal, duration) {
  const result = [];
  let current = startTimeLocal.clone();

  while (current.isBefore(endTimeLocal)) {
    const slotEnd = current.clone().add(duration, "minutes");
    if (slotEnd.isAfter(endTimeLocal)) {
      break;
    }
    result.push([current.toISOString(), slotEnd.toISOString()]);
    current.add(duration, "minutes");
  }

  return result;
}




  function assignSlotInfo(
    outputlist7,
    availabilityList,
    userOffsetInSeconds,
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
    const userOffsetInMinutes = userOffsetInSeconds / 60;

    const outputlist1 = []; // Meeting links
    const outputlist2 = []; // Addresses
    const outputlist4 = []; // Modified slot information
    const outputlist8 = []; // Blocked by user
    const outputlist9 = []; // Startup corners information

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
        const slotStart = moment
          .utc(slotRange[0])
          .utcOffset(userOffsetInMinutes);
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
            isModified: null,
            blockedByUser: false,
            isStartupCorners: availability.isStartupCorners,
          };


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




  function filterSlotsByAvailabilityRange(
    allSlots,
    globalStart,
    globalEnd,
    userOffsetInSeconds
  ) {
    const userOffsetInMinutes = userOffsetInSeconds / 60;
    const outputlist5 = [];
    console.log(allSlots, globalStart, globalEnd, userOffsetInSeconds);

    if (globalStart && globalEnd) {
      allSlots.forEach((slotRange) => {
        const slotStart = moment
          .utc(slotRange[0])
          .utcOffset(userOffsetInMinutes);
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
      console.error("Invalid availability object: missing bubbleid or userid.");
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