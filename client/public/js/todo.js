
  function generate42CalendarDatesUserTimeZoneToDo(anchorDate) {
    // Parse the input anchor date (e.g., "2025-01-31") into year, month, and day.
    const [year, month, day] = anchorDate.split("-").map(Number);

    // Convert the anchor date to a UTC date object
    const anchorUTC = new Date(Date.UTC(year, month - 1, day));

    // Find the first day of the month in UTC
    const firstDayUTC = new Date(
      Date.UTC(anchorUTC.getUTCFullYear(), anchorUTC.getUTCMonth(), 1)
    );

    // Find the nearest previous Sunday in UTC
    const dayOfWeek = firstDayUTC.getUTCDay(); // 0=Sunday, ..., 6=Saturday
    const nearestSundayUTC = new Date(firstDayUTC);
    nearestSundayUTC.setUTCDate(firstDayUTC.getUTCDate() - dayOfWeek);

    // Generate 42 consecutive UTC dates
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dates = [];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(nearestSundayUTC.getTime() + i * oneDayMs);
      dates.push(currentDate.toISOString().split("T")[0]); // Keep only YYYY-MM-DD
    }

    // Send the dates to Bubble function
    bubble_fn_receiveDates(dates);
  }


  // Make function globally accessible
 window.generate42CalendarDatesUserTimeZoneToDo =
   generate42CalendarDatesUserTimeZoneToDo;

