// Import Moment.js and Moment Timezone if using a module system
// If using in the browser, ensure Moment.js and Moment Timezone are included via script tags
import moment from "moment";
import "moment-timezone";

export const checkOverlaps = async function () {
  function generateLocalDateRanges({
    startDate,
    endDate,
    excludedDays,
    earliestBookableDay,
    dailyStartTime,
    dailyEndTime,
    timeOffsetSeconds,
  }) {
    console.log("Generating local date ranges...");
    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);
    console.log("Excluded Days:", excludedDays);
    console.log("Earliest Bookable Day:", earliestBookableDay);
    console.log("Daily Start Time:", dailyStartTime);
    console.log("Daily End Time:", dailyEndTime);
    console.log("Time Offset (seconds):", timeOffsetSeconds);

    const [startHour, startMinute] = dailyStartTime.split(":").map(Number);
    const [endHour, endMinute] = dailyEndTime.split(":").map(Number);

    const localOffsetMinutes = timeOffsetSeconds / 60;

    // Parse start and end dates in UTC, then shift to local time
    let localStart = moment
      .utc(startDate)
      .utcOffset(localOffsetMinutes)
      .startOf("day");

    let localEnd = moment
      .utc(endDate)
      .utcOffset(localOffsetMinutes)
      .endOf("day");

    // Apply the constraint to not generate past today + 7 days in local time
    const maxEnd = moment
      .utc()
      .utcOffset(localOffsetMinutes)
      .startOf("day")
      .add(7, "days");
    localEnd = moment.min(localEnd, maxEnd);

    // Calculate the earliest possible start date based on earliestBookableDay
    const earliestStart = moment
      .utc()
      .utcOffset(localOffsetMinutes)
      .startOf("day")
      .add(earliestBookableDay, "days");

    // Ensure localStart is not before now + earliestBookableDay
    localStart = moment.max(localStart, earliestStart);

    // Ensure localStart is not before today in local time
    const nowLocal = moment.utc().utcOffset(localOffsetMinutes).startOf("day");
    localStart = moment.max(localStart, nowLocal);

    const ranges = [];
    let current = localStart.clone();

    while (current.isSameOrBefore(localEnd, "day")) {
      if (!excludedDays.includes(current.day())) {
        // 0 = Sunday, 6 = Saturday
        // Set daily start and end times in local time
        const dayStart = current.clone().set({
          hour: startHour,
          minute: startMinute,
          second: 0,
          millisecond: 0,
        });
        let dayEnd = current
          .clone()
          .set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

        // If end time is before start time, assume it crosses to next day
        if (dayEnd.isBefore(dayStart)) {
          dayEnd.add(1, "day");
        }

        ranges.push([dayStart.clone(), dayEnd.clone()]);
      }
      current.add(1, "day");
    }

    return ranges;
  }


  // Step 2: Convert Local Date Ranges to UTC

  function convertRangesToUTC(rangesLocal) {
    return rangesLocal.map(([localStart, localEnd]) => {
      const utcStart = localStart.clone().utc();
      const utcEnd = localEnd.clone().utc();
      return [utcStart, utcEnd];
    });
  }

  // Step 2.5: Find overlapping UTC date ranges
  function findOverlappingDateRanges(rangesA, rangesB) {
    const overlappingRanges = [];

    for (const [startA, endA] of rangesA) {
      for (const [startB, endB] of rangesB) {
        // Check for overlap between the date ranges
        if (startA.isBefore(endB) && endA.isAfter(startB)) {
          const overlapStart = moment.max(startA, startB);
          const overlapEnd = moment.min(endA, endB);
          overlappingRanges.push([overlapStart, overlapEnd]);
        }
      }
    }

    return overlappingRanges;
  }

  //Step 3: Generate UTC Time Slots
  function generateTimeSlotsUTC(utcStart, utcEnd, slotDurationMinutes) {
    const slots = [];
    let current = utcStart.clone();

    while (current.isBefore(utcEnd)) {
      const slotStart = current.clone();
      const slotEnd = current.clone().add(slotDurationMinutes, "minutes");

      if (slotEnd.isAfter(utcEnd)) {
        break; // Do not include partial slots that exceed the range
      }

      slots.push([slotStart.clone(), slotEnd.clone()]);
      current.add(slotDurationMinutes, "minutes");
    }

    return slots;
  }

  //Step 4: Filter Out Already Booked Slots

  function filterAlreadyBookedSlotsUTC(allSlotsUTC, alreadyBookedListUTC) {
    return allSlotsUTC.filter(([slotStart, slotEnd]) => {
      return !alreadyBookedListUTC.some(([bookedStart, bookedEnd]) => {
        // Overlap exists if slotStart < bookedEnd AND slotEnd > bookedStart
        return slotStart.isBefore(bookedEnd) && slotEnd.isAfter(bookedStart);
      });
    });
  }

  //Step 5: Intersect Slot Lists Across Users

  function intersectSlotListsUTC(slotsA, slotsB) {
    const common = [];

    for (const [startA, endA] of slotsA) {
      for (const [startB, endB] of slotsB) {
        // Check if slotA is completely within slotB
        if (startA.isSameOrAfter(startB) && endA.isSameOrBefore(endB)) {
          common.push([startA.clone(), endA.clone()]);
        }
      }
    }

    return common;
  }

  //Main Function: Check Common Available Slots

  async function checkCommonAvailableSlots(
    allAvailabilities,
    alreadyBookedList,
    earliestBookableDay
  ) {
    // Convert alreadyBookedList to UTC moments
    const alreadyBookedListUTC = alreadyBookedList.map(
      ([bookedStart, bookedEnd]) => [
        moment.utc(bookedStart),
        moment.utc(bookedEnd),
      ]
    );

    let commonSlots = null;

    for (const userAvailability of allAvailabilities) {
      const {
        start_date,
        end_date,
        daily_start_time,
        daily_end_time,
        slot_duration_minutes,
        excludedDays,
        timeOffsetSeconds,
      } = userAvailability;

      // Step 1: Generate local date ranges
      const localDateRanges = generateLocalDateRanges({
        startDate: start_date,
        endDate: end_date,
        excludedDays,
        earliestBookableDay,
        dailyStartTime: daily_start_time,
        dailyEndTime: daily_end_time,
        timeOffsetSeconds,
      });

      // Step 2: Convert date ranges to UTC
      const utcDateRanges = convertRangesToUTC(localDateRanges);

      // Step 2.5: Find overlapping date ranges
      if (commonDateRangesUTC === null) {
        commonDateRangesUTC = utcDateRanges;
      } else {
        commonDateRangesUTC = findOverlappingDateRanges(
          commonDateRangesUTC,
          utcDateRanges
        );

        // Early exit if no overlapping date ranges remain
        if (commonDateRangesUTC.length === 0) {
          return "no";
        }
      }

      // Step 3: Generate time slots in UTC based on overlapping date ranges
      let userSlotsUTC = [];
      for (const [utcRangeStart, utcRangeEnd] of commonDateRangesUTC) {
        const slots = generateTimeSlotsUTC(
          utcRangeStart,
          utcRangeEnd,
          slot_duration_minutes
        );
        userSlotsUTC.push(...slots);
      }

      // Step 4: Filter out already booked slots
      userSlotsUTC = filterAlreadyBookedSlotsUTC(
        userSlotsUTC,
        alreadyBookedListUTC
      );

      // Step 5: Intersect with common slots
      if (commonSlots === null) {
        // First user's available slots
        commonSlots = userSlotsUTC;
      } else {
        // Intersect with existing common slots
        commonSlots = intersectSlotListsUTC(commonSlots, userSlotsUTC);
      }

      // Early exit if no common slots remain
      if (commonSlots.length === 0) {
        return "no";
      }
    }

    // After processing all users, determine if any common slots exist
    return commonSlots.length > 0 ? "yes" : "no";
  }

  return {
    checkCommonAvailableSlots,
  };
};

// Attach to window for Bubble (if working in a browser environment)
window["checkOverlaps"] = checkOverlaps;
