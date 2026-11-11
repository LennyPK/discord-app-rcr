const { getFirstRecord, getLastRecord } = require("./timeline");

const PERIOD = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
  ALL: "all",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Inclusive number of calendar days from `from` to `to` (0 if `to` is before `from`). */
function daysBetween(from, to) {
  const days = Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS) + 1;
  return Math.max(0, days);
}

/**
 * Date range for a leaderboard period.
 *
 * Periods are based on yesterday (the latest Wordle that can have results), so on a Monday the
 * weekly board shows the full previous week, and on the 1st the monthly board shows last month.
 * The range ends at the latest recorded Wordle if yesterday's results haven't been saved yet,
 * so the window shrinks instead of shifting.
 *
 * @param {typeof PERIOD[keyof typeof PERIOD]} period
 * @returns {Promise<{ from: Date, to: Date, days: number, periodDays: number | null } | null>}
 *   `days`: days in the range so far. `periodDays`: full length of the period (null for all-time).
 *   Returns null if no Wordles have been recorded.
 */
async function getPeriodRange(period) {
  const [firstRecord, lastRecord] = await Promise.all([getFirstRecord(), getLastRecord()]);
  if (!firstRecord || !lastRecord) return null;

  return computePeriodRange(period, {
    today: new Date(),
    firstRecordDate: firstRecord.date,
    lastRecordDate: lastRecord.date,
  });
}

/**
 * Pure date maths behind `getPeriodRange`.
 *
 * @param {typeof PERIOD[keyof typeof PERIOD]} period
 * @param {{ today: Date, firstRecordDate: Date, lastRecordDate: Date }} dates
 */
function computePeriodRange(period, { today, firstRecordDate, lastRecordDate }) {
  const yesterday = startOfDay(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastRecorded = startOfDay(lastRecordDate);
  const to = lastRecorded < yesterday ? lastRecorded : yesterday;

  let from;
  let periodEnd = null;

  switch (period) {
    case PERIOD.WEEKLY: {
      const dayOfWeek = yesterday.getDay();
      from = new Date(yesterday);
      from.setDate(yesterday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      periodEnd = new Date(from);
      periodEnd.setDate(from.getDate() + 6);
      break;
    }
    case PERIOD.MONTHLY:
      from = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
      periodEnd = new Date(yesterday.getFullYear(), yesterday.getMonth() + 1, 0);
      break;
    case PERIOD.YEARLY:
      from = new Date(yesterday.getFullYear(), 0, 1);
      periodEnd = new Date(yesterday.getFullYear(), 11, 31);
      break;
    default:
      from = startOfDay(firstRecordDate);
  }

  return {
    from,
    to,
    days: daysBetween(from, to),
    periodDays: periodEnd ? daysBetween(from, periodEnd) : null,
  };
}

module.exports = { PERIOD, getPeriodRange, computePeriodRange };
