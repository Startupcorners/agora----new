export const checkOverlaps = async function () {

  // Function to generate slots for each user while considering excluded days, time offset, availability period, and earliest bookable date
  function generateUserSlots(
    dailyStartTime,
    dailyEndTime,
    slotDuration,
    excludedDays,
    timeOffsetSeconds,
    startDate,
    endDate,
    earliestBookableDate
  ) {
    const localTz = moment().utcOffset(timeOffsetSeconds / 60);
    const now = localTz.startOf("day").add(earliestBookableDate, "days");

    // Determine the effective start date (whichever is later: startDate or now + earliestBookableDate)
    const startDay = moment
      .tz(startDate, "YYYY-MM-DD", localTz.tz())
      .startOf("day")
      .isBefore(now)
      ? now
      : moment.tz(startDate, "YYYY-MM-DD", localTz.tz()).startOf("day");

    const endDay = moment.tz(endDate, "YYYY-MM-DD", localTz.tz()).endOf("day");

    let slots = [];

    for (let day = 0; day < 7; day++) {
      const currentDay = startDay.clone().add(day, "days");

      // Stop if we've passed the end date
      if (currentDay.isAfter(endDay)) break;

      // Skip excluded days (accounting for Sunday = 0 in JS, adjust to match user's convention)
      if (excludedDays.includes(currentDay.isoWeekday() % 7)) {
        continue;
      }

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

  // Function to process availabilities and find overlapping slots, filtering out booked slots
  function findOverlappingSlots(
    mainAvailabilities,
    availabilities,
    bookedSlots,
    earliestBookableDate = 0
  ) {
    let userSlots = {};
    let bubbleIdMap = {}; // Map userId to bubbleId for tracking

    availabilities.forEach((availability) => {
      const userId = availability.userId;
      const bubbleId = availability.bubbleId;
      const slots = generateUserSlots(
        availability.daily_start_time,
        availability.daily_end_time,
        availability.slot_duration_minutes,
        availability.excludedDays,
        availability.timeOffsetSeconds,
        availability.start_date,
        availability.end_date,
        bubbleId,
        earliestBookableDate
      );

      if (!userSlots[userId]) {
        userSlots[userId] = new Set(slots);
        bubbleIdMap[userId] = bubbleId;
      } else {
        slots.forEach((slot) => userSlots[userId].add(slot));
      }
    });

    // Find overlapping slots between users
    const userIds = Object.keys(userSlots);
    let overlappingSlots = new Set();

    if (userIds.length > 1) {
      overlappingSlots = new Set([...userSlots[userIds[0]]]);
      for (let i = 1; i < userIds.length; i++) {
        overlappingSlots = new Set(
          [...overlappingSlots].filter((slot) =>
            userSlots[userIds[i]].has(slot)
          )
        );
      }
    } else if (userIds.length === 1) {
      overlappingSlots = new Set(userSlots[userIds[0]]);
    }

    // Remove booked slots from available slots
    bookedSlots.forEach((bookedSlot) => {
      const bookedStart = moment(bookedSlot.start_date);
      const bookedEnd = moment(bookedSlot.end_date);

      overlappingSlots.forEach((slot) => {
        const slotMoment = moment(slot);
        if (slotMoment.isBetween(bookedStart, bookedEnd, null, "[)")) {
          overlappingSlots.delete(slot);
        }
      });
    });

    // Determine which bubbleIds intersect with mainAvailabilities
    let intersectingBubbleIds = new Set();
    let nonIntersectingBubbleIds = new Set();

    userIds.forEach((userId) => {
      const bubbleId = bubbleIdMap[userId];
      if (bubbleId) {
        const hasOverlap = [...userSlots[userId]].some((slot) =>
          overlappingSlots.has(slot)
        );

        if (hasOverlap && mainAvailabilities.includes(bubbleId)) {
          intersectingBubbleIds.add(bubbleId);
        } else if (!hasOverlap && mainAvailabilities.includes(bubbleId)) {
          nonIntersectingBubbleIds.add(bubbleId);
        }
      }
    });

    return {
      intersectingBubbleIds: [...intersectingBubbleIds],
      nonIntersectingBubbleIds: [...nonIntersectingBubbleIds],
      overlappingSlots: [...overlappingSlots], // Keep the overlapping slots for reference
    };
  }


  // Example usage with availability data and booked slots
function checkCommonAvailableSlots(
  mainAvailabilities,
  availabilities,
  bookedSlots,
  earliestBookableDate
) {
  console.log("checkCommonAvailableSlots called with:");
  console.log("mainAvailabilities:", mainAvailabilities);
  console.log("availabilities:", availabilities);
  console.log("bookedSlots:", bookedSlots);
  console.log("earliestBookableDate:", earliestBookableDate);

  const { intersectingBubbleIds, nonIntersectingBubbleIds, overlappingSlots } =
    findOverlappingSlots(
      mainAvailabilities,
      availabilities,
      bookedSlots,
      earliestBookableDate
    );

  console.log("findOverlappingSlots returned:");
  console.log("intersectingBubbleIds:", intersectingBubbleIds);
  console.log("nonIntersectingBubbleIds:", nonIntersectingBubbleIds);
  console.log("overlappingSlots:", overlappingSlots);

  if (overlappingSlots.length > 0) {
    bubble_fn_overlaps("yes");
    bubble_fn_availabilityIds({
      outputlist1: intersectingBubbleIds,
      outputlist2: nonIntersectingBubbleIds,
    });
  } else {
    bubble_fn_overlaps("no");
  }

  return overlappingSlots;
}




  return {
    checkCommonAvailableSlots,
  };
};

window["checkOverlaps"] = checkOverlaps;
