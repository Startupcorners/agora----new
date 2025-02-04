export const checkOverlaps = async function () {
  // Function to generate slots for each user while considering excluded days, time offset, availability period, and earliest bookable date
  // Helper to merge an array of intervals that are contiguous.
  // Each interval is an object with { start: moment, end: moment, bubbleIds?: Set, bubbleId }
  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    // Sort intervals by start time
    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    // Initialize the first merged interval using the first interval.
    let current = {
      ...intervals[0],
      bubbleIds: new Set([
        intervals[0].bubbleIds
          ? [...intervals[0].bubbleIds]
          : intervals[0].bubbleId,
      ]),
    };

    for (let i = 1; i < intervals.length; i++) {
      const interval = intervals[i];
      // If the current interval touches or overlaps the next one, merge them.
      if (current.end.isSame(interval.start)) {
        // Extend the end if necessary.
        current.end = moment.max(current.end, interval.end);
        // Accumulate bubbleIds.
        if (interval.bubbleId) current.bubbleIds.add(interval.bubbleId);
        if (interval.bubbleIds) {
          interval.bubbleIds.forEach((b) => current.bubbleIds.add(b));
        }
      } else {
        merged.push(current);
        current = {
          ...interval,
          bubbleIds: new Set([
            interval.bubbleIds ? [...interval.bubbleIds] : interval.bubbleId,
          ]),
        };
      }
    }
    merged.push(current);
    return merged;
  }

  // This function generates user slots for a week based on a user's daily start/end times,
  // slot duration, excluded days, time offset, and overall date range.
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
    const localTz = moment().utcOffset(timeOffsetSeconds / 60);
    // Calculate "now" at the start of the day plus the earliest bookable hour.
    const now = localTz.startOf("day").add(earliestBookableHour, "hours");

    // Determine the effective start day: the later of the provided startDate or now.
    const startDay = moment
      .tz(startDate, "YYYY-MM-DD", localTz.tz())
      .startOf("day")
      .isBefore(now)
      ? now
      : moment.tz(startDate, "YYYY-MM-DD", localTz.tz()).startOf("day");

    const endDay = moment.tz(endDate, "YYYY-MM-DD", localTz.tz()).endOf("day");

    let slots = [];

    // Generate slots for up to 7 days (or until endDay is reached).
    for (let day = 0; day < 7; day++) {
      const currentDay = startDay.clone().add(day, "days");

      if (currentDay.isAfter(endDay)) break;

      // Skip excluded days.
      if (excludedDays.includes(currentDay.isoWeekday() % 7)) continue;

      const startTime = moment.tz(dailyStartTime, "HH:mm", localTz.tz());
      const endTime = moment.tz(dailyEndTime, "HH:mm", localTz.tz());

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

  // Main function to process availabilities and find overlapping slots,
  // filtering out booked slots.
  function findOverlappingSlots(
    mainAvailabilities, // array of main bubble IDs
    availabilities, // array of objects, each describing one user's availability block
    bookedSlots, // array of objects with { start_date, end_date }
    earliestBookableHour
  ) {
    // Map: userId => array of raw slot intervals (each with start, end, bubbleId)
    const slotsByUser = new Map();
    // Also map bubbleId to userId for later reference.
    const bubbleIdToUser = new Map();

    // STEP 1: Generate individual slots per availability and group by user.
    availabilities.forEach((availability) => {
      const { bubbleId, userId, slot_duration_minutes } = availability;
      bubbleIdToUser.set(bubbleId, userId);

      // IMPORTANT: Make sure to pass earliestBookableHour correctly.
      const slots = generateUserSlots(
        availability.daily_start_time,
        availability.daily_end_time,
        slot_duration_minutes,
        availability.excludedDays,
        availability.timeOffsetSeconds,
        availability.start_date,
        availability.end_date,
        earliestBookableHour // <-- Pass earliestBookableHour here, not bubbleId.
      );

      // Convert each generated slot into an interval (using moment objects)
      slots.forEach((slotObj) => {
        const slotStart = moment(slotObj); // slotObj is a string from generateUserSlots
        const slotEnd = slotStart.clone().add(slot_duration_minutes, "minutes");
        const interval = { start: slotStart, end: slotEnd, bubbleId };

        if (!slotsByUser.has(userId)) {
          slotsByUser.set(userId, []);
        }
        slotsByUser.get(userId).push(interval);
      });
    });

    // STEP 2: For each user, merge contiguous slots into larger intervals.
    const mergedByUser = new Map();
    slotsByUser.forEach((intervals, userId) => {
      mergedByUser.set(userId, mergeIntervals(intervals));
    });

    // STEP 3: Identify required users from availabilities.
    const requiredUsers = new Set(availabilities.map((a) => a.userId));

    // STEP 4: For each main availability, treat its merged intervals as candidate overlapping intervals.
    // Then, check that every required user has at least one merged interval that fully covers the candidate.
    const validSlots = [];
    // To track which bubbleIds contributed:
    const intersectingMainAvailabilityBubbleIds = new Set();
    const intersectingNonMainAvailabilityBubbleIds = new Set();

    mainAvailabilities.forEach((mainBubbleId) => {
      const mainUser = bubbleIdToUser.get(mainBubbleId);
      if (!mainUser || !mergedByUser.has(mainUser)) return;

      mergedByUser.get(mainUser).forEach((mainInterval) => {
        let allCover = true;
        const contributingBubbles = new Map(); // userId -> array of bubbleIds

        requiredUsers.forEach((userId) => {
          const userMerged = mergedByUser.get(userId);
          if (!userMerged) {
            allCover = false;
            return;
          }
          // Find an interval from this user that fully covers the candidate main interval.
          const coveringInterval = userMerged.find(
            (iv) =>
              iv.start.isSameOrBefore(mainInterval.start) &&
              iv.end.isSameOrAfter(mainInterval.end)
          );
          if (coveringInterval) {
            contributingBubbles.set(
              userId,
              coveringInterval.bubbleIds
                ? Array.from(coveringInterval.bubbleIds)
                : [coveringInterval.bubbleId]
            );
          } else {
            allCover = false;
          }
        });

        if (allCover) {
          validSlots.push({
            start: mainInterval.start.toISOString(),
            end: mainInterval.end.toISOString(),
          });
          contributingBubbles.forEach((bubbleIds, userId) => {
            bubbleIds.forEach((bId) => {
              if (mainAvailabilities.includes(bId)) {
                intersectingMainAvailabilityBubbleIds.add(bId);
              } else {
                intersectingNonMainAvailabilityBubbleIds.add(bId);
              }
            });
          });
        }
      });
    });

    // STEP 5: Remove any valid overlapping slots that conflict with a booked slot.
    bookedSlots.forEach((bookedSlot) => {
      const bookedStart = moment(bookedSlot.start_date);
      const bookedEnd = moment(bookedSlot.end_date);
      for (let i = validSlots.length - 1; i >= 0; i--) {
        const slotStart = moment(validSlots[i].start);
        const slotEnd = moment(validSlots[i].end);
        if (slotStart.isBefore(bookedEnd) && slotEnd.isAfter(bookedStart)) {
          validSlots.splice(i, 1);
        }
      }
    });

    return {
      intersectingMainAvailabilityBubbleIds: Array.from(
        intersectingMainAvailabilityBubbleIds
      ),
      intersectingNonMainAvailabilityBubbleIds: Array.from(
        intersectingNonMainAvailabilityBubbleIds
      ),
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

  return {
    checkCommonAvailableSlotsWrapper,
  };
};

window["checkOverlaps"] = checkOverlaps;
