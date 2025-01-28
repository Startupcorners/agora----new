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
      for (let hour of overlappingSlots) {
        if (availableSlots.length >= 40) {
          return availableSlots; // Stop once 40 items are added
        }

        let utcTime = new Date(currentDate);
        utcTime.setUTCHours(hour, 0, 0, 0);

        let endTime = new Date(utcTime);
        endTime.setMinutes(utcTime.getMinutes() + durationInMinutes);

        // Push start and end times as separate items
        availableSlots.push(utcTime.toISOString().replace(".000Z", "Z"));
        availableSlots.push(endTime.toISOString().replace(".000Z", "Z"));
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return availableSlots.slice(0, 40); // Ensure exactly 40 items
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

  function generate42CalendarDates(anchorDate, isStart) {
    // Parse the input date (e.g., "2025-02-28") into year, month, and day.
    const [year, month] = anchorDate.split("-").map(Number);

    // Set the first day of the month based on the input date.
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)); // 0-based month.

    // Find the nearest Sunday before or on the first day of the month.
    const dayOfWeek = firstDayOfMonth.getUTCDay(); // 0=Sunday, ..., 6=Saturday.
    const nearestSunday = new Date(
      firstDayOfMonth.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
    );

    // Generate 42 consecutive dates starting from the nearest Sunday.
    const oneDayMs = 24 * 60 * 60 * 1000; // Milliseconds in one day.
    const dates = [];
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(nearestSunday.getTime() + i * oneDayMs);
      dates.push(currentDate.toISOString());
    }

    // Output the dates to the appropriate function based on isStart.
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


function generateSlotsForWeek(
  mainAvailability,
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
  const earliestBookableTime = moment().utc().add(earliestBookableDay, "days");

  // Helper function to generate slots for mainAvailability
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
  console.log("Generated mainSlots:", mainSlots);

  // Filter out slots before the earliest bookable time
  const filteredSlots = mainSlots.filter((slot) => {
    const slotStart = moment.utc(slot[0]);
    return slotStart.isSameOrAfter(earliestBookableTime);
  });
  console.log("Filtered slots after earliestBookableTime:", filteredSlots);

  // Exclude already booked slots
  const availableSlots = filteredSlots.filter((slot) => {
    const slotStart = moment.utc(slot[0]);
    const slotEnd = moment.utc(slot[1]);

    const isOverlapping = alreadyBookedList.some((booked) => {
      const bookedStart = moment.utc(booked.start_date);
      const bookedEnd = moment.utc(booked.end_date);

      const overlap =
        (slotStart.isSameOrAfter(bookedStart) &&
          slotStart.isBefore(bookedEnd)) || // Slot starts inside booked range
        (slotEnd.isAfter(bookedStart) && slotEnd.isSameOrBefore(bookedEnd)) || // Slot ends inside booked range
        (slotStart.isSameOrBefore(bookedStart) &&
          slotEnd.isSameOrAfter(bookedEnd)); // Slot completely covers the booked range

      if (overlap) {
        console.log("Overlapping Slot Found:");
        console.log("  Slot Start:", slotStart.toISOString());
        console.log("  Slot End:", slotEnd.toISOString());
        console.log("  Booked Start:", bookedStart.toISOString());
        console.log("  Booked End:", bookedEnd.toISOString());
      }

      return overlap;
    });

    if (!isOverlapping) {
      console.log("Slot is available:");
      console.log("  Slot Start:", slotStart.toISOString());
      console.log("  Slot End:", slotEnd.toISOString());
    }

    return !isOverlapping;
  });

  console.log("Final available slots:", availableSlots);

  return availableSlots;
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
    generatedSlots,
    blockedByUserSlots
  ) {
    if (!mainAvailability || !Array.isArray(generatedSlots)) {
      return [[], [], [], [], []]; // Empty arrays for urls, addresses, isModified, isStartupCorners, and isBlockedByUser
    }

    const urls = [];
    const addresses = [];
    const isModified = [];
    const isStartupCorners = [];
    const isBlockedByUser = [];

    generatedSlots.forEach((slot) => {
      const slotStart = moment.utc(slot.start_date);
      const slotEnd = moment.utc(slot.end_date);

      let slotInfo = {
        meetingLink: mainAvailability.meetingLink,
        Address: mainAvailability.Address,
        isModified: null,
        isStartupCorners: mainAvailability.isStartupCorners,
        isBlockedByUser: null,
      };

      // Check if the slot is modified
      const modifiedSlot = modifiedSlots.find((modSlot) => {
        const modStart = moment.utc(modSlot.start_date);
        const modEnd = moment.utc(modSlot.end_date);

        return (
          slotStart.isSameOrAfter(modStart) && slotEnd.isSameOrBefore(modEnd)
        );
      });

      if (modifiedSlot) {
        slotInfo.meetingLink = modifiedSlot.meetingLink;
        slotInfo.Address = modifiedSlot.Address;
        slotInfo.isModified = modifiedSlot.bubbleId || true;
        slotInfo.isStartupCorners = modifiedSlot.isStartupcorners;
      }

      // Check if the slot is blocked by the user
      const blockedSlot = blockedByUserSlots.find((blockedSlot) => {
        const blockedStart = moment.utc(blockedSlot.start_date);
        const blockedEnd = moment.utc(blockedSlot.end_date);

        return (
          slotStart.isSameOrAfter(blockedStart) &&
          slotEnd.isSameOrBefore(blockedEnd)
        );
      });

      if (blockedSlot) {
        slotInfo.isBlockedByUser = blockedSlot.bubbleId || null;
      }

      // Push slot info to output lists
      urls.push(slotInfo.meetingLink);
      addresses.push(slotInfo.Address);
      isModified.push(slotInfo.isModified);
      isStartupCorners.push(slotInfo.isStartupCorners);
      isBlockedByUser.push(slotInfo.isBlockedByUser);
    });

    return [urls, addresses, isModified, isStartupCorners, isBlockedByUser];
  }


