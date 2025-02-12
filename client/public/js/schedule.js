

  async function runProcess(
  timezoneOffsets,
  startDate,
  endDate,
  poll,
  bookedSlots, // e.g. ["2025-01-28T08:00:00Z_2025-01-28T08:15:00Z", ...]
  durationInMinutes,
  previouslyCreated
) {
  console.log("🔹 Function Called: runProcess");
  console.log("📥 Inputs - Start Date:", startDate, "End Date:", endDate);
  console.log("📥 Inputs - Duration:", durationInMinutes, "Min Slots:", MIN_SLOTS_REQUIRED);

  let maxDaysToAdd = 7;
  let MIN_SLOTS_REQUIRED = 20; // or 40, etc.
  let updatedStartDate = new Date(startDate);
  let updatedEndDate = new Date(endDate);
  let WORKING_HOURS_START = 8;
  let WORKING_HOURS_END = 20;
  let expansionAttempts = 0; // NEW: Limit working hour expansion attempts

  let selectedPairs = [];

  while (selectedPairs.length < MIN_SLOTS_REQUIRED && maxDaysToAdd >= 0) {
    console.log(`🔄 Searching between ${updatedStartDate.toISOString()} and ${updatedEndDate.toISOString()}`);
    
    // 1. Find overlapping hours in the given working-hour window
    const overlappingHours = findOverlappingSlots(
      timezoneOffsets,
      WORKING_HOURS_START,
      WORKING_HOURS_END
    );
    console.log("⏳ Overlapping Hours:", overlappingHours);

    // 2. Generate *all* slot pairs from startDate..endDate
    let allPairs = generateAvailableSlots(
      updatedStartDate,
      updatedEndDate,
      overlappingHours,
      durationInMinutes
    );
    console.log("📅 Total Slots Generated:", allPairs.length);

    // 3. Filter out booked or previously created
    allPairs = filterOutBooked(allPairs, bookedSlots, previouslyCreated);
    console.log("❌ After Filtering Booked Slots:", allPairs.length);

    // 4. Pick up to 2–3 pairs per day
    selectedPairs = pickPairsPerDay(allPairs, MIN_SLOTS_REQUIRED, 3);
    console.log(`✅ Found ${selectedPairs.length} suitable slots`);

    if (selectedPairs.length >= MIN_SLOTS_REQUIRED) {
      break; // Enough slots found
    }

    // 5. Expand search range if needed
    updatedEndDate.setUTCDate(updatedEndDate.getUTCDate() + 1);
    maxDaysToAdd--;

    if (maxDaysToAdd === 0 && selectedPairs.length < MIN_SLOTS_REQUIRED) {
      if (expansionAttempts >= 3) {
        console.error("❌ Maximum working hours expansion reached. Stopping search.");
        break;
      }

      console.log("⚠️ Expanding working hours...");
      if (WORKING_HOURS_START > 0) WORKING_HOURS_START -= 1;
      if (WORKING_HOURS_END < 24) WORKING_HOURS_END += 1;
      maxDaysToAdd = 7; // Reset counter
      expansionAttempts++; // Track expansions
    }
  }

  // If we got at least 1 pair, create the poll
  if (selectedPairs.length > 0) {
    const finalSlots = selectedPairs.flatMap(({ start, end }) => [start, end]);
    console.log("📤 Sending slots to generatePoll:", finalSlots);

    try {
      const pollResult = await generatePoll(finalSlots, poll);
      if (pollResult) {
        console.log("✅ Poll created successfully:", pollResult);
        return pollResult; // Return poll result for further use
      } else {
        console.error("❌ Failed to create poll.");
        return null;
      }
    } catch (error) {
      console.error("❌ Error generating poll:", error);
      return null;
    }
  } else {
    console.error("❌ No available slots found.");
    return null;
  }
}

