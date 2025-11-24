const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");
const { prisma } = require("../../prisma-client");
const { wordleScore } = require("./utils/scoring");
const { getFirstRecord, getLastRecord, buildFullTimeline } = require("./utils/timeline");
const { getAllUsers } = require("./utils/user");

const LEADERBOARD = {
  ALL: "all",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_leaderboard")
    .setDescription("Display the selected Wordle leaderboard")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Select the leaderboard range")
        .setRequired(true)
        .addChoices(
          { name: "Weekly", value: LEADERBOARD.WEEKLY },
          { name: "Monthly", value: LEADERBOARD.MONTHLY },
          { name: "All Time (default)", value: LEADERBOARD.ALL }
        )
    ),
  async execute(interaction) {
    // await interaction.reply(`Selected leaderboard: ${interaction.options.getString("type")}`);

    const type = interaction.options.getString("type");

    // const userId = interaction.user.id;

    // const user = await prisma.user.findUnique({
    //   where: { id: userId },
    //   include: { wordles: { orderBy: { date: "desc" } } },
    // });

    await leaderboard(interaction, type);
  },
};

/**
 * @param { ChatInputCommandInteraction } interaction
 * @param { "weekly" | "monthly" | "all" } type
 */
async function leaderboard(interaction, type) {
  /** Get today's date */
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  /**  Weekly progress */
  const dayOfWeek = yesterday.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekProgress = `${daysSinceMonday + 1}/7`;

  /**  Monthly progress */
  const dayOfMonth = yesterday.getDate();
  const daysInMonth = new Date(yesterday.getFullYear(), yesterday.getMonth() + 1, 0).getDate();
  const monthProgress = `${dayOfMonth}/${daysInMonth}`;

  const month = now.toLocaleString("default", { month: "long" });
  let title, description, footer;

  /** Set leaderboard descriptors */
  switch (type) {
    case LEADERBOARD.WEEKLY:
      title = ":date: Weekly Wordle Leaderboard";
      description = "Rankings based on Wordles from Monday up to today.";
      footer = "Day " + weekProgress;
      break;
    case LEADERBOARD.MONTHLY:
      title = ":calendar_spiral: " + month + " Wordle Leaderboard";
      description = "Rankings based on Wordles from the start of this month up to today.";
      footer = "Day " + monthProgress;
      break;
    case LEADERBOARD.ALL:
      title = ":earth_asia: All-Time Wordle Leaderboard";
      description = "Cumulative rankings  across all recorded Wordles";
      footer =
        (await prisma.wordle.groupBy({ by: ["date"], _count: { date: true } })).length + " Wordles";
  }

  const rankings = await getLeaderboardData(type);

  const medals = [":first_place:", ":second_place:", ":third_place:"];
  //   const leaderboardText = rankings
  //     .slice(0, 10)
  //     .map((entry, index) => {
  //       const medal = medals[index] || `${index + 1}.`;
  //       const id = entry.user.id;
  //       // TODO: Add position change indicators
  //       const movement = "=";
  //       const lastPlayed = entry.recentScores[0]?.date.toLocaleDateString("en-GB", {
  //         month: "short",
  //         day: "numeric",
  //       });

  //       const stats = `Score: ${entry.score.toFixed(1)} (${(entry.solveRate * 100).toFixed(
  //         0
  //       )}% solved • ${entry.avgGuesses.toFixed(1)} avg • ${(entry.participation * 100).toFixed(
  //         0
  //       )}% active)`;
  //       const recentScores = entry.recentPattern || "No recent games";

  //       return `${medal} <@${id}> ${movement} (${lastPlayed})
  // ${stats}
  // Recent: ${recentScores}`;
  //     })
  //     .join("\n\n");

  // Calculate statistics
  //   const stats = {
  //     activePlayers: rankings.length,
  //     monthlyGames: rankings.reduce((sum, entry) => sum + entry.totalGames, 0),
  //     avgScore:
  //       rankings.reduce((sum, entry) => sum + parseFloat(entry.avgScore), 0) / rankings.length,
  //   };

  //   const statsText = `:bar_chart: Statistics
  // Active Players: ${stats.activePlayers}
  // Monthly Games: ${stats.monthlyGames}
  // Monthly Avg: ${stats.avgScore.toFixed(2)}`;

  return await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(5763719)
        .setTitle(title)
        // .setDescription(description + "\n\n" + leaderboardText + "\n\n" + statsText)
        .setDescription(description + "\n" + rankings.join("\n"))
        // .addFields({ name: "\u200B", value: rankings.join("\n") })
        .setFooter({ text: footer })
        .setTimestamp(),
    ],
  });
}

