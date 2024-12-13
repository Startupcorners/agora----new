
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

  // Parse viewerDate in viewer's timezone and get start/end of that local day
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

  const localDayStart = viewerDateLocal.clone();
  const localDayEnd = viewerDateLocal.clone().endOf("day");

  // Convert this local date to UTC to get the corresponding UTC days
  const viewerDateUTC = viewerDateLocal.clone().utc();
  const viewerNextDateUTC = viewerDateUTC.clone().add(1, "day");

  // Debugging logs (uncomment if needed)
  // console.log("Local Day Start (viewer):", localDayStart.format(), "in UTC:", localDayStart.clone().utc().format());
  // console.log("Local Day End (viewer):", localDayEnd.format(), "in UTC:", localDayEnd.clone().utc().format());
  // console.log("Viewer Date UTC:", viewerDateUTC.format());
  // console.log("Viewer Next Date UTC:", viewerNextDateUTC.format());

  availabilityList.forEach((availability) => {
    const startDate = moment.utc(availability.start_date).startOf("day");
    const endDate = moment.utc(availability.end_date).endOf("day");

    // Check if either the viewerDateUTC or viewerNextDateUTC fall within the availability range
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
      return; // The requested local day doesn't intersect with availability
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

      // Debugging logs (uncomment if needed)
      // console.log(
      //   "Generating slots for UTC date:",
      //   utcDate.format(),
      //   "Daily Start UTC:",
      //   dailyStartTimeUTC.format(),
      //   "Daily End UTC:",
      //   dailyEndTimeUTC.format()
      // );

      // Convert to viewer's timezone
      const dailyStartTimeViewer = dailyStartTimeUTC.clone().tz(viewerTimeZone);
      const dailyEndTimeViewer = dailyEndTimeUTC.clone().tz(viewerTimeZone);

      // Debugging logs (uncomment if needed)
      // console.log(
      //   "Daily Start Time (viewer):",
      //   dailyStartTimeViewer.format(),
      //   "Daily End Time (viewer):",
      //   dailyEndTimeViewer.format()
      // );

      let currentTime = dailyStartTimeViewer.clone();
      while (currentTime.isBefore(dailyEndTimeViewer)) {
        const startSlot = currentTime.clone();
        const endSlot = startSlot
          .clone()
          .add(availability.slot_duration_minutes, "minutes");

        // If slot extends beyond daily end time, break
        if (endSlot.isAfter(dailyEndTimeViewer)) {
          break;
        }

        // Ensure the slot falls fully within the local day
        // If it's outside the local day boundaries, skip it.
        if (startSlot.isBefore(localDayStart) || endSlot.isAfter(localDayEnd)) {
          currentTime.add(availability.slot_duration_minutes, "minutes");
          continue;
        }

        // Convert to UTC for final output
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

        // Check for booked slots
        alreadyBookedList.forEach((bookedSlot) => {
          const bookedStartDate = moment.utc(bookedSlot.start_date);
          const bookedEndDate = moment.utc(bookedSlot.end_date);
          // If slots overlap or match exactly
          if (
            (startSlot.isSame(bookedStartDate) &&
              endSlot.isSame(bookedEndDate)) ||
            (startSlot.isBefore(bookedEndDate) &&
              endSlot.isAfter(bookedStartDate))
          ) {
            slotInfo.alreadyBooked = true;
          }
        });

        // Check for modified slots
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

    // Generate slots for the primary UTC day if applicable
    if (includesCurrentDateUTC) {
      generateDailySlotsForUTCDate(viewerDateUTC);
    }

    // Generate slots for the next UTC day if it also intersects the local day
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
  return {
    generateUniqueDates,
    generateSlotsForDate,
    getDaysInMonth,
    generateStartTimes,
    generateEndTimes,
  };
};

window["schedule"] = schedule;