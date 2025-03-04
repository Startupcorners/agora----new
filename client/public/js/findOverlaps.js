  // Function to generate slots for each user while considering excluded days, time offset, availability period, and earliest bookable date
  function generateUserSlots(
    dailyStartTime,
    dailyEndTime,
    slotDuration,
    excludedDays,
    timeOffsetSeconds,
    startDate,
    endDate,
    earliestBookableHour
  ) {
    console.log("dailyStartTime:", dailyStartTime);
    console.log("dailyEndTime:", dailyEndTime);
    console.log("slotDuration:", slotDuration);
    console.log("excludedDays:", excludedDays);
    console.log("timeOffsetSeconds:", timeOffsetSeconds);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);
    console.log("earliestBookableHour:", earliestBookableHour);

    // Convert offset seconds to minutes
    const localOffset = timeOffsetSeconds / 60;

    // Start-of-day (in the user's offset), plus earliestBookableHour
    const now = moment()
      .utcOffset(localOffset)
      .startOf("day")
      .add(earliestBookableHour, "hours");

    // Whichever is later: startDate or now
    let startDay = moment(startDate, "YYYY-MM-DD")
      .utcOffset(localOffset)
      .startOf("day");
    if (startDay.isBefore(now)) {
      startDay = now;
    }

    const endDay = moment(endDate, "YYYY-MM-DD")
      .utcOffset(localOffset)
      .endOf("day");

    let slots = [];

    for (let day = 0; day < 7; day++) {
      const currentDay = startDay.clone().add(day, "days");

      // Stop if we've passed the end date
      if (currentDay.isAfter(endDay)) break;

      // Skip excluded days (Sunday=0 in JS)
      if (excludedDays.includes(currentDay.isoWeekday() % 7)) {
        continue;
      }

      // Create start/end time for this day using the same offset
      const startTime = moment(dailyStartTime, "HH:mm").utcOffset(localOffset);
      const endTime = moment(dailyEndTime, "HH:mm").utcOffset(localOffset);

      let startDt = currentDay.clone().set({
        hour: startTime.hour(),
        minute: startTime.minute(),
        second: 0,
        millisecond: 0,
      });

      let endDt = currentDay.clone().set({
        hour: endTime.hour(),
        minute: endTime.minute(),
        second: 0,
        millisecond: 0,
      });

      while (
        startDt.clone().add(slotDuration, "minutes").isSameOrBefore(endDt)
      ) {
        if (startDt.isBetween(startDay, endDay, null, "[]")) {
          slots.push(startDt.toISOString());
        }
        startDt.add(slotDuration, "minutes");
      }
    }

    return slots;
  }




  // Function to process availabilities and find overlapping slots, filtering out booked slots
  function findOverlappingSlots(
    mainAvailabilities, // array of "main" bubble IDs (?)
    availabilities, // array of objects, each describing 1 user's availability blocks
    bookedSlots, // array of objects with {start_date, end_date}
    earliestBookableHour
  ) {
    // Maps an ISO-string slot key -> object: { start, end, bubbleIds }
    const slotMap = new Map();

    // Maps bubbleId -> userId
    const bubbleIdToUser = new Map();

    // ---
    // STEP 1: Generate all individual slots per availability, store them in `slotMap`.
    //         Each availability presumably has a single slot duration, start_time, end_time, etc.
    // ---
    availabilities.forEach((availability) => {
      const bubbleId = availability.bubbleId;
      const userId = availability.userId;
      const slotDuration = availability.slot_duration_minutes;

      // You’ll need generateUserSlots to return something like:
      //   [ { start: "2025-01-01T10:00:00Z", end: "2025-01-01T10:15:00Z" }, ... ]
      // OR you can calculate `end` locally if generateUserSlots only returns start times.
      const slots = generateUserSlots(
        availability.daily_start_time,
        availability.daily_end_time,
        slotDuration,
        availability.excludedDays,
        availability.timeOffsetSeconds,
        availability.start_date,
        availability.end_date,
        earliestBookableHour
      );

      console.log("generateUserSlots", generateUserSlots);

      bubbleIdToUser.set(bubbleId, userId);

      slots.forEach((slotObj) => {
        // If `slotObj` is just a start time string, convert to moment and create an end.
        // For example:
        const slotStart = moment(slotObj.start ?? slotObj); // fallback if you only get a string
        const slotEnd = slotObj.end
          ? moment(slotObj.end)
          : slotStart.clone().add(slotDuration, "minutes"); // fallback if needed

        // Use ISO-string of the start as the unique key
        const slotKey = slotStart.toISOString();

        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, {
            start: slotStart,
            end: slotEnd,
            bubbleIds: new Set(),
          });
        }
        slotMap.get(slotKey).bubbleIds.add(bubbleId);
      });
    });

    // ---
    // STEP 2: Filter down to only those slots that involve more than 1 bubbleId.
    //     (Note: This alone doesn't guarantee "all users." We'll handle that in Step 4.)
    // ---
    const multiBubbleSlots = new Map();
    slotMap.forEach((slotData, slotKey) => {
      if (slotData.bubbleIds.size > 1) {
        multiBubbleSlots.set(slotKey, slotData);
      }
    });

    // ---
    // STEP 3: Remove slots that overlap any booked slot (using interval overlap check).
    //
    // The classic overlap condition between two intervals:
    //   A overlaps B if A.start < B.end && A.end > B.start
    // ---
    bookedSlots.forEach((bookedSlot) => {
      const bookedStart = moment(bookedSlot.start_date);
      const bookedEnd = moment(bookedSlot.end_date);

      multiBubbleSlots.forEach((slotData, slotKey) => {
        const { start: slotStart, end: slotEnd } = slotData;
        // Remove if they overlap in *any* way
        if (slotStart.isBefore(bookedEnd) && slotEnd.isAfter(bookedStart)) {
          multiBubbleSlots.delete(slotKey);
        }
      });
    });

    // ---
    // STEP 4: Among the remaining slots, keep only those that contain *all* required users.
    //
    // We'll do that by building a set of the userIds in each slot, then comparing to
    // the set of *all* userIds we expected from `availabilities`.
    // ---
    const requiredUsers = new Set(availabilities.map((a) => a.userId));
    const intersectingMainAvailabilityBubbleIds = new Set();
    const intersectingNonMainAvailabilityBubbleIds = new Set();
    const validSlots = [];

    multiBubbleSlots.forEach(({ start, end, bubbleIds }) => {
      // Build set of userIds found in this slot
      const usersInSlot = new Set();
      bubbleIds.forEach((bId) => {
        usersInSlot.add(bubbleIdToUser.get(bId));
      });

      // Check if it covers all distinct users
      if (usersInSlot.size === requiredUsers.size) {
        validSlots.push({
          start: start.toISOString(),
          end: end.toISOString(),
        });

        // Then see which bubbleIds were main vs. non-main
        bubbleIds.forEach((bId) => {
          if (mainAvailabilities.includes(bId)) {
            intersectingMainAvailabilityBubbleIds.add(bId);
          } else {
            intersectingNonMainAvailabilityBubbleIds.add(bId);
          }
        });
      }
    });

    // If no valid slots exist, return empty arrays
    if (validSlots.length === 0) {
      return {
        intersectingMainAvailabilityBubbleIds: [],
        intersectingNonMainAvailabilityBubbleIds: [],
        overlappingSlots: [],
      };
    }

    // Otherwise, we return the sets as arrays
    return {
      intersectingMainAvailabilityBubbleIds: [
        ...intersectingMainAvailabilityBubbleIds,
      ],
      intersectingNonMainAvailabilityBubbleIds: [
        ...intersectingNonMainAvailabilityBubbleIds,
      ],
      overlappingSlots: validSlots,
    };
  }



  // Example usage with availability data and booked slots
