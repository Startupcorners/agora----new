
  function generate42CalendarDatesUserTimeZoneToDo(
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
 window.generate42CalendarDatesUserTimeZoneToDo =
   generate42CalendarDatesUserTimeZoneToDo;

