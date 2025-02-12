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

    const nearestSundayUTC = new Date(
      firstDayLocal.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
    );
    console.log(
      "📌 Nearest Sunday Before First Day (UTC):",
      nearestSundayUTC.toISOString()
    );

    // Generate 42 consecutive dates in UTC, then apply the offset
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dates = [];

    for (let i = 0; i < 42; i++) {
      const currentDateUTC = new Date(
        nearestSundayUTC.getTime() + i * oneDayMs
      );
      const adjustedDate = new Date(
        currentDateUTC.getTime() + offsetSeconds * 1000
      );
      dates.push(adjustedDate.toISOString());

      console.log(
        `📅 Generated Date ${i + 1} (Adjusted UTC):`,
        adjustedDate.toISOString()
      );
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
  console.log("🔹 Function Called: processFinalStartEndTime");
  console.log("📥 Input - bubbleId:", bubbleId);
  console.log("📥 Input - date:", date);
  console.log("📥 Input - startTime:", startTime);
  console.log("📥 Input - endTime:", endTime);
  console.log("📥 Input - timeZoneOffsetSeconds:", timeZoneOffsetSeconds);

  function convertToUTC(date, time, offsetSeconds) {
    console.log("🔄 Converting to UTC...");
    console.log("📥 convertToUTC - date:", date);
    console.log("📥 convertToUTC - time:", time);
    console.log("📥 convertToUTC - offsetSeconds:", offsetSeconds);

    try {
      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute] = time.split(":").map(Number);

      console.log("📆 Parsed Date - Year:", year, "Month:", month, "Day:", day);
      console.log("⏰ Parsed Time - Hour:", hour, "Minute:", minute);

      // Create a date object in the local time zone
      const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
      console.log("🌍 Local Date Before Offset:", localDate.toISOString());

      // Adjust to UTC by subtracting the offset
      const utcDate = new Date(localDate.getTime() - offsetSeconds * 1000);
      console.log("✅ Converted UTC Date:", utcDate.toISOString());

      return utcDate.toISOString();
    } catch (error) {
      console.error("❌ Error in convertToUTC:", error);
      return null;
    }
  }

  const finalStartISO = convertToUTC(date, startTime, timeZoneOffsetSeconds);
  const finalEndISO = convertToUTC(date, endTime, timeZoneOffsetSeconds);

  console.log("✅ Final Converted Start Time (UTC):", finalStartISO);
  console.log("✅ Final Converted End Time (UTC):", finalEndISO);

  if (!finalStartISO || !finalEndISO) {
    console.error(
      "❌ One or both converted times are invalid. Aborting function."
    );
    return;
  }

  // Run the required Bubble functions
  try {
    console.log("📤 Sending Data to Bubble Function...");
    bubble_fn_finalTime({
      output1: finalStartISO,
      output2: finalEndISO,
      output3: bubbleId,
    });
    console.log("✅ Data Successfully Sent to bubble_fn_finalTime");
  } catch (error) {
    console.error("❌ Error Calling bubble_fn_finalTime:", error);
  }
}

window.processFinalStartEndTime = processFinalStartEndTime;