function generateAllPossibleSlots(slots, weekRanges) {
  const allPossibleSlots = new Set();

  const addSlotForWeekRange = (baseSlot, dayOffsets, duration, weekRange) => {
    const baseDate = new Date(baseSlot);

    dayOffsets.forEach((offset) => {
      const newStartDate = new Date(baseDate);
      newStartDate.setDate(baseDate.getDate() + offset);
      const newEndDate = new Date(newStartDate.getTime() + duration);

      // Check if the slot is within the week range
      const weekStart = new Date(weekRange[0]);
      const weekEnd = new Date(weekRange[1]);

      if (
        newStartDate.getTime() >= weekStart.getTime() &&
        newEndDate.getTime() <= weekEnd.getTime()
      ) {
        const slotPair = JSON.stringify([
          newStartDate.toISOString(),
          newEndDate.toISOString(),
        ]);
        allPossibleSlots.add(slotPair);
      }
    });
  };

  slots.forEach((slotRange) => {
    const [slotStart, slotEnd] = slotRange;
    const slotDuration =
      new Date(slotEnd).getTime() - new Date(slotStart).getTime();

    weekRanges.forEach((weekRange) => {
      // Generate dayOffsets [-3, -2, -1, 0, 1, 2, 3]
      const dayOffsets = Array.from({ length: 7 }, (_, i) => i - 3);

      // Propagate slots for this week range
      addSlotForWeekRange(slotStart, dayOffsets, slotDuration, weekRange);
    });
  });

  return Array.from(allPossibleSlots)
    .map((slotPair) => JSON.parse(slotPair))
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
}










  // Wrapper function
  function generateScheduleWrapper(
  mainAvailability,
  viewerDate,
  alreadyBookedList,
  modifiedSlots,
  offset,
  userOffsetInSeconds,
  earliestBookableDay,
  blockedByUser // Function parameter
) {
  console.log("generateScheduleWrapper received:");
  console.log("mainAvailability:", mainAvailability);
  console.log("modifiedSlots:", modifiedSlots);
  console.log("viewerDate:", viewerDate);
  console.log("offset:", offset);
  console.log("userOffsetInSeconds:", userOffsetInSeconds);
  console.log("earliestBookableDay:", earliestBookableDay);
  console.log("blockedByUser:", blockedByUser);
  console.log("alreadyBookedList:", alreadyBookedList);

  // Generate the slots for the expanded range (-2 days to +9 days)
  const slots = generateSlotsForWeek(
    mainAvailability,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableDay
  );

  // Generate the week ranges
  const weekRanges = generateWeekRanges(viewerDate, offset, userOffsetInSeconds);

  const allPossibleSlots = generateAllPossibleSlots(slots, weekRanges);

  // Get the outputs from assignSimplifiedSlotInfo
  const [urls, addresses, isModified, isStartupCorners, blockedByUserOutput] =
    assignSimplifiedSlotInfo(
      mainAvailability,
      modifiedSlots,
      allPossibleSlots.map((slot) => ({
        start_date: slot[0],
        end_date: slot[1],
      })), // Convert back to object format for compatibility
      blockedByUser // Pass the original blockedByUser parameter
    );

  // Assign outputs to the appropriate variables
  let outputlist1 = urls; // Meeting links
  let outputlist2 = addresses; // Addresses
  let outputlist4 = isModified; // Modified slot info
  let outputlist5 = slots; // The slots themselves (array of arrays)
  let outputlist6 = weekRanges; // Week ranges
  let outputlist7 = allPossibleSlots; // All possible slots
  let outputlist8 = blockedByUserOutput; // Output from assignSimplifiedSlotInfo
  let outputlist9 = isStartupCorners; // Startup corners information

  console.log({
    outputlist1,
    outputlist2,
    outputlist4,
    outputlist9,
    outputlist5,
    outputlist7,
    outputlist8,
    outputlist6,
  });

  // Send result to Bubble
  bubble_fn_hours({
    outputlist1: outputlist1,
    outputlist2: outputlist2,
    outputlist4: outputlist4,
    outputlist5: outputlist5,
    outputlist6: outputlist6,
    outputlist7: outputlist7,
    outputlist8: outputlist8,
    outputlist9: outputlist9,
  });

  return {
    outputlist1,
    outputlist2,
    outputlist4,
    outputlist9,
    outputlist5,
    outputlist6,
    outputlist8,
    outputlist7,
  };
}

return {
  generateScheduleWrapper,
  generateStartTimes,
  generateEndTimes,
  adjustDatesToOffset,
  generate42CalendarDates,
  findOverlappingTimeRanges,
  runProcess,
};
}
window["schedule"] = schedule;
