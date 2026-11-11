const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");
const { prisma } = require("../../prisma-client");
const { rankPlayers } = require("./utils/scoring");

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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let maxGames;
  switch (type) {
    case LEADERBOARD.WEEKLY: {
      /** Days since Monday, inclusive of yesterday (Sunday => full week) */
      const dayOfWeek = yesterday.getDay();
      maxGames = dayOfWeek === 0 ? 7 : dayOfWeek;
      break;
    }
    case LEADERBOARD.MONTHLY:
      maxGames = yesterday.getDate();
      break;
    default:
      maxGames = undefined; // All time
  }

  const rankings = await rankPlayers(maxGames);
  if (rankings.length === 0) return ["-# No Wordles recorded for this period yet."];

  const medals = [":first_place:", ":second_place:", ":third_place:"];

  return rankings.map(({ user, score, metrics }, index) => {
    const pos = medals[index] || `${index + 1}.`;
    return (
      `${pos} <@${user.id}> ${score.toFixed(2)}` +
      "\n" +
      `-# ${metrics.gamesPlayed}/${metrics.maxGames}` +
      " • " +
      `${(metrics.solveRate * 100).toFixed(0)}% solved`
    );
  });
}
