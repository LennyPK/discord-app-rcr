const { solved, failed, missing, times } = require("./helpers");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateScore, dayPoints } = require("../src/commands/wordle/utils/scoring");

const score = (timeline) => calculateScore(timeline).score;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.05, `${actual} ≈ ${expected}`);

describe("dayPoints", () => {
  it("gives 100 for 1 guess down to 50 for 6 guesses", () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6].map((guesses) => dayPoints(solved(guesses))),
      [100, 90, 80, 70, 60, 50]
    );
  });

  it("gives a fail fewer points than any solve, but more than skipping", () => {
    assert.equal(dayPoints(failed()), 25);
    assert.equal(dayPoints(missing()), 0);
  });
});

describe("calculateScore", () => {
  it("scores a full week of 3-guess solves at 80", () => {
    close(score(times(7, () => solved(3))), 80);
  });

  it("scores a full week of 5-guess solves at 60", () => {
    close(score(times(7, () => solved(5))), 60);
  });

  it("scores a fail higher than skipping the same day", () => {
    const withFail = score([...times(6, () => solved(3)), failed()]);
    const withSkip = score([...times(6, () => solved(3)), missing()]);

    close(withFail, 72.1);
    close(withSkip, 65.6);
    assert.ok(withFail > withSkip);
  });

  it("keeps one lucky game low when the rest of the period is missed", () => {
    close(score([solved(1), ...times(6, missing)]), 10.6);
  });

  it("scores 0 when nothing was played or the timeline is empty", () => {
    assert.equal(score(times(7, missing)), 0);
    assert.equal(score([]), 0);
  });

  it("gives some points to a player who only failed", () => {
    assert.ok(score(times(3, failed)) > 0);
  });

  it("never lowers the score when another day is played instead of skipped", () => {
    for (const result of [solved(1), solved(6), failed()]) {
      for (let played = 0; played < 7; played++) {
        const before = [...times(played, () => solved(4)), ...times(7 - played, missing)];
        const after = [...times(played, () => solved(4)), result, ...times(6 - played, missing)];
        assert.ok(score(after) >= score(before), `adding ${result.status} after ${played} games`);
      }
    }
  });

  it("reports metrics for display", () => {
    const { metrics } = calculateScore([solved(2), solved(4), failed(), missing()]);

    assert.deepEqual(metrics, {
      days: 4,
      gamesPlayed: 3,
      solvedGames: 2,
      failedGames: 1,
      solveRate: 2 / 3,
      avgGuesses: 3,
    });
  });
});
