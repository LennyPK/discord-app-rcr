// const leaderboardScore = wordleScore(gamesPlayed, maxGames, solveRate, avgGuesses);

function wordleScore(wordleScores, leaderboardType) {
  const gamesPlayed = wordleScores.length;
  const maxGames = leaderboardType === "weekly" ? 7 : 30;
  const solvedGames = wordleScores.filter((w) => w.score > 0);
  const solveRate = gamesPlayed > 0 ? solvedGames.length / gamesPlayed : 0;
  const avgGuesses = solvedGames.reduce((sum, w) => sum + w.score, 0) / (solvedGames.length || 1);

  /** CHATGPT
  if (maxGames === 0 || avgGuesses <= 0) return 0;

  // Step 1: Skill-based efficiency (normalized out of 100)
  const efficiency = 100 * ((solveRate * (6 - avgGuesses)) / 6);

  // Step 2: Participation multiplier (weights frequency at 30%)
  const participationMultiplier = 0.7 + 0.3 * (gamesPlayed / maxGames);

  // Step 3: Final composite score
  const finalScore = efficiency * participationMultiplier;

  // Keep it in a 0–100 range
  return Math.max(0, Math.min(100, finalScore));
	*/

  /** CLAUDE CODE */
  if (maxGames === 0 || gamesPlayed === 0) return 0;
  if (solveRate === 0) return 0; // No solved games = 0 score
  if (avgGuesses < 1 || avgGuesses > 6) return 0; // Invalid avg

  // Solve rate component (0-50 points)
  const solveBonus = solveRate * 50;

  // Guess efficiency component (0-50 points, only counts solved games)
  const guessEfficiency = ((6 - avgGuesses) / 5) * 50;

  // Combined skill score (0-100 points)
  const skillScore = solveBonus + guessEfficiency;

  // Participation multiplier (70% baseline + 30% for consistency)
  const participationMultiplier = 0.7 + 0.3 * (gamesPlayed / maxGames);
  // const participationMultiplier = Math.max(0.5, 0.7 + 0.3 * (gamesPlayed / maxGames))

  return skillScore * participationMultiplier;
}

modules.export = { wordleScore };