// async function getUserScores(dateFrom, dateTo = new Date()) {
//   // Get all scores within the date range
//   const scores = await prisma.wordle.findMany({
//     where: {
//       date: {
//         gte: dateFrom,
//         lte: dateTo,
//       },
//     },
//     include: {
//       user: true,
//     },
//     orderBy: {
//       date: "desc",
//     },
//   });

//   // Group scores by user
//   const userScores = new Map();

//   for (const score of scores) {
//     if (!userScores.has(score.userId)) {
//       userScores.set(score.userId, {
//         user: score.user,
//         scores: [],
//         recentScores: [],
//         totalGames: 0,
//         solvedGames: 0,
//         totalGuesses: 0,
//       });
//     }

//     const userStats = userScores.get(score.userId);
//     userStats.scores.push(score);
//     userStats.totalGames++;
//     if (score.solved) {
//       userStats.solvedGames++;
//       userStats.totalGuesses += score.score;
//     }
//     if (userStats.recentScores.length < 7) {
//       userStats.recentScores.push(score);
//     }
//   }

//   return Array.from(userScores.values()).map((stats) => ({
//     ...stats,
//     avgScore: stats.solvedGames > 0 ? (stats.totalGuesses / stats.solvedGames).toFixed(2) : 0,
//     solveRate: (stats.solvedGames / stats.totalGames).toFixed(2),
//     recentPattern: stats.recentScores
//       .map((s) => (s.solved ? s.score : "X"))
//       .reverse()
//       .join(" | "),
//   }));
// }

/**
 * @param {typeof LEADERBOARD[keyof typeof LEADERBOARD]} type
 */
async function getLeaderboardData(type) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const daysInMonth = new Date(yesterday.getFullYear(), yesterday.getMonth() + 1, 0).getDate();

  // const dayOfWeek = now.getDay();
  // const dayOfMonth = now.getDate();

  const dayOfWeek = yesterday.getDay();
  const dayOfMonth = yesterday.getDate();

  let maxGames;
  switch (type) {
    case LEADERBOARD.WEEKLY:
      if (dayOfWeek === 0) {
        // On Sunday, show last week's total
        maxGames = 7;
        // } else if (dayOfWeek === 0) {
        //   maxGames = 6;
      } else {
        // maxGames = dayOfWeek - 1;
        // Otherwise: number of days since last Monday
        maxGames = dayOfWeek;
      }
      break;

    case LEADERBOARD.MONTHLY:
      if (dayOfMonth === daysInMonth) {
        // Yesterday was the last day of the month, show the last month's total
        maxGames = daysInMonth;
      } else {
        maxGames = dayOfMonth;
      }
      break;

    default:
      maxGames = null;
  }
  console.log("dayofMonth: " + dayOfMonth);
  console.log("dayOfWeek: " + dayOfWeek);
  // maxGames = type === LEADERBOARD.WEEKLY ? 7 : 31;
  const allUsers = await getAllUsers();

  // const rankingData = allUsers.map((user) => {
  //   const { score, metrics } = calculateScore(user, user.wordles, type, maxGames);
  //   return {
  //     ...user,
  //     score,
  //   };
  // });
  const medals = [":first_place:", ":second_place:", ":third_place:"];

  const rankingData = (
    await Promise.all(
      allUsers.map(async (user) => {
        const { score, metrics } = await calculateScore(user, type, maxGames);
        return {
          ...user,
          score,
          metrics,
        };
      })
    )
  ).filter((user) => user.score > 0);

  return (
    rankingData
      // .filter((user) => user.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((user, index) => {
        const pos = medals[index] || `${index + 1}.`;
        // if (index < 15) {
        return (
          `${pos} <@${user.id}> ${user.score.toFixed(2)}` +
          "\n" +
          `-# ${user.metrics.gamesPlayed}/${user.metrics.maxGames}` +
          " • " +
          `${(user.metrics.solveRate * 100).toFixed(0)}% solved`
        );
        // }
      })
  );
  // for (const user of rankingData) {
  //   // console.log(user);
  //   console.info(
  //     `Data for ${user.globalName}: ${user.score}, ${JSON.stringify(user.metrics, null, 2)}`
  //   );
  // }

  // const score = await calculateScore(user, user.wordles, type, maxGames);
  //  const rankingData = allUsers.map((u) => {
  //    const { score } = wordleScore(u.wordles, "all");
  //    return { username: u.username, score };
  //  });

  // let dateFrom;
  // if (type === LEADERBOARD.WEEKLY) {
  //   // const dayOfWeek = now.getDay();
  //   const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  //   dateFrom = new Date(now);
  //   dateFrom.setDate(now.getDate() - daysToMonday);
  //   dateFrom.setHours(0, 0, 0, 0);
  // } else if (type === LEADERBOARD.MONTHLY) {
  //   dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  // } else {
  //   dateFrom = new Date(0); // All time
  // }

  // const allTimeScores = await getUserScores(new Date(0));
  // const periodScores = type === LEADERBOARD.ALL ? allTimeScores : await getUserScores(dateFrom);

  // Calculate scores and sort
  // return periodScores
  //   .map((userStats) => {
  //     const { score, metrics } = wordleScore(userStats.scores, type, { maxGames });
  //     return {
  //       ...userStats,
  //       score,
  //       solveRate: metrics.solveRate,
  //       avgGuesses: metrics.avgGuesses,
  //       participation: metrics.participationMultiplier,
  //     };
  //   })
  //   .sort((a, b) => b.score - a.score);
}