function checkCommonAvailableSlots(
  mainAvailabilities,
  availabilities,
  bookedSlots,
  earliestBookableHour,
  duration,
  totalUsers
) {
  console.log("checkCommonAvailableSlots called with:");
  console.log("mainAvailabilities:", mainAvailabilities);
  console.log("availabilities:", availabilities);
  console.log("bookedSlots:", bookedSlots);
  console.log("earliestBookableDate:", earliestBookableHour);

  // Count unique userIds in availabilities
  const uniqueUserIds = new Set(availabilities.map((a) => a.userId)).size;

  // If not all users have availabilities, treat it as no overlapping slots
  if (totalUsers > uniqueUserIds) {
    console.log(
      "Not all users have availabilities. Treating as no overlapping slots."
    );

    if (duration === 30) {
      bubble_fn_overlapsShort("no");
    } else {
      bubble_fn_overlapsLong("no");
    }

    return [];
  }

  const {
    intersectingMainAvailabilityBubbleIds,
    intersectingNonMainAvailabilityBubbleIds,
    overlappingSlots,
  } = findOverlappingSlots(
    mainAvailabilities,
    availabilities,
    bookedSlots,
    earliestBookableHour
  );

  console.log("findOverlappingSlots returned:");
  console.log(
    "intersectingMainAvailabilityBubbleIds:",
    intersectingMainAvailabilityBubbleIds
  );
  console.log(
    "intersectingNonMainAvailabilityBubbleIds:",
    intersectingNonMainAvailabilityBubbleIds
  );
  console.log("overlappingSlots:", overlappingSlots);

  if (overlappingSlots.length > 0) {
    if (duration === 30) {
      bubble_fn_overlapsShort("yes");
      bubble_fn_availabilityIdsShort({
        outputlist1: intersectingMainAvailabilityBubbleIds,
        outputlist2: intersectingNonMainAvailabilityBubbleIds,
      });
    } else {
      bubble_fn_overlapsLong("yes");
      bubble_fn_availabilityIdsLong({
        outputlist1: intersectingMainAvailabilityBubbleIds,
        outputlist2: intersectingNonMainAvailabilityBubbleIds,
      });
    }
  } else {
    if (duration === 30) {
      bubble_fn_overlapsShort("no");
    } else {
      bubble_fn_overlapsLong("no");
    }
  }

  return overlappingSlots;
}