// Make function globally accessible
window.runProcess = runProcess;


  function filterOutBooked(slotPairs, bookedSlots, previouslyCreated) {
    // Convert arrays to Sets for faster lookup
    const bookedSet = new Set(bookedSlots);
    const createdSet = new Set(previouslyCreated);

    return slotPairs.filter(({ start, end }) => {
      const key = `${start}_${end}`;
      // Keep the pair only if it's NOT in bookedSet or createdSet
      return !bookedSet.has(key) && !createdSet.has(key);
    });
  }

  function pickPairsPerDay(slotPairs, maxTotalPairs = 40, pairsPerDay = 3) {
    const groupedByDay = {};
    for (const pair of slotPairs) {
      const dayKey = pair.start.substring(0, 10);
      if (!groupedByDay[dayKey]) {
        groupedByDay[dayKey] = [];
      }
      groupedByDay[dayKey].push(pair);
    }

    const sortedDays = Object.keys(groupedByDay).sort();

    const selected = [];
    for (const day of sortedDays) {
      // Sort by time
      groupedByDay[day].sort((a, b) => a.start.localeCompare(b.start));

      const daySlots = groupedByDay[day];
      const total = daySlots.length;

      // If the day doesn't have enough slots to fill "all segments"
      // just take as many as we can (up to pairsPerDay)
      if (total <= pairsPerDay) {
        // pick them all (or pick the entire day if you prefer)
        for (const p of daySlots.slice(0, pairsPerDay)) {
          selected.push(p);
          if (selected.length >= maxTotalPairs) {
            return selected;
          }
        }
      } else {
        // do the segmentation approach
        const segmentSize = Math.floor(total / 3);

        let picksForThisDay = [];

        // Segment 1 (morning)
        if (segmentSize > 0 && picksForThisDay.length < pairsPerDay) {
          picksForThisDay.push(daySlots[0]);
        }
        // Segment 2 (midday)
        if (
          segmentSize > 0 &&
          2 * segmentSize < total &&
          picksForThisDay.length < pairsPerDay
        ) {
          picksForThisDay.push(daySlots[segmentSize]);
        }
        // Segment 3 (evening)
        if (
          segmentSize > 0 &&
          3 * segmentSize < total &&
          picksForThisDay.length < pairsPerDay
        ) {
          picksForThisDay.push(daySlots[2 * segmentSize]);
        }

        // If you still have space to pick more within the same day
        // (for example, if pairsPerDay is 3 but you only picked 2),
        // you can pick from the remaining times as a fallback:
        while (
          picksForThisDay.length < pairsPerDay &&
          picksForThisDay.length < daySlots.length
        ) {
          picksForThisDay.push(daySlots[picksForThisDay.length]);
        }

        // Add the picks for this day to the global selection
        for (const p of picksForThisDay) {
          selected.push(p);
          if (selected.length >= maxTotalPairs) {
            return selected;
          }
        }
      }
    }

    return selected;
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
        let utcTime = new Date(currentDate);
        utcTime.setUTCHours(hour, 0, 0, 0);

        let endTime = new Date(utcTime);
        endTime.setMinutes(utcTime.getMinutes() + durationInMinutes);

        availableSlots.push({
          start: utcTime.toISOString().replace(".000Z", "Z"),
          end: endTime.toISOString().replace(".000Z", "Z"),
        });
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return availableSlots; // Return all pairs
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

  // Make function globally accessible
window.generate42CalendarDates = generate42CalendarDates;

  function generate42CalendarDatesUserTimeZone(
    anchorDate,
    isStart,
    offsetSeconds
  ) {
    // Parse the input anchor date (e.g., "2025-01-31") into year, month, and day.
    const [year, month, day] = anchorDate.split("-").map(Number);

    // Convert the anchor date to UTC (this is the original reference point)
    const anchorUTC = new Date(Date.UTC(year, month - 1, day));

    // Adjust for the user's time zone offset (offsetSeconds is in seconds)
    const anchorLocal = new Date(anchorUTC.getTime() + offsetSeconds * 1000);

    // Set the first day of the month in the user's time zone
    const firstDayLocal = new Date(
      Date.UTC(anchorLocal.getUTCFullYear(), anchorLocal.getUTCMonth(), 1)
    );

    // Find the nearest Sunday before or on the first day of the month (in the user's time zone)
    const dayOfWeek = firstDayLocal.getUTCDay(); // 0=Sunday, ..., 6=Saturday
    const nearestSundayLocal = new Date(
      firstDayLocal.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
    );

    // Generate 42 consecutive dates starting from the nearest Sunday (all adjusted to user's time zone)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dates = [];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(nearestSundayLocal.getTime() + i * oneDayMs);
      const adjustedDate = new Date(
        currentDate.getTime() - offsetSeconds * 1000
      ); // Convert back to UTC

      dates.push(adjustedDate.toISOString()); // Ensure consistent UTC format
    }

    // Output the dates to the appropriate function based on isStart.
    if (isStart) {
      bubble_fn_listOfStartDates(dates);
    } else {
      bubble_fn_listOfEndDates(dates);
    }
  }

  // Make function globally accessible
 window.generate42CalendarDatesUserTimeZone = generate42CalendarDatesUserTimeZone;

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

  // Make function globally accessible
  window.adjustDatesToOffset = adjustDatesToOffset;

  function generateStartTimes(startTime, duration) {
    // We'll ignore the provided duration and use 15 minutes instead.
    const fixedDuration = duration;
    const times = [];
    let [startHour, startMinute] = startTime.split(":").map(Number);

    // Convert start time to minutes from midnight
    let currentTimeInMinutes = startHour * 60 + startMinute;
    console.log("Initial start time in minutes:", currentTimeInMinutes);

    // Calculate the last possible start time so that a 15-minute event ends by midnight.
    // For a 15-minute duration, the event must start by 23:45.
    const endTimeInMinutes = 23 * 60 + (60 - fixedDuration);
    console.log("End time in minutes:", endTimeInMinutes);

    // Always increment by 15 minutes
    while (currentTimeInMinutes <= endTimeInMinutes) {
      const hours = Math.floor(currentTimeInMinutes / 60);
      const minutes = currentTimeInMinutes % 60;
      const time = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      times.push(time);
      console.log("Generated start time:", time);
      currentTimeInMinutes += fixedDuration;
      console.log("Next start time in minutes:", currentTimeInMinutes);
    }

    console.log("starttimes", times);
    bubble_fn_startTime(times);
  }

  // Make function globally accessible