async function calculateScore(user, leaderboardType, maxGames) {
  const firstRecord = await getFirstRecord();
  const lastRecord = await getLastRecord();

  // const recentWordles =
  //   maxGames && user.wordles.length > maxGames ? user.wordles.slice(0, maxGames) : user.wordles;

  const fullTimeline = await buildFullTimeline(user.wordles, firstRecord.date, lastRecord.date);

  if (!maxGames) {
    maxGames = fullTimeline.length;
  }

  const recentWordles =
    maxGames && fullTimeline.length > maxGames ? fullTimeline.slice(-maxGames) : fullTimeline;

  console.log(recentWordles[0].date.toLocaleDateString("en-GB"));

  const gamesPlayed = recentWordles.length;
  const solvedGames = recentWordles.filter((wordle) => wordle.status === "solved");
  const solveRate = gamesPlayed > 0 ? solvedGames.length / maxGames : 0;
  const avgGuesses =
    solvedGames.reduce((sum, wordle) => sum + wordle.score, 0) / (solvedGames.length || 1);

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
  const emptyMetrics = {
    score: 0,
    metrics: { gamesPlayed: 0, solvedGames: 0, solveRate: 0, avgGuesses: 0, maxGames: 0 },
  };

  console.error("========");
  console.log(`user: ${user.globalName}`);
  console.log(`gamesPlayed: ${gamesPlayed}`);
  console.log(`solveRate: ${solveRate}`);
  console.log(`avgGuesses: ${avgGuesses}`);

  /** CLAUDE CODE */
  if (gamesPlayed === 0) return emptyMetrics;
  // if (solveRate === 0) return emptyMetrics; // No solved games = 0 score
  // if (avgGuesses < 1 || avgGuesses > 6) return emptyMetrics; // Invalid avg

  // Solve rate component (0-50 points)
  const solveBonus = solveRate * 50;

  // Guess efficiency component (0-50 points, only counts solved games)
  const guessEfficiency = ((6 - avgGuesses) / 6) * 50;

  // Combined skill score (0-100 points)
  const skillScore = solveBonus + guessEfficiency;

  // Participation multiplier (70% baseline + 30% for consistency)
  const participationMultiplier = 0.7 + 0.3 * (gamesPlayed / maxGames);
  // const participationMultiplier = Math.max(0.5, 0.7 + 0.3 * (gamesPlayed / maxGames))

  const finalScore = skillScore * participationMultiplier;

  console.warn("========");
  console.log(`score: ${finalScore}`);
  console.log(`solvedGames: ${solvedGames.length}`);
  console.log(`solveRate: ${solveRate}`);
  console.log(`avgGuesses: ${avgGuesses}`);
  console.log(`gamesPlayed: ${gamesPlayed}`);
  console.log(`maxGames: ${maxGames}`);
  console.warn("========");

  return {
    score: finalScore,
    metrics: {
      gamesPlayed,
      solvedGames: solvedGames.length,
      solveRate,
      avgGuesses,
      maxGames,
    },
  };
}
