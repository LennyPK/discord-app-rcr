const { getFirstRecord, getLastRecord, buildFullTimeline } = require("./timeline");
const { getAllUsers } = require("./user");

const MAX_GUESSES = 6;

/**
 * Score a player's Wordle timeline (0–100).
 *
 * - Solve bonus (0–50): solved games / days available (missed days count against you).
 *   Note `metrics.solveRate` is solved / played, for display.
 * - Guess efficiency (0–50): 1 guess = 50, 6 guesses = 0, averaged over solved games only.
 * - Participation multiplier (0.7–1.0): 70% baseline + 30% scaled by games played / days available.
 *
 * @param {Array<{ date: Date, status: "solved" | "failed" | "missing", score: number | null }>} timeline
 *   Full day-by-day timeline in ascending date order (from `buildFullTimeline`).
 * @param {number} [maxGames] Only score the most recent `maxGames` days. Defaults to the whole timeline.
 */
function calculateScore(timeline, maxGames) {
  const window =
    maxGames && timeline.length > maxGames ? timeline.slice(-maxGames) : timeline;

  const played = window.filter((entry) => entry.status !== "missing");
  const solved = played.filter((entry) => entry.status === "solved");

  const gamesPlayed = played.length;
  const availableGames = window.length;
  const solveRate = gamesPlayed > 0 ? solved.length / gamesPlayed : 0;
  const avgGuesses =
    solved.length > 0 ? solved.reduce((sum, entry) => sum + entry.score, 0) / solved.length : 0;

  const metrics = {
    gamesPlayed,
    solvedGames: solved.length,
    solveRate,
    avgGuesses,
    maxGames: availableGames,
  };

  if (gamesPlayed === 0 || availableGames === 0) return { score: 0, metrics };

  /** Missed days count as unsolved here, otherwise a single lucky game outranks regulars */
  const solveBonus = (solved.length / availableGames) * 50;
  const guessEfficiency =
    solved.length > 0 ? ((MAX_GUESSES - avgGuesses) / (MAX_GUESSES - 1)) * 50 : 0;
  const participationMultiplier = 0.7 + 0.3 * (gamesPlayed / availableGames);

  return { score: (solveBonus + guessEfficiency) * participationMultiplier, metrics };
}

/**
 * Score and rank every user with at least one recorded Wordle.
 * Users with a score of 0 (no games in the window) are excluded.
 *
 * @param {number} [maxGames] Only score the most recent `maxGames` days. Defaults to all time.
 * @returns {Promise<Array<{ user: object, score: number, metrics: object }>>} Sorted best first.
 */
async function rankPlayers(maxGames) {
  const [firstRecord, lastRecord] = await Promise.all([getFirstRecord(), getLastRecord()]);
  if (!firstRecord || !lastRecord) return [];

  const users = await getAllUsers();

  const ranked = await Promise.all(
    users.map(async (user) => {
      const timeline = await buildFullTimeline(user.wordles, firstRecord.date, lastRecord.date);
      return { user, ...calculateScore(timeline, maxGames) };
    })
  );

  return ranked.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
}

module.exports = { calculateScore, rankPlayers };
