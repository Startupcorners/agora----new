export const checkOverlaps = async function () {
export const checkOverlaps = async function () {
  const moment = require("moment-timezone");

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
  function findOverlappingSlots(availabilities, bookedSlots, earliestBookableDate = 0) {
    let userSlots = {};

    availabilities.forEach((availability) => {
      const userId = availability.userId;
      const slots = generateUserSlots(
        availability.daily_start_time,
        availability.daily_end_time,
        availability.slot_duration_minutes,
        availability.excludedDays,
        availability.timeOffsetSeconds,
        availability.start_date,
        availability.end_date,
        earliestBookableDate
      );

      if (!userSlots[userId]) {
        userSlots[userId] = new Set(slots);
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
          [...overlappingSlots].filter((slot) => userSlots[userIds[i]].has(slot))
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

    return [...overlappingSlots];
  }

  // Example usage with availability data and booked slots
function checkCommonAvailableSlots(availabilities, bookedSlots, earliestBookableDate) {
    const availableSlots = findOverlappingSlots(availabilities, bookedSlots, earliestBookableDate);
    console.log(`Available Slots Count: ${availableSlots.length}`);
    
    if (availableSlots.length === 0) {
        console.log("No available slots found.");
    }

    return availableSlots;
}


  return {
    checkCommonAvailableSlots,
  };
};

window["checkOverlaps"] = checkOverlaps;