window.generateStartTimes = generateStartTimes;

  function generateEndTimes(startTime, duration) {
    // We'll ignore the provided duration and use a fixed duration of 15 minutes.
    const fixedDuration = duration;
    const times = [];
    let [startHour, startMinute] = startTime.split(":").map(Number);

    // Convert the start time to minutes from midnight and add the fixed duration
    // to get the initial end time.
    let currentTimeInMinutes = startHour * 60 + startMinute + fixedDuration;
    console.log("Initial end time in minutes:", currentTimeInMinutes);

    // Set the final boundary to 24:00 (1440 minutes)
    const endTimeInMinutes = 24 * 60;
    console.log("Final end time in minutes:", endTimeInMinutes);

    // Always increment by 15 minutes (the fixed duration)
    while (currentTimeInMinutes <= endTimeInMinutes) {
      const hours = Math.floor(currentTimeInMinutes / 60);
      const minutes = currentTimeInMinutes % 60;
      const time = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      times.push(time);
      console.log("Generated end time:", time);
      currentTimeInMinutes += fixedDuration;
      console.log("Next end time in minutes:", currentTimeInMinutes);
    }

    console.log("endtimes", times);
    bubble_fn_endTime(times);
  }

  // Make function globally accessible
  window.generateEndTimes = generateEndTimes;

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

  // Make function globally accessible
  window.findOverlappingTimeRanges = findOverlappingTimeRanges;

  function generateSlotsForWeek(
    mainAvailability,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableHour
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

    // Calculate the earliest bookable time (now + earliestBookableHour)
    const earliestBookableTime = moment()
      .utc()
      .add(earliestBookableHour, "hours");

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

    // Filter out slots before the earliest bookable time
    const filteredSlots = mainSlots.filter((slot) => {
      const slotStart = moment.utc(slot[0]);
      return slotStart.isSameOrAfter(earliestBookableTime);
    });

    // Exclude already booked slots
    const availableSlots = filteredSlots.filter((slot) => {
      const slotStart = moment.utc(slot[0]);
      const slotEnd = moment.utc(slot[1]);

      const isOverlapping = alreadyBookedList.some((booked) => {
        const bookedStart = moment.utc(booked.start_date);
        const bookedEnd = moment.utc(booked.end_date);

        return (
          (slotStart.isSameOrAfter(bookedStart) &&
            slotStart.isBefore(bookedEnd)) ||
          (slotEnd.isAfter(bookedStart) && slotEnd.isSameOrBefore(bookedEnd)) ||
          (slotStart.isSameOrBefore(bookedStart) &&
            slotEnd.isSameOrAfter(bookedEnd))
        );
      });

      return !isOverlapping;
    });

    return availableSlots;
  }

  function generateWeekRanges(viewerDate, offset, userOffsetInSeconds) {
    const moment = window.moment; // Ensure moment.js is loaded

    // Parse viewerDate as UTC to prevent local time interpretation
    const viewerDateUTC = moment.utc(viewerDate, "YYYY-MM-DD");

    // Adjust viewerDate based on the offset (number of weeks)
    const adjustedViewerDate = viewerDateUTC
      .add(offset, "weeks")
      .startOf("day")
      .subtract(userOffsetInSeconds, "seconds"); // Convert local midnight to UTC

    const weekRanges = [];
    for (let i = 0; i < 7; i++) {
      const dayStartUTC = adjustedViewerDate.clone().add(i, "days");
      const dayEndUTC = dayStartUTC.clone().add(1, "day").subtract(1, "second");

      weekRanges.push([dayStartUTC.toISOString(), dayEndUTC.toISOString()]);
    }

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
        const dayOffsets = Array.from({ length: 15 }, (_, i) => i - 7);

        // Propagate slots for this week range
        addSlotForWeekRange(slotStart, dayOffsets, slotDuration, weekRange);
      });
    });

    return Array.from(allPossibleSlots)
      .map((slotPair) => JSON.parse(slotPair))
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  }

  function checkTime(start, end, duration) {
    // Return early if start or end is not provided.
    if (!start || !end) {
      return;
    }

    // If duration is null, undefined, or an empty string, treat it as 0.
    duration = duration ? Number(duration) : 0;

    // Parse start and end times (e.g., "08:00" => [8, 0]).
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);

    // Convert times to minutes since midnight.
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    const timeDifference = endTotalMinutes - startTotalMinutes;

    // ---- New round/not-round checks ----
    if (duration === 60) {
      // If start is on the half-hour, mark startNotRound="yes"
      if (startMinute === 30) {
        bubble_fn_startNotRound("yes");
      }
      // If end is on the half-hour, mark endNotRound="yes"
      if (endMinute === 30) {
        bubble_fn_endNotRound("yes");
      }
    } else if (duration === 30 || duration === 0) {
      // For 30 or no duration, mark both as "no"
      bubble_fn_startNotRound("no");
      bubble_fn_endNotRound("no");
    }
    // ------------------------------------

    // Rule 1: If start time is after or equal to end time, return "no".
    if (startTotalMinutes >= endTotalMinutes) {
      bubble_fn_isAfter("no");
      return;
    }

    // Rule 2: If duration < 30, check if the time difference is at least 30 minutes.
    if (duration < 30) {
      bubble_fn_isAfter(timeDifference >= 30 ? "yes" : "no");
      return;
    }

    // Rule 3: If duration ≥ 30, check if start + duration is within the end time.
    bubble_fn_isAfter(
      startTotalMinutes + duration <= endTotalMinutes ? "yes" : "no"
    );
  }

  // Make function globally accessible
  window.checkTime = checkTime;




  // Wrapper function
