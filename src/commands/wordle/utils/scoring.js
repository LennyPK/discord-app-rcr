const { buildFullTimeline } = require("./timeline");
const { getAllUsers } = require("./user");

const MAX_GUESSES = 6;
/** Points for a solve in 6 guesses; each guess fewer adds GUESS_POINTS (1 guess = 100) */
const MIN_SOLVE_POINTS = 50;
const GUESS_POINTS = 10;
/** Points for a failed Wordle (X): less than any solve, more than skipping the day */
const FAIL_POINTS = 25;

/**
 * Points earned for a single day.
 * Solved: 1 = 100, 2 = 90, 3 = 80, 4 = 70, 5 = 60, 6 = 50. Failed: 25. Didn't play: 0.
 *
 * @param {{ status: "solved" | "failed" | "missing", score: number | null }} entry
 */
function dayPoints(entry) {
  if (entry.status === "solved") return MIN_SOLVE_POINTS + (MAX_GUESSES - entry.score) * GUESS_POINTS;
  if (entry.status === "failed") return FAIL_POINTS;
  return 0;
}

/**
 * Score a player's Wordle timeline (0–100).
 *
 *   score = average points per day × participation
 *   participation = 0.7 + 0.3 × (days played ÷ days in timeline)
 *
 * Every day in the timeline counts, so playing more always raises the score, and skipping a
 * day costs more than failing it.
 *
 * @param {Array<{ date: Date, status: "solved" | "failed" | "missing", score: number | null }>} timeline
 *   Day-by-day timeline covering the period being scored (from `buildFullTimeline`).
 */
function calculateScore(timeline) {
  const days = timeline.length;
  const played = timeline.filter((entry) => entry.status !== "missing");
  const solved = played.filter((entry) => entry.status === "solved");
  const gamesPlayed = played.length;

  const metrics = {
    days,
    gamesPlayed,
    solvedGames: solved.length,
    failedGames: gamesPlayed - solved.length,
    /** Solved ÷ played, for display */
    solveRate: gamesPlayed > 0 ? solved.length / gamesPlayed : 0,
    avgGuesses:
      solved.length > 0 ? solved.reduce((sum, entry) => sum + entry.score, 0) / solved.length : 0,
  };

  if (days === 0 || gamesPlayed === 0) return { score: 0, metrics };

  const avgPoints = timeline.reduce((sum, entry) => sum + dayPoints(entry), 0) / days;
  const participationMultiplier = 0.7 + 0.3 * (gamesPlayed / days);

  return { score: avgPoints * participationMultiplier, metrics };
}

/**
 * Score and rank every user who played at least once in the date range.
 * Blacklisted users (`excluded`) are left out unless `includeExcluded` is set.
 *
 * @param {{ from: Date, to: Date, days: number } | null} range From `getPeriodRange`.
 * @param {{ includeExcluded?: boolean }} [options]
 * @returns {Promise<Array<{ user: object, score: number, metrics: object }>>} Sorted best first.
 */
async function rankPlayers(range, { includeExcluded = false } = {}) {
  if (!range || range.days === 0) return [];

  const users = (await getAllUsers()).filter((user) => includeExcluded || !user.excluded);

  const ranked = await Promise.all(
    users.map(async (user) => {
      const timeline = await buildFullTimeline(user.wordles, range.from, range.to);
      return { user, ...calculateScore(timeline) };
    })
  );

  return ranked
    .filter((entry) => entry.metrics.gamesPlayed > 0)
    .sort((a, b) => b.score - a.score);
}

module.exports = { calculateScore, rankPlayers, dayPoints };
