export const eventSetting = async function () {
  function generate42CalendarDatesUserTimeZone(anchorDate, offsetSeconds) {
    const [year, month, day] = anchorDate.split("-").map(Number);
    const anchorUTC = new Date(Date.UTC(year, month - 1, day));
    const anchorLocal = new Date(anchorUTC.getTime() + offsetSeconds * 1000);
    const firstDayLocal = new Date(
      Date.UTC(anchorLocal.getUTCFullYear(), anchorLocal.getUTCMonth(), 1)
    );
    const dayOfWeek = firstDayLocal.getUTCDay();
    const nearestSundayLocal = new Date(
      firstDayLocal.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
    );

    const oneDayMs = 24 * 60 * 60 * 1000;
    const dates = [];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(nearestSundayLocal.getTime() + i * oneDayMs);
      const adjustedDate = new Date(
        currentDate.getTime() - offsetSeconds * 1000
      );
      dates.push(adjustedDate.toISOString());
    }

    bubble_fn_listOfStartDatesEvent(dates);
  }

  function adjustDatesToOffset(
    oldOffsetSeconds,
    newOffsetSeconds,
    startDateISO
  ) {
    function shiftDate(dateISO) {
      if (!dateISO) return null;
      const oldDateUTC = new Date(dateISO);
      const deltaMs = (oldOffsetSeconds - newOffsetSeconds) * 1000;
      return new Date(oldDateUTC.getTime() + deltaMs).toISOString();
    }

    bubble_fn_newStartEvent(shiftDate(startDateISO));
  }

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

  function checkTime(start, end) {
    if (!start || !end) return;

    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    bubble_fn_isTimeAfter(startTotalMinutes < endTotalMinutes ? "yes" : "no");
  }

  return {
    generateStartTimes,
    generateEndTimes,
    adjustDatesToOffset,
    generate42CalendarDatesUserTimeZone,
    checkTime,
  };
};

window["eventSetting"] = eventSetting;
