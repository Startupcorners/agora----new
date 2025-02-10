function generate42CalendarDatesUserTimeZone(anchorDate, offsetSeconds) {
  console.log("🔹 Function Called: generate42CalendarDatesUserTimeZone");
  console.log("📥 Input - anchorDate:", anchorDate);
  console.log("📥 Input - offsetSeconds:", offsetSeconds);

  try {
    // Parse the input date
    const [year, month, day] = anchorDate.split("-").map(Number);
    console.log("📆 Parsed Date - Year:", year, "Month:", month, "Day:", day);

    // Convert to UTC
    const anchorUTC = new Date(Date.UTC(year, month - 1, day));
    console.log("🌍 UTC Anchor Date:", anchorUTC.toISOString());

    // Adjust for the user's time zone offset
    const anchorLocal = new Date(anchorUTC.getTime() + offsetSeconds * 1000);
    console.log("⏳ Local Time Adjusted:", anchorLocal.toISOString());

    // Get the first day of the month in UTC
    const firstDayLocal = new Date(
      Date.UTC(anchorLocal.getUTCFullYear(), anchorLocal.getUTCMonth(), 1)
    );
    console.log("📆 First Day of Month (UTC):", firstDayLocal.toISOString());

    // Find the nearest Sunday before or on the first of the month
    const dayOfWeek = firstDayLocal.getUTCDay();
    console.log("📌 Day of Week (0=Sunday, ... 6=Saturday):", dayOfWeek);

    const nearestSundayLocal = new Date(
      firstDayLocal.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
    );
    console.log(
      "📌 Nearest Sunday Before First Day:",
      nearestSundayLocal.toISOString()
    );

    // Generate 42 consecutive dates
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dates = [];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(nearestSundayLocal.getTime() + i * oneDayMs);
      const adjustedDate = new Date(
        currentDate.getTime() - offsetSeconds * 1000
      );
      dates.push(adjustedDate.toISOString());

      console.log(`📅 Generated Date ${i + 1}:`, adjustedDate.toISOString());
    }

    console.log("✅ Final List of Dates:", dates);

    // Send dates to Bubble function
    bubble_fn_listOfStartDatesEvent(dates);
    console.log("📤 Sent to Bubble Function: bubble_fn_listOfStartDatesEvent");
  } catch (error) {
    console.error("❌ Error in generate42CalendarDatesUserTimeZone:", error);
  }
}

// ✅ Attach functions to window for global access
window.generate42CalendarDatesUserTimeZone =
  generate42CalendarDatesUserTimeZone;

function adjustDatesToOffset(oldOffsetSeconds, newOffsetSeconds, startDateISO) {
  function shiftDate(dateISO) {
    if (!dateISO) return null;
    const oldDateUTC = new Date(dateISO);
    const deltaMs = (oldOffsetSeconds - newOffsetSeconds) * 1000;
    return new Date(oldDateUTC.getTime() + deltaMs).toISOString();
  }

  bubble_fn_newStartEvent(shiftDate(startDateISO));
}
window.adjustDatesToOffset = adjustDatesToOffset;

function generateStartTimes(startTime) {
  const fixedDuration = 15;
  const times = [];
  let [startHour, startMinute] = startTime.split(":").map(Number);
  let currentTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = 23 * 60 + (60 - fixedDuration);

  while (currentTimeInMinutes <= endTimeInMinutes) {
    const hours = Math.floor(currentTimeInMinutes / 60);
    const minutes = currentTimeInMinutes % 60;
    times.push(
      `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`
    );
    currentTimeInMinutes += fixedDuration;
  }

  bubble_fn_startTimeListEvent(times);
}
window.generateStartTimes = generateStartTimes;

function generateEndTimes(startTime) {
  const fixedDuration = 15;
  const times = [];
  let [startHour, startMinute] = startTime.split(":").map(Number);
  let currentTimeInMinutes = startHour * 60 + startMinute + fixedDuration;
  const endTimeInMinutes = 24 * 60;

  while (currentTimeInMinutes <= endTimeInMinutes) {
    const hours = Math.floor(currentTimeInMinutes / 60);
    const minutes = currentTimeInMinutes % 60;
    times.push(
      `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`
    );
    currentTimeInMinutes += fixedDuration;
  }

  bubble_fn_endTimeListEvent(times);
}
window.generateEndTimes = generateEndTimes;

function checkTime(start, end) {
  if (!start || !end) return;

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  bubble_fn_isTimeAfter(startTotalMinutes < endTotalMinutes ? "yes" : "no");
}
window.checkTime = checkTime;

function processFinalStartEndTime(
  bubbleId,
  date,
  startTime,
  endTime,
  timeZoneOffsetSeconds
) {
  function convertToUTC(date, time, offsetSeconds) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);

    // Create a date object in the local time zone
    const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

    // Adjust to UTC by subtracting the offset
    const utcDate = new Date(localDate.getTime() - offsetSeconds * 1000);

    return utcDate.toISOString();
  }

  const finalStartISO = convertToUTC(date, startTime, timeZoneOffsetSeconds);
  const finalEndISO = convertToUTC(date, endTime, timeZoneOffsetSeconds);

  // Run the required Bubble functions
  bubble_fn_finalTime({
    output1: finalStartISO,
    output2: finalEndISO,
    output3: bubbleId,
  });
}
window.processFinalStartEndTime = processFinalStartEndTime;
