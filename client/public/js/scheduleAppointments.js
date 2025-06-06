 function generateSlotsForWeek(
   mainAvailability,
   allAvailabilityLists,
   viewerDate,
   alreadyBookedList,
   offset,
   userOffsetInSeconds,
   earliestBookableHour,
   blockedByUserList
 ) {
   console.log("blocked", blockedByUserList);
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

   // Filter slots by availability date range
   function filterByAvailabilityDateRange(slots, availability) {
     // Convert availability start/end dates to UTC with timezone adjustment
     const availabilityStart = availability.start_date
       ? moment
           .utc(availability.start_date)
           .startOf("day")
           .subtract(availability.timeOffsetSeconds, "seconds")
       : moment.utc().subtract(100, "years"); // If no start date, use a date far in the past

     const availabilityEnd = availability.end_date
       ? moment
           .utc(availability.end_date)
           .endOf("day")
           .subtract(availability.timeOffsetSeconds, "seconds")
       : moment.utc().add(100, "years"); // If no end date, use a date far in the future

     return slots.filter((slot) => {
       const slotStart = moment.utc(slot[0]);
       return (
         slotStart.isSameOrAfter(availabilityStart) &&
         slotStart.isBefore(availabilityEnd)
       );
     });
   }

   // Apply availability date range filter to main slots
   const mainSlotsFiltered = filterByAvailabilityDateRange(
     mainSlots,
     mainAvailability
   );

   // Function to filter out slots that overlap with blocked or booked lists
   function filterOutOverlappingSlots(slots, blockedList) {
     return slots.filter((slot) => {
       const slotStart = moment.utc(slot[0]);
       const slotEnd = moment.utc(slot[1]);

       const isOverlapping = blockedList.some((blocked) => {
         const blockedStart = moment.utc(blocked.start_date);
         const blockedEnd = moment.utc(blocked.end_date);

         return (
           (slotStart.isSameOrAfter(blockedStart) &&
             slotStart.isBefore(blockedEnd)) ||
           (slotEnd.isAfter(blockedStart) &&
             slotEnd.isSameOrBefore(blockedEnd)) ||
           (slotStart.isSameOrBefore(blockedStart) &&
             slotEnd.isSameOrAfter(blockedEnd))
         );
       });

       return !isOverlapping;
     });
   }

   // If allAvailabilityLists is empty, filter mainSlots by earliestBookableTime and alreadyBookedList
   if (!allAvailabilityLists || allAvailabilityLists.length === 0) {
     // Filter slots by earliestBookableTime
     let filteredSlots = mainSlotsFiltered.filter((slot) => {
       const slotStart = moment.utc(slot[0]);
       return slotStart.isSameOrAfter(earliestBookableTime);
     });

     // Exclude already booked slots
     filteredSlots = filterOutOverlappingSlots(
       filteredSlots,
       alreadyBookedList
     );

     // Exclude blocked slots
     filteredSlots = filterOutOverlappingSlots(
       filteredSlots,
       blockedByUserList
     );

     return filteredSlots;
   }

   // Generate other availability slots and find common slots
   let commonSlots = [...mainSlotsFiltered];
   allAvailabilityLists.forEach((availability) => {
     const slots = generateSlots(availability, rangeStart, rangeEnd);

     // Filter these slots by their own availability date range
     const filteredSlots = filterByAvailabilityDateRange(slots, availability);

     commonSlots = commonSlots.filter((mainSlot) =>
       filteredSlots.some(
         (slot) => slot[0] === mainSlot[0] && slot[1] === mainSlot[1]
       )
     );
   });

   // Filter out slots before the earliest bookable time, already booked slots, and blocked slots
   commonSlots = commonSlots.filter((slot) => {
     const slotStart = moment.utc(slot[0]);
     return slotStart.isSameOrAfter(earliestBookableTime);
   });

   commonSlots = filterOutOverlappingSlots(commonSlots, alreadyBookedList);
   commonSlots = filterOutOverlappingSlots(commonSlots, blockedByUserList);

   return commonSlots;
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






  function assignSimplifiedSlotInfo(mainAvailability, modifiedSlots, generatedSlots) {
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





  // Wrapper function
  function generateScheduleWrapper(
    mainAvailability,
    allAvailabilityLists,
    viewerDate,
    alreadyBookedList,
    modifiedSlots,
    offset,
    userOffsetInSeconds,
    earliestBookableHour,
    blockedByUserList
  ) {
    console.log("blocked 1", blockedByUserList);
    // Generate the slots for the expanded range (-2 days to +9 days)
    const slots = generateSlotsForWeek(
      mainAvailability,
      allAvailabilityLists,
      viewerDate,
      alreadyBookedList,
      offset,
      userOffsetInSeconds,
      earliestBookableHour,
      blockedByUserList
    );

    // Generate the week ranges
    const weekRanges = generateWeekRanges(
      viewerDate,
      offset,
      userOffsetInSeconds
    );

    const allPossibleSlots = generateAllPossibleSlots(slots, weekRanges);

    // Get the outputs from assignSimplifiedSlotInfo
    const [urls, addresses, isModified, isStartupCorners] =
      assignSimplifiedSlotInfo(
        mainAvailability,
        modifiedSlots,
        allPossibleSlots.map((slot) => ({
          start_date: slot[0],
          end_date: slot[1],
        })) // Convert back to object format for compatibility
      );

    // Assign outputs to the appropriate variables
    let outputlist1 = urls; // Meeting links
    let outputlist2 = addresses; // Addresses
    let outputlist4 = isModified; // Modified slot info
    let outputlist5 = slots; // The slots themselves (array of arrays)
    let outputlist6 = weekRanges; // Week ranges
    let outputlist7 = allPossibleSlots; // All possible slots
    let outputlist9 = isStartupCorners; // Startup corners information

    // Send result to Bubble
    bubble_fn_hours({
      outputlist1: outputlist1,
      outputlist2: outputlist2,
      outputlist4: outputlist4,
      outputlist5: outputlist5,
      outputlist6: outputlist6,
      outputlist7: outputlist7,
      outputlist9: outputlist9,
    });

    return {
      outputlist1,
      outputlist2,
      outputlist4,
      outputlist9,
      outputlist5,
      outputlist6,
    };
  }

  window.generateScheduleWrapper =
    generateScheduleWrapper;