function generateScheduleWrapper(
  mainAvailability,
  viewerDate,
  alreadyBookedList,
  modifiedSlots,
  offset,
  userOffsetInSeconds,
  earliestBookableHour,
  blockedByUser
) {
  console.log("generateScheduleWrapper - Inputs:");
  console.log("mainAvailability:", mainAvailability);
  console.log("viewerDate:", viewerDate);
  console.log("alreadyBookedList:", alreadyBookedList);
  console.log("modifiedSlots:", modifiedSlots);
  console.log("offset:", offset);
  console.log("userOffsetInSeconds:", userOffsetInSeconds);
  console.log("earliestBookableHour:", earliestBookableHour);
  console.log("blockedByUser:", blockedByUser);

  // Generate the slots for the expanded range (-2 days to +9 days)
  const slots = generateSlotsForWeek(
    mainAvailability,
    viewerDate,
    alreadyBookedList,
    offset,
    userOffsetInSeconds,
    earliestBookableHour,
    blockedByUser
  );

  console.log("Slots:", slots);

  // Generate the week ranges
  const weekRanges = generateWeekRanges(
    viewerDate,
    offset,
    userOffsetInSeconds
  );

  const allPossibleSlots = generateAllPossibleSlots(slots, weekRanges);

  console.log("allPossibleSlots:", allPossibleSlots);

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

  const output = {
    outputlist1,
    outputlist2,
    outputlist4,
    outputlist9,
    outputlist5,
    outputlist6,
    outputlist8,
    outputlist7,
  };

  // Send result to Bubble
  bubble_fn_hours(output);

  return output;
}

// Make function globally accessible
window.generateScheduleWrapper = generateScheduleWrapper;
