const { day } = require("./helpers");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildFullTimeline } = require("../src/commands/wordle/utils/timeline");

/** A stored Wordle row (dates are saved at 10:00 local time) */
const wordle = (date, score) => ({ date, score, solved: score !== null });

const summary = (timeline) =>
  timeline.map((entry) => `${entry.date.getDate()}:${entry.status}:${entry.score ?? "-"}`);

describe("buildFullTimeline", () => {
  it("has one entry per day, filling days without a Wordle as missing", async () => {
    const wordles = [wordle(day(2026, 11, 2, 10), 3), wordle(day(2026, 11, 4, 10), null)];
    const timeline = await buildFullTimeline(wordles, day(2026, 11, 1), day(2026, 11, 5));

    assert.deepEqual(summary(timeline), [
      "1:missing:-",
      "2:solved:3",
      "3:missing:-",
      "4:failed:-",
      "5:missing:-",
    ]);
  });

  it("ignores Wordles outside the range", async () => {
    const wordles = [wordle(day(2026, 10, 31, 10), 2), wordle(day(2026, 11, 6, 10), 2)];
    const timeline = await buildFullTimeline(wordles, day(2026, 11, 1), day(2026, 11, 5));

    assert.ok(timeline.every((entry) => entry.status === "missing"));
  });

  it("includes both the start and end days", async () => {
    const timeline = await buildFullTimeline([], day(2026, 11, 1), day(2026, 11, 1));
    assert.equal(timeline.length, 1);
  });

  it("keeps one entry per day across daylight saving changes", async () => {
    /** NZ daylight saving starts 27 Sep 2026 and ends 5 Apr 2026 */
    for (const [from, to] of [
      [day(2026, 9, 25), day(2026, 9, 29)],
      [day(2026, 4, 3), day(2026, 4, 7)],
    ]) {
      const wordles = [wordle(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 2, 10), 4)];
      const timeline = await buildFullTimeline(wordles, from, to);

      assert.equal(timeline.length, 5);
      assert.equal(new Set(timeline.map((entry) => entry.date.toDateString())).size, 5);
      assert.equal(timeline[2].status, "solved");
    }
  });
});
