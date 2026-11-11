const { day } = require("./helpers");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { PERIOD, computePeriodRange } = require("../src/commands/wordle/utils/periods");

const FIRST_RECORD = day(2025, 5, 19, 10);

/** Range for `period` when run on `today`, with results recorded up to `lastRecord` (default yesterday) */
function range(period, today, lastRecord) {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return computePeriodRange(period, {
    today,
    firstRecordDate: FIRST_RECORD,
    lastRecordDate: lastRecord ?? yesterday,
  });
}

function assertRange(actual, { from, to, days, periodDays }) {
  assert.deepEqual(
    { from: actual.from, to: actual.to, days: actual.days, periodDays: actual.periodDays },
    { from, to, days, periodDays }
  );
}

describe("computePeriodRange", () => {
  const thursday = day(2026, 11, 12, 9);

  it("weekly runs from Monday to yesterday", () => {
    assertRange(range(PERIOD.WEEKLY, thursday), {
      from: day(2026, 11, 9),
      to: day(2026, 11, 11),
      days: 3,
      periodDays: 7,
    });
  });

  it("weekly on a Monday shows the full previous week", () => {
    assertRange(range(PERIOD.WEEKLY, day(2026, 11, 9, 9)), {
      from: day(2026, 11, 2),
      to: day(2026, 11, 8),
      days: 7,
      periodDays: 7,
    });
  });

  it("monthly runs from the 1st to yesterday", () => {
    assertRange(range(PERIOD.MONTHLY, thursday), {
      from: day(2026, 11, 1),
      to: day(2026, 11, 11),
      days: 11,
      periodDays: 30,
    });
  });

  it("monthly on the 1st shows the full previous month", () => {
    assertRange(range(PERIOD.MONTHLY, day(2026, 11, 1, 9)), {
      from: day(2026, 10, 1),
      to: day(2026, 10, 31),
      days: 31,
      periodDays: 31,
    });
  });

  it("yearly runs from 1 January to yesterday", () => {
    assertRange(range(PERIOD.YEARLY, thursday), {
      from: day(2026, 1, 1),
      to: day(2026, 11, 11),
      days: 315,
      periodDays: 365,
    });
  });

  it("yearly on 1 January shows the full previous year", () => {
    assertRange(range(PERIOD.YEARLY, day(2027, 1, 1, 9)), {
      from: day(2026, 1, 1),
      to: day(2026, 12, 31),
      days: 365,
      periodDays: 365,
    });
  });

  it("counts 29 February in leap years", () => {
    const firstOfMarch = day(2028, 3, 1, 9);
    assert.equal(range(PERIOD.YEARLY, firstOfMarch).periodDays, 366);
    assert.equal(range(PERIOD.YEARLY, firstOfMarch).days, 60);
    assert.equal(range(PERIOD.MONTHLY, firstOfMarch).periodDays, 29);
  });

  it("all-time runs from the first recorded Wordle", () => {
    assertRange(range(PERIOD.ALL, thursday), {
      from: day(2025, 5, 19),
      to: day(2026, 11, 11),
      days: 542,
      periodDays: null,
    });
  });

  it("ends at the latest results if yesterday's haven't been saved", () => {
    const result = range(PERIOD.MONTHLY, thursday, day(2026, 11, 9, 10));
    assert.deepEqual(result.to, day(2026, 11, 9));
    assert.equal(result.days, 9);
  });

  it("is empty when the period has no results yet", () => {
    /** Tuesday morning, before Monday's results are posted */
    const result = range(PERIOD.WEEKLY, day(2026, 11, 10, 7), day(2026, 11, 8, 10));
    assert.equal(result.days, 0);
  });

  it("counts a week with a daylight saving change as 7 days", () => {
    /** NZ daylight saving starts on Sunday 27 Sep 2026 */
    assertRange(range(PERIOD.WEEKLY, day(2026, 9, 28, 9)), {
      from: day(2026, 9, 21),
      to: day(2026, 9, 27),
      days: 7,
      periodDays: 7,
    });
  });
});
