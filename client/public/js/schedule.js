
export const schedule = async function () {
  function generateUniqueDates(inputList) {
    const availabilityList = inputList[0];
    const currentUserDate = inputList[1];
    const daysInAdvance = inputList[2];
    const excludeWeekendAndHolidays = inputList[3];

    console.log(availabilityList);
    console.log(currentUserDate);
    console.log(daysInAdvance);
    console.log(excludeWeekendAndHolidays);

    const uniqueDates = new Set();
    const currentMoment = moment.utc(currentUserDate);
    const minBookableDate = currentMoment
      .clone()
      .add(daysInAdvance, "days")
      .startOf("day");

    availabilityList.forEach((availability) => {
      // Start and end dates are already in UTC, no need for time zone conversion
      const startDate = moment.utc(availability.start_date).startOf("day");
      const endDate = moment.utc(availability.end_date).endOf("day");

      let currentDate = startDate.clone();

      while (currentDate.isSameOrBefore(endDate)) {
        let dailyStart = currentDate.clone().startOf("day");
        const currentDateStr = dailyStart
          .utc()
          .format("YYYY-MM-DDT00:00:00[Z]");
        const isHoliday =
          availability.holidays &&
          availability.holidays.includes(currentDateStr.split("T")[0]);
        const isWeekend = dailyStart.day() === 0 || dailyStart.day() === 6; // 0 = Sunday, 6 = Saturday

        if (dailyStart.isAfter(minBookableDate)) {
          if (excludeWeekendAndHolidays) {
            if (!isHoliday && !isWeekend) {
              uniqueDates.add(currentDateStr);
            }
          } else {
            uniqueDates.add(currentDateStr);
          }
        }

        currentDate.add(1, "days");
      }
    });

    console.log("uniquedatestart");
    console.log(Array.from(uniqueDates).sort());
    console.log("uniquedateend");
    bubble_fn_uniqueDatesBubble(Array.from(uniqueDates).sort());
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
    console.log("alreadyBookedList", alreadyBookedList);
    console.log("userOffsetInSeconds", userOffsetInSeconds);

    const userOffsetInMinutes = userOffsetInSeconds / 60;

    // Generate start date adjusted for user offset
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

    // Generate outputlist6 (day boundaries)
    const outputlist6 = generateDayBoundaries(startDateLocal);
    console.log("Generated outputlist6 (Day Boundaries):", outputlist6);

    // Determine common availability for all users
    let commonDailyStart = null;
    let commonDailyEnd = null;
    let slotDuration = null;

    allAvailabilityLists.forEach((availability) => {
      // Parse daily start and end times as local times relative to the start date
      const dailyStart = moment
        .utc(availability.start_date)
        .utcOffset(0) // Interpret start_date as UTC
        .startOf("day") // Reset to midnight of the start date
        .set({
          hour: parseInt(availability.daily_start_time.split(":")[0], 10),
          minute: parseInt(availability.daily_start_time.split(":")[1], 10),
        })
        .utcOffset(userOffsetInMinutes); // Convert to viewer's timezone

      const dailyEnd = moment
        .utc(availability.start_date)
        .utcOffset(0) // Interpret start_date as UTC
        .startOf("day") // Reset to midnight of the start date
        .set({
          hour: parseInt(availability.daily_end_time.split(":")[0], 10),
          minute: parseInt(availability.daily_end_time.split(":")[1], 10),
        })
        .utcOffset(userOffsetInMinutes); // Convert to viewer's timezone

      console.log("Converted Daily Start:", dailyStart.format());
      console.log("Converted Daily End:", dailyEnd.format());

      if (!commonDailyStart || dailyStart.isAfter(commonDailyStart)) {
        commonDailyStart = dailyStart;
      }
      if (!commonDailyEnd || dailyEnd.isBefore(commonDailyEnd)) {
        commonDailyEnd = dailyEnd;
      }
      slotDuration = availability.slot_duration_minutes;
    });



    if (!commonDailyStart || !commonDailyEnd || !slotDuration) {
      console.error("No overlapping availability found.");
      return emptyOutput();
    }

    console.log(
      "Common daily start time (Viewer's Local Time):",
      commonDailyStart.format("HH:mm")
    );
    console.log(
      "Common daily end time (Viewer's Local Time):",
      commonDailyEnd.format("HH:mm")
    );
    console.log("Slot duration (minutes):", slotDuration);

    // Generate outputlist7 (all weekly slots)
    const {
      filteredSlots: outputlist7,
      globalStart,
      globalEnd,
    } = generateWeeklySlots(
      startDateLocal,
      commonDailyStart.format("HH:mm"),
      commonDailyEnd.format("HH:mm"),
      slotDuration,
      userOffsetInSeconds,
      mainAvailabilityList
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

      console.log(
        `Checking Slot ${index}:`,
        slotStart.format(),
        "to",
        slotEnd.format()
      );

      const bookedBubbleIds = alreadyBookedList
        .filter((booked) => {
          const bookedStart = moment
            .utc(booked.start_date)
            .utcOffset(userOffsetInMinutes);
          const bookedEnd = moment
            .utc(booked.end_date)
            .utcOffset(userOffsetInMinutes);

          console.log(
            `  Against Booked: ${bookedStart.format()} to ${bookedEnd.format()}`
          );

          return (
            slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
            slotEnd.isBetween(bookedStart, bookedEnd, null, "(]") ||
            bookedStart.isBetween(slotStart, slotEnd, null, "[)") ||
            bookedEnd.isBetween(slotStart, slotEnd, null, "(]")
          );
        })
        .map((booked) => booked.bubbleId);

      console.log(`  Matched Bubble IDs: ${bookedBubbleIds}`);
      return bookedBubbleIds.length > 0 ? bookedBubbleIds.join("_") : null;
    });

    const outputlist5 = filterSlotsByAvailabilityRange(
      outputlist7,
      globalStart,
      globalEnd,
      userOffsetInSeconds
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
  userOffsetInSeconds,
  mainAvailabilityList
) {
  const userOffsetInMinutes = userOffsetInSeconds / 60;
  const outputlist7 = [];
  let globalStart = null;
  let globalEnd = null;

  const endDateLocal = startDateLocal.clone().add(7, "days").endOf("day");

  for (let i = 0; i < 7; i++) {
    const currentDayLocal = startDateLocal.clone().add(i, "days");

    // Calculate daily start and end times adjusted to user offset
    const dailyStartTime = currentDayLocal
      .clone()
      .set({
        hour: parseInt(baseDailyStart.split(":")[0], 10),
        minute: parseInt(baseDailyStart.split(":")[1], 10),
        second: 0,
        millisecond: 0,
      })
      .utcOffset(userOffsetInMinutes);

    const dailyEndTime = currentDayLocal
      .clone()
      .set({
        hour: parseInt(baseDailyEnd.split(":")[0], 10),
        minute: parseInt(baseDailyEnd.split(":")[1], 10),
        second: 0,
        millisecond: 0,
      })
      .utcOffset(userOffsetInMinutes);

    // Generate slots for this day
    const daySlots = generateSlotsForInterval(
      dailyStartTime,
      dailyEndTime,
      slotDuration
    );

    // Update global start and end times for main availability range
    daySlots.forEach((slot) => {
      const slotStart = moment.utc(slot[0]).utcOffset(userOffsetInMinutes);
      const slotEnd = moment.utc(slot[1]).utcOffset(userOffsetInMinutes);

      mainAvailabilityList.forEach((availability) => {
        const availabilityStart = moment
          .utc(availability.start_date)
          .utcOffset(userOffsetInMinutes);
        const availabilityEnd = moment
          .utc(availability.end_date)
          .utcOffset(userOffsetInMinutes);

        if (
          slotStart.isBetween(availabilityStart, availabilityEnd, null, "[)") &&
          slotEnd.isBetween(availabilityStart, availabilityEnd, null, "(]")
        ) {
          if (!globalStart) {
            globalStart = slotStart.clone();
          }
          globalEnd = slotEnd.clone();
        }
      });
    });

    outputlist7.push(...daySlots);
  }

  console.log("Generated Global Start:", globalStart?.format());
  console.log("Generated Global End:", globalEnd?.format());

  return { filteredSlots: outputlist7, globalStart, globalEnd };
}

function generateSlotsForInterval(startTimeLocal, endTimeLocal, duration) {
  const result = [];
  let current = startTimeLocal.clone();

  while (current.isBefore(endTimeLocal)) {
    const slotEnd = current.clone().add(duration, "minutes");
    result.push([current.format(), slotEnd.format()]);
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

          // Check against blocked by user slots
          console.log("blockedByUserList before forEach:", blockedByUserList);

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
    generateUniqueDates,
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