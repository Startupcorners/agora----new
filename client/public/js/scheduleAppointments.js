export const scheduleAppointments = async function () {
  function generateSlotsForWeek(
    mainAvailability,
    allAvailabilityLists,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  ) {
    // Adjust the viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = moment(viewerDate)
      .add(offset, "weeks")
      .utc()
      .startOf("day")
      .subtract(userOffsetInSeconds, "seconds");

    // Adjust the range to start 2 days before viewerDate and end 9 days after
    const rangeStart = adjustedViewerDate.clone().subtract(2, "days");
    const rangeEnd = adjustedViewerDate.clone().add(9, "days").endOf("day");

    // Calculate the earliest bookable time (now + earliestBookableDay)
    const earliestBookableTime = moment()
      .utc()
      .add(earliestBookableDay, "days");

    // Helper function to calculate slots for a given availability
    function generateSlots(availability, start, end) {
      const slots = [];
      const timeOffsetSeconds = availability.timeOffsetSeconds;
      const dailyStartDuration = moment.duration(availability.daily_start_time);
      const dailyEndDuration = moment.duration(availability.daily_end_time);

      let current = start.clone();
      while (current.isBefore(end)) {
        const dayOfWeek = current.day();
        if (!availability.excludedDays.includes(dayOfWeek)) {
          // Calculate dayStartUTC and dayEndUTC by converting local times to UTC
          const dayStartUTC = current
            .clone()
            .startOf("day")
            .subtract(timeOffsetSeconds, "seconds")
            .add(dailyStartDuration);

          const dayEndUTC = current
            .clone()
            .startOf("day")
            .subtract(timeOffsetSeconds, "seconds")
            .add(dailyEndDuration);

          let slot = dayStartUTC.clone();
          while (slot.isBefore(dayEndUTC) && slot.isBefore(end)) {
            if (slot.isSameOrAfter(start)) {
              slots.push([
                slot.clone().toISOString(),
                slot
                  .clone()
                  .add(availability.slot_duration_minutes, "minutes")
                  .toISOString(),
              ]);
            }
            slot.add(availability.slot_duration_minutes, "minutes");
          }
        }
        current.add(1, "day");
      }

      return slots;
    }

    // Generate main availability slots
    const mainSlots = generateSlots(mainAvailability, rangeStart, rangeEnd);

    // If allAvailabilityLists is empty, return main slots filtered by earliestBookableTime
    if (!allAvailabilityLists || allAvailabilityLists.length === 0) {
      return mainSlots.filter((slot) => {
        const slotStart = moment.utc(slot[0]);
        return slotStart.isSameOrAfter(earliestBookableTime);
      });
    }

    // Generate other availability slots and find common slots
    let commonSlots = [...mainSlots];
    allAvailabilityLists.forEach((availability) => {
      const slots = generateSlots(availability, rangeStart, rangeEnd);
      commonSlots = commonSlots.filter((mainSlot) =>
        slots.some((slot) => slot[0] === mainSlot[0] && slot[1] === mainSlot[1])
      );
    });

    // Filter out slots before the earliest bookable time
    commonSlots = commonSlots.filter((slot) => {
      const slotStart = moment.utc(slot[0]);
      return slotStart.isSameOrAfter(earliestBookableTime);
    });

    // Exclude already booked slots
    commonSlots = commonSlots.filter((slot) => {
      const slotStart = moment.utc(slot[0]);
      const slotEnd = moment.utc(slot[1]);
      return !alreadyBookedList.some((booked) => {
        const bookedStart = moment.utc(booked.start_date);
        const bookedEnd = moment.utc(booked.end_date);
        return (
          slotStart.isBetween(bookedStart, bookedEnd, null, "[)") ||
          slotEnd.isBetween(bookedStart, bookedEnd, null, "(]")
        );
      });
    });

    return commonSlots;
  }

  function generateWeekRanges(viewerDate, offset, userOffsetInSeconds) {
    const moment = window.moment; // Ensure moment.js is loaded

    console.log("----- generateWeekRanges -----");
    console.log("Input Parameters:");
    console.log("viewerDate:", viewerDate);
    console.log("offset (weeks):", offset);
    console.log("userOffsetInSeconds:", userOffsetInSeconds);

    // Parse viewerDate as UTC to prevent local time interpretation
    const viewerDateUTC = moment.utc(viewerDate, "YYYY-MM-DD");
    console.log("Parsed viewerDate as UTC:", viewerDateUTC.toISOString());

    // Adjust viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = viewerDateUTC
      .add(offset, "weeks")
      .startOf("day")
      .subtract(userOffsetInSeconds, "seconds"); // Convert local midnight to UTC

    console.log(
      "Adjusted Viewer Date (UTC):",
      adjustedViewerDate.toISOString()
    );

    const weekRanges = [];
    for (let i = 0; i < 7; i++) {
      const dayStartUTC = adjustedViewerDate.clone().add(i, "days");
      const dayEndUTC = dayStartUTC.clone().add(1, "day").subtract(1, "second");

      console.log(`Day ${i} Start UTC:`, dayStartUTC.toISOString());
      console.log(`Day ${i} End UTC:  `, dayEndUTC.toISOString());

      weekRanges.push([dayStartUTC.toISOString(), dayEndUTC.toISOString()]);
    }

    console.log("Generated Week Ranges:", weekRanges);
    console.log("----- End of generateWeekRanges -----\n");

    return weekRanges;
  }

  function assignSimplifiedSlotInfo(
    mainAvailability,
    modifiedSlots,
    generatedSlots
  ) {
    if (!mainAvailability || !Array.isArray(generatedSlots)) {
      return [[], [], [], []]; // Empty arrays for urls, addresses, isModified, and isStartupCorners
    }

    const urls = []; // Meeting links
    const addresses = []; // Addresses
    const isModified = []; // Modified slot info (null for non-modified, bubbleId for modified)
    const isStartupCorners = []; // Startup corners information

    generatedSlots.forEach((slot) => {
      const slotStart = moment.utc(slot.start_date);
      const slotEnd = moment.utc(slot.end_date);

      let slotInfo = {
        meetingLink: mainAvailability.meetingLink,
        Address: mainAvailability.Address,
        isModified: null, // Default: not modified
        isStartupCorners: mainAvailability.isStartupCorners,
      };

      // Check if the slot is modified
      const modifiedSlot = modifiedSlots.find((modSlot) => {
        const modStart = moment.utc(modSlot.start_date);
        const modEnd = moment.utc(modSlot.end_date);

        return (
          slotStart.isBetween(modStart, modEnd, null, "[)") ||
          slotEnd.isBetween(modStart, modEnd, null, "(]") ||
          (slotStart.isSame(modStart) && slotEnd.isSame(modEnd)) ||
          (modStart.isBetween(slotStart, slotEnd, null, "[)") &&
            modEnd.isBetween(slotStart, slotEnd, null, "(]"))
        );
      });

      if (modifiedSlot) {
        // Use modified slot info
        slotInfo = {
          meetingLink: modifiedSlot.meetingLink,
          Address: modifiedSlot.Address,
          isModified: modifiedSlot.bubbleId || true, // Mark as modified
          isStartupCorners: modifiedSlot.isStartupcorners,
        };
      }

      // Push slot info to output lists
      urls.push(slotInfo.meetingLink);
      addresses.push(slotInfo.Address);
      isModified.push(slotInfo.isModified);
      isStartupCorners.push(slotInfo.isStartupCorners);
    });

    return [urls, addresses, isModified, isStartupCorners];
  }

  function findEarliestAndLatestSlotsUserTime(slots, userOffsetInSeconds) {
    let earliest = null;
    let latest = null;

    slots.forEach((slot) => {
      // Convert slot times from UTC to user's local time
      const slotStartLocal = moment
        .utc(slot[0])
        .add(userOffsetInSeconds, "seconds");
      const slotEndLocal = moment
        .utc(slot[1])
        .add(userOffsetInSeconds, "seconds");

      if (!earliest || slotStartLocal.isBefore(earliest)) {
        earliest = slotStartLocal.clone();
      }
      if (!latest || slotEndLocal.isAfter(latest)) {
        latest = slotEndLocal.clone();
      }
    });

    // Normalize earliest and latest to start and end of their respective days
    const earliestTime = earliest.clone().startOf("day");
    const latestTime = latest.clone().endOf("day");

    return { earliestTime, latestTime };
  }

  function generateStandardizedSlots(
    earliestTime,
    latestTime,
    slotDurationMinutes,
    userOffsetInSeconds
  ) {
    const standardizedSlots = [];
    const daysInWeek = 7;

    // Validate slotDurationMinutes
    if (
      typeof slotDurationMinutes !== "number" ||
      slotDurationMinutes <= 0 ||
      !Number.isInteger(slotDurationMinutes)
    ) {
      console.warn(
        "Invalid slotDurationMinutes provided. Defaulting to 30 minutes."
      );
      slotDurationMinutes = 30; // Default value
    }

    for (let i = 0; i < daysInWeek; i++) {
      // Clone the earliestTime and add 'i' days
      const currentDay = earliestTime.clone().add(i, "days");

      // Set the start and end times for the day based on earliest and latest times
      let slotStartLocal = currentDay
        .clone()
        .hour(earliestTime.hour())
        .minute(earliestTime.minute())
        .second(0)
        .millisecond(0);
      const slotEndLocal = currentDay
        .clone()
        .hour(latestTime.hour())
        .minute(latestTime.minute())
        .second(0)
        .millisecond(0);

      // Check if slotStartLocal is before slotEndLocal
      if (!slotStartLocal.isBefore(slotEndLocal)) {
        console.warn(
          `No slot generation for day ${i}: slotStartLocal (${slotStartLocal.format()}) is not before slotEndLocal (${slotEndLocal.format()}).`
        );
        continue; // Skip to next day
      }

      // Safeguard: Limit the number of slots per day to prevent infinite loops
      let maxSlotsPerDay = 100; // Arbitrary large number
      let slotsGenerated = 0;

      while (
        slotStartLocal.isBefore(slotEndLocal) &&
        slotsGenerated < maxSlotsPerDay
      ) {
        const slotEndLocalTime = slotStartLocal
          .clone()
          .add(slotDurationMinutes, "minutes");

        // Convert back to UTC for consistency
        const slotStartUTC = slotStartLocal
          .clone()
          .subtract(userOffsetInSeconds, "seconds")
          .toISOString();
        const slotEndUTC = slotEndLocalTime
          .clone()
          .subtract(userOffsetInSeconds, "seconds")
          .toISOString();

        // Push as a single date range
        standardizedSlots.push([slotStartUTC, slotEndUTC]);

        slotStartLocal = slotEndLocalTime;
        slotsGenerated++;
      }

      if (slotsGenerated >= maxSlotsPerDay) {
        console.error(
          `Maximum slot generation limit reached for day ${i}. Potential infinite loop detected.`
        );
      }
    }

    return standardizedSlots;
  }
  function distributeSlotsByDay(slots, weekRanges) {
    // Initialize day variables as empty arrays
    const days = {
      dayOne: [],
      dayTwo: [],
      dayThree: [],
      dayFour: [],
      dayFive: [],
      daySix: [],
      daySeven: [],
    };

    // Define an array to map index to day names
    const dayNames = [
      "dayOne",
      "dayTwo",
      "dayThree",
      "dayFour",
      "dayFive",
      "daySix",
      "daySeven",
    ];

    // Iterate through each slot
    slots.forEach((slot) => {
      const slotStart = moment.utc(slot[0]);
      const slotEnd = moment.utc(slot[1]);

      // Iterate through each week range to find where the slot belongs
      for (let i = 0; i < weekRanges.length; i++) {
        const dayRange = weekRanges[i];
        const dayStart = moment.utc(dayRange[0]);
        const dayEnd = moment.utc(dayRange[1]);

        // Check if the slot falls within the current day range
        if (
          slotStart.isSameOrAfter(dayStart) &&
          slotEnd.isSameOrBefore(dayEnd)
        ) {
          const dayKey = dayNames[i]; // Correctly map to 'dayOne', 'dayTwo', etc.
          days[dayKey].push(slot);
          break; // Move to the next slot after assigning
        }
      }
    });

    return days;
  }

  /**
   * Converts an array of scheduling slots from UTC to the user's local timezone.
   *
   * @param {Array<Array<String | Date>>} slots - The array of slots to convert. Each slot is an array with [startDate, endDate].
   * @param {number} userOffsetInSeconds - The user's timezone offset from UTC in seconds.
   * @returns {Array<Array<Date>>} - A new array of slots with start and end times adjusted to the user's timezone.
   */
  function convertSlotsToUserTimeZone(slots, userOffsetInSeconds) {
    if (!Array.isArray(slots)) {
      throw new TypeError("The 'slots' parameter must be an array.");
    }

    if (typeof userOffsetInSeconds !== "number") {
      throw new TypeError(
        "The 'userOffsetInSeconds' parameter must be a number."
      );
    }

    // Convert the offset from seconds to milliseconds for Date manipulation
    const offsetInMilliseconds = userOffsetInSeconds * 1000;

    // Map through each slot and adjust the start and end times
    const convertedSlots = slots.map((slot, index) => {
      if (
        !Array.isArray(slot) ||
        slot.length !== 2 ||
        (typeof slot[0] !== "string" && !(slot[0] instanceof Date)) ||
        (typeof slot[1] !== "string" && !(slot[1] instanceof Date))
      ) {
        console.warn(`Invalid slot format at index ${index}:`, slot);
        return [null, null];
      }

      // Parse the start and end dates
      const startDateUTC =
        typeof slot[0] === "string"
          ? new Date(slot[0])
          : new Date(slot[0].getTime());
      const endDateUTC =
        typeof slot[1] === "string"
          ? new Date(slot[1])
          : new Date(slot[1].getTime());

      if (isNaN(startDateUTC) || isNaN(endDateUTC)) {
        console.warn(`Invalid date in slot at index ${index}:`, slot);
        return [null, null];
      }

      // Adjust the dates by the user's offset
      const startDateLocal = new Date(
        startDateUTC.getTime() + offsetInMilliseconds
      );
      const endDateLocal = new Date(
        endDateUTC.getTime() + offsetInMilliseconds
      );

      return [startDateLocal, endDateLocal];
    });

    return convertedSlots;
  }

  /**
   * Finds the earliest start time and the latest end time from an array of converted scheduling slots,
   * considering only the time components (hours and minutes).
   *
   * @param {Array<Array<Date>>} convertedSlots - The array of converted slots. Each slot is an array with [startDateLocal, endDateLocal].
   * @returns {{ earliestTime: string | null, latestTime: string | null }} - An object containing the earliest start time and the latest end time in "HH:MM" format.
   */
  function findEarliestAndLatestFromTheConvertedSlots(convertedSlots) {
    if (!Array.isArray(convertedSlots)) {
      throw new TypeError("The 'convertedSlots' parameter must be an array.");
    }

    let earliestTimeInMinutes = null; // Minutes since midnight
    let latestTimeInMinutes = null; // Minutes since midnight

    convertedSlots.forEach((slot, index) => {
      if (
        !Array.isArray(slot) ||
        slot.length !== 2 ||
        !(slot[0] instanceof Date) ||
        !(slot[1] instanceof Date)
      ) {
        console.warn(`Invalid slot format at index ${index}:`, slot);
        return; // Skip invalid slots
      }

      const [startDate, endDate] = slot;

      if (isNaN(startDate) || isNaN(endDate)) {
        console.warn(`Invalid dates in slot at index ${index}:`, slot);
        return; // Skip slots with invalid dates
      }

      // Extract hours and minutes from startDate
      const startHours = startDate.getHours();
      const startMinutes = startDate.getMinutes();
      const startTimeInMinutes = startHours * 60 + startMinutes;

      // Extract hours and minutes from endDate
      const endHours = endDate.getHours();
      const endMinutes = endDate.getMinutes();
      const endTimeInMinutes = endHours * 60 + endMinutes;

      // Update earliestTimeInMinutes
      if (
        earliestTimeInMinutes === null ||
        startTimeInMinutes < earliestTimeInMinutes
      ) {
        earliestTimeInMinutes = startTimeInMinutes;
      }

      // Update latestTimeInMinutes
      if (
        latestTimeInMinutes === null ||
        endTimeInMinutes > latestTimeInMinutes
      ) {
        latestTimeInMinutes = endTimeInMinutes;
      }
    });

    // Helper function to convert minutes since midnight to "HH:MM" format
    function minutesToHHMM(minutes) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const paddedHrs = String(hrs).padStart(2, "0");
      const paddedMins = String(mins).padStart(2, "0");
      return `${paddedHrs}:${paddedMins}`;
    }

    let earliestTime = null;
    let latestTime = null;

    if (earliestTimeInMinutes !== null) {
      earliestTime = minutesToHHMM(earliestTimeInMinutes);
      console.log("Earliest Time Found:", earliestTime);
    } else {
      console.warn("No valid slots to determine earliest time.");
    }

    if (latestTimeInMinutes !== null) {
      latestTime = minutesToHHMM(latestTimeInMinutes);
      console.log("Latest Time Found:", latestTime);
    } else {
      console.warn("No valid slots to determine latest time.");
    }

    return { earliestTime, latestTime };
  }

  /**
   * Converts week ranges based on the user's timezone offset.
   *
   * @param {Array<Array<String>>} weekRanges - Array of week ranges. Each week range is an array with [startDateStr, endDateStr] in UTC.
   * @param {number} userOffsetInSeconds - The user's timezone offset from UTC in seconds.
   * @returns {Array<Array<String>>} - A new array of week ranges with adjusted start and end times in UTC.
   */
  function convertweekRange(weekRanges, userOffsetInSeconds) {
    // Input Validation
    if (!Array.isArray(weekRanges)) {
      throw new TypeError("The 'weekRanges' parameter must be an array.");
    }

    if (typeof userOffsetInSeconds !== "number") {
      throw new TypeError(
        "The 'userOffsetInSeconds' parameter must be a number."
      );
    }

    // Helper function to parse ISO string to Date
    function parseISOToDate(isoString) {
      const date = new Date(isoString);
      if (isNaN(date)) {
        throw new Error(`Invalid ISO date string: ${isoString}`);
      }
      return date;
    }

    // Helper function to format Date to ISO string
    function formatDateToISO(date) {
      return date.toISOString();
    }

    // Convert offset from seconds to milliseconds
    const offsetInMilliseconds = userOffsetInSeconds * 1000;

    // Convert each weekRange by adjusting start and end times based on user offset
    const convertedWeekRanges = weekRanges.map((range, index) => {
      if (!Array.isArray(range) || range.length !== 2) {
        console.warn(`Invalid weekRange format at index ${index}:`, range);
        return [null, null]; // Or handle as per your requirements
      }

      const [startStr, endStr] = range;

      let startDate, endDate;

      try {
        startDate = parseISOToDate(startStr);
        endDate = parseISOToDate(endStr);
      } catch (error) {
        console.warn(
          `Error parsing dates for weekRange at index ${index}:`,
          error.message
        );
        return [null, null]; // Or handle as per your requirements
      }

      // Adjust the start and end dates by adding the offset
      const adjustedStartDate = new Date(
        startDate.getTime() + offsetInMilliseconds
      );
      const adjustedEndDate = new Date(
        endDate.getTime() + offsetInMilliseconds
      );

      return [
        formatDateToISO(adjustedStartDate),
        formatDateToISO(adjustedEndDate),
      ];
    });

    return convertedWeekRanges;
  }

  /**
   * Creates all possible scheduling slots within the specified week ranges,
   * bounded by the earliest and latest times, and adhering to the defined slot duration.
   *
   * @param {Array<Array<String>>} convertedWeekRanges - Array representing each day's availability.
   *                                                    Each element is an array with [startDateStr, endDateStr] in UTC.
   * @param {string} earliestTime - The earliest start time across all slots in "HH:MM" format.
   * @param {string} latestTime - The latest end time across all slots in "HH:MM" format.
   * @param {number} slotDurationMinutes - The duration of each slot in minutes.
   * @returns {Array<Array<Date>>} - Array of all possible slots. Each slot is [startDateUTC, endDateUTC].
   */
  function createAllPossibleSlots(
    convertedWeekRanges,
    earliestTime,
    latestTime,
    slotDurationMinutes
  ) {
    // Input Validation
    if (!Array.isArray(convertedWeekRanges)) {
      throw new TypeError(
        "The 'convertedWeekRanges' parameter must be an array."
      );
    }

    if (typeof earliestTime !== "string" || typeof latestTime !== "string") {
      throw new TypeError(
        "The 'earliestTime' and 'latestTime' parameters must be strings in 'HH:MM' format."
      );
    }

    if (typeof slotDurationMinutes !== "number" || slotDurationMinutes <= 0) {
      throw new TypeError(
        "The 'slotDurationMinutes' parameter must be a positive number."
      );
    }

    // Helper function to convert "HH:MM" to minutes since midnight
    function timeStringToMinutes(timeStr) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      if (
        isNaN(hours) ||
        isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        throw new Error(`Invalid time string: ${timeStr}`);
      }
      return hours * 60 + minutes;
    }

    // Helper function to set time on a Date object based on minutes since midnight
    function setTimeOnDate(date, minutesSinceMidnight) {
      const newDate = new Date(date); // Clone the date
      newDate.setUTCHours(0, 0, 0, 0); // Reset time to midnight UTC
      const hours = Math.floor(minutesSinceMidnight / 60);
      const minutes = minutesSinceMidnight % 60;
      newDate.setUTCHours(hours, minutes, 0, 0); // Set the desired time
      return newDate;
    }

    // Convert earliestTime and latestTime to minutes
    const earliestMinutes = timeStringToMinutes(earliestTime);
    const latestMinutes = timeStringToMinutes(latestTime);

    if (earliestMinutes >= latestMinutes) {
      throw new Error("earliestTime must be earlier than latestTime.");
    }

    const allPossibleSlots = [];

    convertedWeekRanges.forEach((range, index) => {
      if (!Array.isArray(range) || range.length !== 2) {
        console.warn(`Invalid weekRange format at index ${index}:`, range);
        return; // Skip invalid range
      }

      const [startStr, endStr] = range;

      let dayStartUTC, dayEndUTC;

      try {
        dayStartUTC = new Date(startStr);
        dayEndUTC = new Date(endStr);

        if (isNaN(dayStartUTC) || isNaN(dayEndUTC)) {
          throw new Error("Invalid date.");
        }

        if (dayStartUTC >= dayEndUTC) {
          console.warn(
            `Start date is not before end date in weekRange at index ${index}.`
          );
          return; // Skip invalid range
        }
      } catch (error) {
        console.warn(
          `Error parsing dates for weekRange at index ${index}:`,
          error.message
        );
        return; // Skip invalid date range
      }

      // Calculate the date (year, month, day) from dayStartUTC
      const year = dayStartUTC.getUTCFullYear();
      const month = dayStartUTC.getUTCMonth(); // Months are zero-indexed
      const day = dayStartUTC.getUTCDate();

      // Create a base date for the day
      const baseDate = new Date(Date.UTC(year, month, day));

      // Set earliest and latest times on the base date
      const slotStartUTC = setTimeOnDate(baseDate, earliestMinutes);
      const slotEndUTC = setTimeOnDate(baseDate, latestMinutes);

      // Ensure that slotStartUTC and slotEndUTC are within the weekRange
      if (slotStartUTC < dayStartUTC) {
        console.warn(
          `Adjusted slotStartUTC is before dayStartUTC for weekRange at index ${index}. Adjusting to dayStartUTC.`
        );
        slotStartUTC.setTime(dayStartUTC.getTime());
      }

      if (slotEndUTC > dayEndUTC) {
        console.warn(
          `Adjusted slotEndUTC is after dayEndUTC for weekRange at index ${index}. Adjusting to dayEndUTC.`
        );
        slotEndUTC.setTime(dayEndUTC.getTime());
      }

      // Recalculate minutes in case adjustments were made
      const adjustedStartMinutes =
        slotStartUTC.getUTCHours() * 60 + slotStartUTC.getUTCMinutes();
      const adjustedEndMinutes =
        slotEndUTC.getUTCHours() * 60 + slotEndUTC.getUTCMinutes();

      if (adjustedStartMinutes >= adjustedEndMinutes) {
        console.warn(
          `No available slots for weekRange at index ${index} after adjustments.`
        );
        return; // Skip if no valid time range
      }

      // Generate slots within the adjusted time range
      let currentStart = slotStartUTC;
      let currentEnd = new Date(
        currentStart.getTime() + slotDurationMinutes * 60000
      ); // Add slotDurationMinutes

      while (currentEnd <= slotEndUTC) {
        allPossibleSlots.push([new Date(currentStart), new Date(currentEnd)]);
        // Move to the next slot
        currentStart = currentEnd;
        currentEnd = new Date(
          currentStart.getTime() + slotDurationMinutes * 60000
        );
      }
    });

    console.log(`Generated ${allPossibleSlots.length} possible slots.`);
    return allPossibleSlots;
  }

  // Wrapper function
  function generateScheduleWrapper(
    mainAvailability,
    allAvailabilityLists,
    viewerDate,
    alreadyBookedList,
    modifiedSlots,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  ) {
    try {
      // Log received parameters for debugging
      console.log("generateScheduleWrapper received:", {
        mainAvailability,
        modifiedSlots,
        viewerDate,
        offset,
        userOffsetInSeconds,
        earliestBookableDay,
      });

      // Step 1: Generate initial slots based on availability
      const slots = generateSlotsForWeek(
        mainAvailability,
        allAvailabilityLists,
        viewerDate,
        alreadyBookedList,
        offset,
        userOffsetInSeconds,
        earliestBookableDay
      );

      // Step 2: Generate week ranges (start and end times for each day)
      const weekRanges = generateWeekRanges(
        viewerDate,
        offset,
        userOffsetInSeconds
      );

      // Step 3: Distribute slots into day-specific variables
      const convertedSlots = convertSlotsToUserTimeZone(
        slots,
        userOffsetInSeconds
      );

      // Step 4: Find the earliest and latest times from the distributed slots
      const { earliestTime, latestTime } =
        findEarliestAndLatestFromTheConvertedSlots(convertedSlots);

      console.log("earliestTime:", earliestTime, "latestTime:", latestTime);

      const convertedWeekRanges = convertweekRange(
        weekRanges,
        userOffsetInSeconds
      );

      // Step 5: Generate all slots for the week range based on earliest and latest times
      const allPossibleSlots = createAllPossibleSlots(
        convertedWeekRanges,
        earliestTime,
        latestTime,
        mainAvailability.slot_duration_minutes
      );

      // Step 6: Assign simplified slot information for Bubble
      const [urls, addresses, isModified, isStartupCorners] =
        assignSimplifiedSlotInfo(
          mainAvailability,
          modifiedSlots,
          allPossibleSlots.map((slot) => ({
            start_date: slot[0],
            end_date: slot[1],
          }))
        );

      // Step 7: Check if slots are available after processing
      if (!slots || slots.length === 0) {
        console.warn("No available slots generated.");

        const emptyOutput = {
          meetingLinks: [],
          addresses: [],
          modifiedSlotInfo: [],
          slots: [],
          weekRanges: [],
          allPossibleSlots: [],
          startupCorners: [],
        };

        console.log("Empty Output:", emptyOutput);
        bubble_fn_hours(emptyOutput);
        return emptyOutput;
      }

      // Step 8: Assign outputs to descriptive variables
      const output = {
        meetingLinks: urls,
        addresses: addresses,
        modifiedSlotInfo: isModified,
        slots: slots,
        weekRanges: weekRanges,
        allPossibleSlots: allPossibleSlots, // Corrected typo
        startupCorners: isStartupCorners,
      };

      console.log("Output:", output);

      // Step 9: Send the results to Bubble
      bubble_fn_hours(output);

      // Return the outputs for potential further use
      return output;
    } catch (error) {
      console.error("Error in generateScheduleWrapper:", error);

      const emptyOutput = {
        meetingLinks: [],
        addresses: [],
        modifiedSlotInfo: [],
        slots: [],
        weekRanges: [],
        allPossibleSlots: [],
        startupCorners: [],
      };

      console.log("Empty Output due to Error:", emptyOutput);
      bubble_fn_hours(emptyOutput);
      return emptyOutput;
    }
  }

  return {
    generateScheduleWrapper,
  };
};

window["scheduleAppointments"] = scheduleAppointments;
