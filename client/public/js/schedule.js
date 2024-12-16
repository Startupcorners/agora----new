
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
    offset = 0
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

    if (!Array.isArray(availabilityList)) {
      console.error("availabilityList should be an array");
      return {
        outputlist1: [],
        outputlist2: [],
        outputlist3: [],
        outputlist4: [],
        outputlist5: [],
        outputlist6: [],
        outputlist7: [],
      };
    }

    const outputlist1 = [];
    const outputlist2 = [];
    const outputlist3 = [];
    const outputlist4 = [];
    const outputlist5 = [];
    const outputlist6 = [];
    const outputlist7 = [];

    const startDateUTC = moment
      .utc(viewerStartDate)
      .startOf("day")
      .add(offset * 7, "days"); // Start date of the week

    if (!startDateUTC.isValid()) {
      console.error("Invalid viewerStartDate:", viewerStartDate);
      return {
        outputlist1: [],
        outputlist2: [],
        outputlist3: [],
        outputlist4: [],
        outputlist5: [],
        outputlist6: [],
        outputlist7: [],
      };
    }

    let baseDailyStart = null;
    let baseDailyEnd = null;
    let baseSlotDuration = null;
    if (availabilityList.length > 0) {
      const firstAvailability = availabilityList[0];
      baseDailyStart = firstAvailability.daily_start_time;
      baseDailyEnd = firstAvailability.daily_end_time;
      baseSlotDuration = firstAvailability.slot_duration_minutes;
    }

    if (!baseDailyStart || !baseDailyEnd || !baseSlotDuration) {
      console.log("No baseline availability found, outputlist7 will be empty.");
      return {
        outputlist1,
        outputlist2,
        outputlist3,
        outputlist4,
        outputlist5,
        outputlist6,
        outputlist7,
      };
    }

    const weekSlots = Array.from({ length: 7 }, () => []);

    // Generate slots for the entire week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDayUTC = startDateUTC.clone().add(dayOffset, "days");
      outputlist6.push(currentDayUTC.format("YYYY-MM-DDT00:00:00[Z]"));

      const dailyStartTimeUTC = moment.utc(
        currentDayUTC.format("YYYY-MM-DD") + " " + baseDailyStart,
        "YYYY-MM-DD HH:mm"
      );
      const dailyEndTimeUTC = moment.utc(
        currentDayUTC.format("YYYY-MM-DD") + " " + baseDailyEnd,
        "YYYY-MM-DD HH:mm"
      );

      let currentTimeUTC = dailyStartTimeUTC.clone();
      while (currentTimeUTC.isBefore(dailyEndTimeUTC)) {
        const startSlotUTC = currentTimeUTC.clone();
        const endSlotUTC = startSlotUTC
          .clone()
          .add(baseSlotDuration, "minutes");
        if (endSlotUTC.isAfter(dailyEndTimeUTC)) break;

        const slotRange = [
          startSlotUTC.format("YYYY-MM-DDTHH:mm:ss[Z]"),
          endSlotUTC.format("YYYY-MM-DDTHH:mm:ss[Z]"),
        ];
        outputlist7.push(slotRange);
        weekSlots[dayOffset].push({ slotTimeRange: slotRange });
        currentTimeUTC.add(baseSlotDuration, "minutes");
      }
    }

    // Add all slots to outputlist5
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDaySlots = weekSlots[dayOffset];
      currentDaySlots.forEach((slot) => {
        outputlist5.push(slot.slotTimeRange);
      });
    }

    // Check each generated slot against availability and booked/modified lists
    availabilityList.forEach((availability) => {
      const startDate = moment.utc(availability.start_date).startOf("day");
      const endDate = moment.utc(availability.end_date).endOf("day");

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDayUTC = startDateUTC.clone().add(dayOffset, "days");
        const includesCurrentDayUTC = currentDayUTC.isBetween(
          startDate,
          endDate,
          "day",
          "[]"
        );

        if (includesCurrentDayUTC) {
          weekSlots[dayOffset].forEach((slot) => {
            let slotInfo = {
              slotTimeRange: slot.slotTimeRange,
              meetingLink: availability.meetingLink,
              Address: availability.Address,
              alreadyBooked: false,
              isModified: false,
            };

            // Check against alreadyBookedList
            alreadyBookedList.forEach((bookedSlot) => {
              const bookedStart = moment.utc(bookedSlot.start_date);
              const bookedEnd = moment.utc(bookedSlot.end_date);
              const slotStart = moment.utc(slotInfo.slotTimeRange[0]);
              const slotEnd = moment.utc(slotInfo.slotTimeRange[1]);

              // Check for overlap
              if (
                (slotStart.isSame(bookedStart) && slotEnd.isSame(bookedEnd)) ||
                (slotStart.isBefore(bookedEnd) && slotEnd.isAfter(bookedStart))
              ) {
                slotInfo.alreadyBooked = true;
              }
            });

            // Check against modifiedSlots
            modifiedSlots.forEach((modifiedSlot) => {
              const modStart = moment.utc(modifiedSlot.start_date);
              const modEnd = moment.utc(modifiedSlot.end_date);
              const slotStart = moment.utc(slotInfo.slotTimeRange[0]);
              const slotEnd = moment.utc(slotInfo.slotTimeRange[1]);

              // Check for overlap
              if (
                (slotStart.isSame(modStart) && slotEnd.isSame(modEnd)) ||
                (slotStart.isBefore(modEnd) && slotEnd.isAfter(modStart))
              ) {
                slotInfo.meetingLink = modifiedSlot.meetingLink;
                slotInfo.Address = modifiedSlot.Address;
                slotInfo.isModified = true;
              }
            });

            // Push results to respective lists
            outputlist1.push(slotInfo.meetingLink);
            outputlist2.push(slotInfo.Address);
            outputlist3.push(slotInfo.alreadyBooked);
            outputlist4.push(slotInfo.isModified);
          });
        }
      }
    });

    console.log("Generated outputlist1:", JSON.stringify(outputlist1, null, 2));
    console.log("Generated outputlist2:", JSON.stringify(outputlist2, null, 2));
    console.log("Generated outputlist3:", JSON.stringify(outputlist3, null, 2));
    console.log("Generated outputlist4:", JSON.stringify(outputlist4, null, 2));
    console.log("Generated outputlist5:", JSON.stringify(outputlist5, null, 2));
    console.log("Generated outputlist6:", JSON.stringify(outputlist6, null, 2));
    console.log("Generated outputlist7:", JSON.stringify(outputlist7, null, 2));

    bubble_fn_hours({
      outputlist1,
      outputlist2,
      outputlist3,
      outputlist4,
      outputlist5,
      outputlist6,
      outputlist7,
    });
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