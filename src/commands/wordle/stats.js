const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../prisma-client");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_stats")
    .setDescription("Display your Wordle statistics"),
  async execute(interaction) {
    const userId = interaction.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wordles: { orderBy: { date: "desc" } } },
    });

    const allUsers = await prisma.user.findMany({
      include: { wordles: true },
    });

    const overallStats = await getOverallStats(user);
    const rankings = await getRankings(user, allUsers);
    const recentActivity = await getRecentActivity(user);
    const lastGames = await getLastGames(user, 10);

    // console.info(user);
    // console.info(overallStats);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(5763719)
          .setTitle("📊 Wordle Stats for " + user.globalName)
          .setDescription("Summary of your Wordle stats")
          .addFields(
            {
              name: "🏆 Overall Statistics",
              value: `Total Games: ${
                overallStats.totalGames
              }\nAverage Score: ${overallStats.averageScore.toFixed(2)}\nBest Streak: ${
                overallStats.bestStreak
              }\nCurrent Streak: ${overallStats.currentStreak}`,
              inline: true,
            },
            {
              name: "🏅 Ranking",
              value: `Rank: ${rankings.rank}/${rankings.total}`,
              inline: true,
            },
            {
              name: "🔔 Recent Activity",
              value: `This Week: ${recentActivity.recentGames.length} games\nRecent Average: ${
                recentActivity.recentGames.length
                  ? (
                      recentActivity.recentGames.reduce((a, w) => a + w.score, 0) /
                      recentActivity.recentGames.length
                    ).toFixed(2)
                  : "N/A"
              }\nLast Day Missed: ${
                recentActivity.lastMissed
                  ? recentActivity.lastMissed.date.toLocaleDateString("en-GB")
                  : "N/A"
              }`,
              inline: true,
            },
            {
              name: "⚔️ Last 10 Games",
              value: `${lastGames.games.join(" • ")}`,
            }
          )
          .setFooter({
            text: "Last Played: " + user.wordles[0].date.toLocaleDateString("en-GB"),
          })
          .setTimestamp(),
      ],
    });
  },
};

async function getOverallStats(user) {
  const totalGames = user.wordles.length;

  const solvedGames = user.wordles.filter((w) => w.solved);
  const averageScore = solvedGames.reduce((acc, w) => acc + (w.score ?? 0), 0) / solvedGames.length;

  const streaks = user.wordles.sort((a, b) => a.date.getTime() - b.date.getTime());

  let bestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < streaks.length; i++) {
    if (streaks[i].solved) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  currentStreak = tempStreak;

  return { totalGames, averageScore, bestStreak, currentStreak };
}

async function getRankings(user, allUsers) {
  const rankingData = allUsers.map((u) => {
    const solved = u.wordles.filter((w) => w.solved);
    const avg = solved.reduce((a, w) => a + (w.score ?? 0), 0) / (solved.length || 1);
    return { username: u.username, avg };
  });

  // lower avg is better in Wordle
  rankingData.sort((a, b) => a.avg - b.avg);

  const rank = rankingData.findIndex((r) => r.username === user.username) + 1;
  const total = rankingData.length;

  return { rank, total };
}

async function getRecentActivity(user) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const recentGames = user.wordles.filter((w) => w.date >= weekAgo && w.solved);

  const lastGame = user.wordles.sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const lastMissed = user.wordles
    .filter((w) => !w.solved)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  return { recentGames, lastGame, lastMissed };
}

async function getLastGames(user, amount) {
  const games = user.wordles
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, amount)
    .map((w) => (w.solved ? w.score : "X"))
    .reverse(); // optional, to show oldest → newest

  return { games };
}