function checkCommonAvailableSlotsWrapper(
  mainAvailabilitiesShort,
  availabilitiesShort,
  earliestBookableHourShort,
  mainAvailabilitiesLong,
  availabilitiesLong,
  bookedSlots,
  earliestBookableHourLong,
  totalUsers
) {
  console.log("checkCommonAvailableSlotsWrapper called");

  // Run the function for short duration slots
  console.log("Running checkCommonAvailableSlots for short slots...");
  const overlappingSlotsShort = checkCommonAvailableSlots(
    mainAvailabilitiesShort,
    availabilitiesShort,
    bookedSlots,
    earliestBookableHourShort,
    30,
    totalUsers
  );

  // Run the function for long duration slots
  console.log("Running checkCommonAvailableSlots for long slots...");
  const overlappingSlotsLong = checkCommonAvailableSlots(
    mainAvailabilitiesLong,
    availabilitiesLong,
    bookedSlots,
    earliestBookableHourLong,
    60,
    totalUsers
  );

  console.log("Short overlapping slots:", overlappingSlotsShort);
  console.log("Long overlapping slots:", overlappingSlotsLong);

  // Notify Bubble that processing is complete
  console.log("All checks complete, calling bubble_fn_finishedLoading()");
  bubble_fn_finishedLoading();
}

window.checkCommonAvailableSlotsWrapper = checkCommonAvailableSlotsWrapper;