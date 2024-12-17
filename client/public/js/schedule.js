
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
      const currentDateStr = dailyStart.utc().format("YYYY-MM-DDT00:00:00[Z]");
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


function generateSlotsForDate(
  availabilityList,
  viewerDate,
  viewerTimeZone,
  alreadyBookedList,
  modifiedSlots
) {
  console.log(
    "Received availabilityList:",
    JSON.stringify(availabilityList, null, 2)
  );
  console.log("Received viewerDate:", viewerDate);
  console.log("Received viewerTimeZone:", viewerTimeZone);
  console.log(
    "Received alreadyBookedList:",
    JSON.stringify(alreadyBookedList, null, 2)
  );
  console.log(
    "Received modifiedSlots:",
    JSON.stringify(modifiedSlots, null, 2)
  );

  if (!Array.isArray(availabilityList)) {
    console.error("availabilityList should be an array");
    return {
      outputlist1: [],
      outputlist2: [],
      outputlist3: [],
      outputlist4: [],
      outputlist5: [],
    };
  }

  const outputlist1 = [];
  const outputlist2 = [];
  const outputlist3 = [];
  const outputlist4 = [];
  const outputlist5 = [];

  // Parse viewerDate in viewer's timezone and define local boundaries
  const viewerDateLocal = moment.tz(viewerDate, viewerTimeZone).startOf("day");
  if (!viewerDateLocal.isValid()) {
    console.error("Invalid viewerDate:", viewerDate);
    return {
      outputlist1: [],
      outputlist2: [],
      outputlist3: [],
      outputlist4: [],
      outputlist5: [],
    };
  }

  // Local day start: e.g. 2024-12-15T00:00:00 local time
  const localDayStart = viewerDateLocal.clone();
  // Local day end: use the start of the next day (not endOf('day')) for a clean boundary
  // e.g. 2024-12-16T00:00:00 local time
  const localDayEnd = viewerDateLocal.clone().add(1, "day").startOf("day");

  // Convert local day start to UTC day reference
  const viewerDateUTC = viewerDateLocal.clone().utc();
  const viewerNextDateUTC = viewerDateUTC.clone().add(1, "day");

  availabilityList.forEach((availability) => {
    const startDate = moment.utc(availability.start_date).startOf("day");
    const endDate = moment.utc(availability.end_date).endOf("day");

    // Check if either current or next UTC date intersects availability
    const includesCurrentDateUTC = viewerDateUTC.isBetween(
      startDate,
      endDate,
      "day",
      "[]"
    );
    const includesNextDateUTC = viewerNextDateUTC.isBetween(
      startDate,
      endDate,
      "day",
      "[]"
    );

    if (!includesCurrentDateUTC && !includesNextDateUTC) {
      return;
    }

    function generateDailySlotsForUTCDate(utcDate) {
      const dailyStartTimeUTC = moment.utc(
        utcDate.format("YYYY-MM-DD") + " " + availability.daily_start_time,
        "YYYY-MM-DD HH:mm"
      );
      const dailyEndTimeUTC = moment.utc(
        utcDate.format("YYYY-MM-DD") + " " + availability.daily_end_time,
        "YYYY-MM-DD HH:mm"
      );

      const dailyStartTimeViewer = dailyStartTimeUTC.clone().tz(viewerTimeZone);
      const dailyEndTimeViewer = dailyEndTimeUTC.clone().tz(viewerTimeZone);

      let currentTime = dailyStartTimeViewer.clone();
      while (currentTime.isBefore(dailyEndTimeViewer)) {
        const startSlot = currentTime.clone();
        const endSlot = startSlot
          .clone()
          .add(availability.slot_duration_minutes, "minutes");

        // If slot would surpass daily end time, break
        if (endSlot.isAfter(dailyEndTimeViewer)) break;

        // Ensure the slot falls fully within the local requested day [localDayStart, localDayEnd)
        // Since localDayEnd is midnight of the next day, a slot ending exactly at localDayEnd is allowed.
        if (startSlot.isBefore(localDayStart) || endSlot.isAfter(localDayEnd)) {
          currentTime.add(availability.slot_duration_minutes, "minutes");
          continue;
        }

        const formattedStartSlotUTC = startSlot
          .clone()
          .utc()
          .format("YYYY-MM-DDTHH:mm:ss[Z]");
        const formattedEndSlotUTC = endSlot
          .clone()
          .utc()
          .format("YYYY-MM-DDTHH:mm:ss[Z]");

        let slotInfo = {
          slotTimeRange: [formattedStartSlotUTC, formattedEndSlotUTC],
          meetingLink: availability.meetingLink,
          Address: availability.Address,
          alreadyBooked: false,
          isModified: false,
        };

        // Check booked slots
        alreadyBookedList.forEach((bookedSlot) => {
          const bookedStartDate = moment.utc(bookedSlot.start_date);
          const bookedEndDate = moment.utc(bookedSlot.end_date);
          if (
            (startSlot.isSame(bookedStartDate) &&
              endSlot.isSame(bookedEndDate)) ||
            (startSlot.isBefore(bookedEndDate) &&
              endSlot.isAfter(bookedStartDate))
          ) {
            slotInfo.alreadyBooked = true;
          }
        });

        // Check modified slots
        modifiedSlots.forEach((modifiedSlot) => {
          const modifiedStartDate = moment.utc(modifiedSlot.start_date);
          const modifiedEndDate = moment.utc(modifiedSlot.end_date);
          if (
            (startSlot.isSame(modifiedStartDate) &&
              endSlot.isSame(modifiedEndDate)) ||
            (startSlot.isBefore(modifiedEndDate) &&
              endSlot.isAfter(modifiedStartDate))
          ) {
            slotInfo = {
              ...slotInfo,
              meetingLink: modifiedSlot.meetingLink,
              Address: modifiedSlot.Address,
              isModified: true,
            };
          }
        });

        outputlist1.push(slotInfo.meetingLink);
        outputlist2.push(slotInfo.Address);
        outputlist3.push(slotInfo.alreadyBooked);
        outputlist4.push(slotInfo.isModified);
        outputlist5.push(slotInfo.slotTimeRange);

        currentTime.add(availability.slot_duration_minutes, "minutes");
      }
    }

    if (includesCurrentDateUTC) {
      generateDailySlotsForUTCDate(viewerDateUTC);
    }
    if (includesNextDateUTC) {
      generateDailySlotsForUTCDate(viewerNextDateUTC);
    }
  });

  console.log("Generated outputlist1:", JSON.stringify(outputlist1, null, 2));
  console.log("Generated outputlist2:", JSON.stringify(outputlist2, null, 2));
  console.log("Generated outputlist3:", JSON.stringify(outputlist3, null, 2));
  console.log("Generated outputlist4:", JSON.stringify(outputlist4, null, 2));
  console.log("Generated outputlist5:", JSON.stringify(outputlist5, null, 2));

  bubble_fn_hours({
    outputlist1: outputlist1,
    outputlist2: outputlist2,
    outputlist3: outputlist3,
    outputlist4: outputlist4,
    outputlist5: outputlist5,
  });
}







  function getDaysInMonth(dateString, timezone) {
    // Parse the date string in the given timezone
    console.log("dateString", dateString);
    console.log("timezone", timezone);
    const date = moment.tz(dateString, timezone);
    const days = [];

    // Get the first and last days of the month in the given timezone
    const firstDayOfMonth = date.clone().startOf("month");
    const lastDayOfMonth = date.clone().endOf("month");

    // Adjusting the start day of the week (Sunday)
    const startDayOfWeek = firstDayOfMonth.day();

    // Fill in the days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      const day = firstDayOfMonth
        .clone()
        .subtract(startDayOfWeek - i, "days")
        .tz(timezone)
        .toDate();
      days.push(day);
    }

    // Fill in the days of the month
    for (
      let d = firstDayOfMonth.clone();
      d.isSameOrBefore(lastDayOfMonth, "day");
      d.add(1, "day")
    ) {
      const day = d.tz(timezone).toDate();
      days.push(day);
    }

    // Adjusting the end day of the week (Saturday)
    const endDayOfWeek = lastDayOfMonth.day();

    // Fill in the days after the last day of the month to complete the week
    for (let i = 1; i <= 6 - endDayOfWeek; i++) {
      const day = lastDayOfMonth.clone().add(i, "days").tz(timezone).toDate();
      days.push(day);
    }

    // Ensure the days array length is a multiple of 7 (to complete the calendar grid)
    while (days.length % 7 !== 0) {
      const lastDay = days[days.length - 1];
      const day = moment(lastDay).clone().add(1, "day").tz(timezone).toDate();
      days.push(day);
    }

    console.log(days);
    bubble_fn_daysInMonth(days);
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
  availabilityList,
  viewerStartDate,
  alreadyBookedList,
 modifiedSlots,
  offset = 0,
  userOffsetInSeconds = 0
) {
  console.log(
    "Received availabilityList:",
    JSON.stringify(availabilityList, null, 2)
  );
  console.log("Received viewerStartDate:", viewerStartDate);
  console.log(
    "Received alreadyBookedList:",
    JSON.stringify(alreadyBookedList, null, 2)
  );
  console.log(
    "Received modifiedSlots:",
    JSON.stringify(modifiedSlots, null, 2)
  );
  console.log("Received offset:", offset);
  console.log("Received userOffsetInSeconds:", userOffsetInSeconds);

  if (!Array.isArray(availabilityList)) {
    console.error("availabilityList should be an array");
    return emptyOutput();
  }

  const userOffsetInMinutes = userOffsetInSeconds / 60;

  const startDateLocal = moment
    .utc(viewerStartDate)
    .utcOffset(userOffsetInMinutes)
    .startOf("day")
    .add(offset * 7, "days");

  if (!startDateLocal.isValid()) {
    console.error("Invalid viewerStartDate:", viewerStartDate);
    return emptyOutput();
  }

  let baseDailyStart = null;
  let baseDailyEnd = null;
  let baseSlotDuration = null;
  if (availabilityList.length > 0) {
    const firstAvailability = availabilityList[0];
    baseDailyStart = firstAvailability.daily_start_time; // UTC time e.g. "00:00"
    baseDailyEnd = firstAvailability.daily_end_time; // UTC time e.g. "08:00"
    baseSlotDuration = firstAvailability.slot_duration_minutes;
  }

  if (!baseDailyStart || !baseDailyEnd || !baseSlotDuration) {
    console.log("No baseline availability found.");
    return emptyOutput();
  }

  const outputlist6 = generateDayBoundaries(startDateLocal);

  // Generate all slots for the full week
  const outputlist7 = generateWeeklySlots(
    startDateLocal,
    baseDailyStart,
    baseDailyEnd,
    baseSlotDuration,
    userOffsetInSeconds
  );

  // Use the first slot's start date/time as the base reference, if available
  const firstSlotStart =
    outputlist7.length > 0
      ? moment.utc(outputlist7[0][0]).utcOffset(userOffsetInMinutes)
      : startDateLocal.clone();

  // Assign meeting links, addresses, and booked flags to slots
  const { outputlist1, outputlist2, outputlist3, outputlist4 } = assignSlotInfo(
    outputlist7,
    firstSlotStart,
    availabilityList,
    alreadyBookedList,
    userOffsetInSeconds
  );

  // Determine global availability range and filter
  const globalStartUTC = availabilityList.length
    ? moment.min(availabilityList.map((a) => moment.utc(a.start_date)))
    : null;
  const globalEndUTC = availabilityList.length
    ? moment.max(availabilityList.map((a) => moment.utc(a.end_date)))
    : null;

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
    "Generated outputlist1 (Meeting Links):",
    JSON.stringify(outputlist1, null, 2)
  );
  console.log(
    "Generated outputlist2 (Addresses):",
    JSON.stringify(outputlist2, null, 2)
  );
  console.log(
    "Generated outputlist3 (Already Booked):",
    JSON.stringify(outputlist3, null, 2)
  );
  console.log(
    "Generated outputlist4 (Modified Slots):",
    JSON.stringify(outputlist4, null, 2)
  );
  console.log(
    "Generated outputlist5 (Slots Within Availability Range):",
    JSON.stringify(outputlist5, null, 2)
  );
  console.log("Generated outputlist6 :", JSON.stringify(outputlist6, null, 2));
  console.log(
    "Generated outputlist7 (All Slots for Full Week):",
    JSON.stringify(outputlist7, null, 2)
  );

  bubble_fn_hours({
    outputlist1,
    outputlist2,
    outputlist3,
    outputlist4,
    outputlist5,
    outputlist6, // If you no longer need it, remove it entirely
    outputlist7,
  });
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
  const extendedStartLocal = startDateLocal.clone().subtract(1, "day");
  const extendedEndLocal = startDateLocal.clone().add(7, "days").endOf("day");

  console.log("Extended week start (local):", extendedStartLocal.format());
  console.log("Extended week end (local):", extendedEndLocal.format());

  for (let i = -1; i <= 7; i++) {
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
      slotStart.isSameOrAfter(extendedStartLocal) &&
      slotEnd.isSameOrBefore(extendedEndLocal);
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
  userOffsetInSeconds
) {
  const userOffsetInMinutes = userOffsetInSeconds / 60;
  const outputlist1 = [];
  const outputlist2 = [];
  const outputlist3 = [];
  const outputlist4 = [];

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
          alreadyBooked: false,
          isModified: false,
        };

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
            slotInfo.alreadyBooked = true;
          }
        });

        outputlist1.push(slotInfo.meetingLink);
        outputlist2.push(slotInfo.Address);
        outputlist3.push(slotInfo.alreadyBooked);
        outputlist4.push(slotInfo.isModified);
      }
    });
  });

  return { outputlist1, outputlist2, outputlist3, outputlist4 };
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


  return {
    generateUniqueDates,
    generateSlotsForDate,
    getDaysInMonth,
    generateStartTimes,
    generateEndTimes,
    generateSlotsForWeek
  };
};

window["schedule"] = schedule;