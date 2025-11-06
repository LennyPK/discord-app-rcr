const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../prisma-client");
const { wordleScore } = require("./utils/scoring");

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
  const year = now.getFullYear();

  let title, description, footer;

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
  const leaderboardText = rankings
    .slice(0, 10)
    .map((entry, index) => {
      const medal = medals[index] || `${index + 1}.`;
      const id = entry.user.id;
      // TODO: Add position change indicators
      const movement = "=";
      const lastPlayed = entry.recentScores[0]?.date.toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      });

      const monthlyStats = `Monthly: ${entry.avgScore} avg • ${entry.totalGames}/${
        type === LEADERBOARD.WEEKLY ? 7 : 31
      } games`;
      const totalGames = entry.scores.length;
      const recentScores = entry.recentPattern || "No recent games";

      return `${medal} <@${id}> ${movement} (${lastPlayed})
${monthlyStats}
Recent: ${recentScores}`;
    })
    .join("\n\n");

  // Calculate statistics
  const stats = {
    activePlayers: rankings.length,
    monthlyGames: rankings.reduce((sum, entry) => sum + entry.totalGames, 0),
    avgScore:
      rankings.reduce((sum, entry) => sum + parseFloat(entry.avgScore), 0) / rankings.length,
  };

  const statsText = `📊 Statistics
Active Players: ${stats.activePlayers}
Monthly Games: ${stats.monthlyGames}
Monthly Avg: ${stats.avgScore.toFixed(2)}`;

  return await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(5763719)
        .setTitle(title)
        .setDescription(description + "\n\n" + leaderboardText + "\n\n" + statsText)
        .setFooter({ text: footer })
        .setTimestamp(),
    ],
  });
}

async function getUserScores(dateFrom, dateTo = new Date()) {
  // Get all scores within the date range
  const scores = await prisma.wordle.findMany({
    where: {
      date: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      date: "desc",
    },
  });

  // Group scores by user
  const userScores = new Map();

  for (const score of scores) {
    if (!userScores.has(score.userId)) {
      userScores.set(score.userId, {
        user: score.user,
        scores: [],
        recentScores: [],
        totalGames: 0,
        solvedGames: 0,
        totalGuesses: 0,
      });
    }

    const userStats = userScores.get(score.userId);
    userStats.scores.push(score);
    userStats.totalGames++;
    if (score.solved) {
      userStats.solvedGames++;
      userStats.totalGuesses += score.score;
    }
    if (userStats.recentScores.length < 7) {
      userStats.recentScores.push(score);
    }
  }

  return Array.from(userScores.values()).map((stats) => ({
    ...stats,
    avgScore: stats.solvedGames > 0 ? (stats.totalGuesses / stats.solvedGames).toFixed(2) : 0,
    solveRate: (stats.solvedGames / stats.totalGames).toFixed(2),
    recentPattern: stats.recentScores
      .map((s) => (s.solved ? s.score : "X"))
      .reverse()
      .join(" | "),
  }));
}

async function getLeaderboardData(type) {
  const now = new Date();
  const maxGames = type === LEADERBOARD.WEEKLY ? 7 : 31;

  let dateFrom;
  if (type === LEADERBOARD.WEEKLY) {
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    dateFrom = new Date(now);
    dateFrom.setDate(now.getDate() - daysToMonday);
    dateFrom.setHours(0, 0, 0, 0);
  } else if (type === LEADERBOARD.MONTHLY) {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    dateFrom = new Date(0); // All time
  }

  const allTimeScores = await getUserScores(new Date(0));
  const periodScores = type === LEADERBOARD.ALL ? allTimeScores : await getUserScores(dateFrom);

  // Calculate scores and sort
  return periodScores
    .map((userStats) => ({
      ...userStats,
      score: wordleScore(userStats.scores, type),
    }))
    .sort((a, b) => b.score - a.score);
}
