const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { prisma } = require("../../prisma-client");
const { calculateScore, rankPlayers } = require("./utils/scoring");
const { PERIOD, getPeriodRange } = require("./utils/periods");
const { valueMultiples } = require("../../utils");
const { getFirstRecord, getLastRecord, buildFullTimeline } = require("./utils/timeline");

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

    if (!user || user.wordles.length === 0) {
      await interaction.reply({
        content: "No Wordles recorded for you yet. Play today's Wordle and check back tomorrow!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const overallStats = await getOverallStatistics(user);
    const rankings = await getRankings(user);
    const recentActivity = await getRecentActivity(user);
    const lastGames = await getLastGames(user, 10);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(5763719)
          .setTitle(":star2: Wordle Stats for " + user.globalName)
          .setDescription("Summary of your Wordle stats")
          .addFields(
            {
              name: ":medal: Ranking",
              value: rankings.summary + "\n" + rankings.scoreSummary,
              inline: false,
            },
            { name: "", value: "", inline: false },
            {
              name: ":clipboard: Overall Statistics",
              value:
                overallStats.totalSummary +
                "\n" +
                overallStats.solveSummary +
                "\n" +
                overallStats.averageSummary +
                "\n" +
                overallStats.streakSummary,
              inline: true,
            },
            { name: "\u200B", value: "\u200B", inline: true },
            {
              name: ":bell: Recent Activity",
              value:
                recentActivity.weeklySummary +
                "\n" +
                recentActivity.averageSummary +
                "\n" +
                recentActivity.lastMissedSummary,
              inline: true,
            },
            { name: "", value: "", inline: false },
            {
              name: ":crossed_swords: Last 10 Wordles",
              value: lastGames.summary,
              inline: false,
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

async function getRankings(user) {
  /** Same all-time ranking as `/wordle_leaderboard type:all` */
  const everyone = await rankPlayers(await getPeriodRange(PERIOD.ALL), { includeExcluded: true });
  const rankings = everyone.filter((entry) => !entry.user.excluded);

  const own = everyone.find((entry) => entry.user.id === user.id);
  const score = own ? own.score : 0;

  /** Blacklisted players can still see their own score, but aren't ranked */
  const index = rankings.findIndex((entry) => entry.user.id === user.id);
  const rank = user.excluded ? "Hidden" : index === -1 ? "-" : index + 1;

  const summary = `Rank: \`${rank}\`/\`${rankings.length}\``;
  const scoreSummary = `Score: \`${score.toFixed(2)}\``;

  return { summary, scoreSummary };
}

async function getOverallStatistics(user) {
  /** Total Games */
  const gamesPlayedCount = user.wordles.length;
  const firstRecord = await getFirstRecord();
  const lastRecord = await getLastRecord();

  const fullTimeline = await buildFullTimeline(user.wordles, firstRecord.date, lastRecord.date);
  const { metrics } = calculateScore(fullTimeline);

  const firstDateMs = new Date(firstRecord.date).getTime();
  const lastDateMs = new Date(lastRecord.date).getTime();
  const totalWordles = Math.round((lastDateMs - firstDateMs) / (1000 * 60 * 60 * 24)) + 1;

  const gamesPlayedSummary = `Total Games: \`${gamesPlayedCount}\`/\`${totalWordles}\``;

  /** Solves */
  const averageGuessSummary = `Average Guesses: \`${metrics.avgGuesses.toFixed(1)}\``;
  const solveSummary = `Solve Rate: \`${(metrics.solveRate * 100).toFixed(1)}%\``;

  /** Streaks */
  let bestStreak = 0;
  let currStreak = 0;
  let tempStreak = 0;

  const orderedTimeline = [...fullTimeline].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (let i = 0; i < orderedTimeline.length; i++) {
    if (orderedTimeline[i].status === "solved") {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  currStreak = tempStreak;

  const bestStreakSummary = `Best Streak: \`${bestStreak} Wordle${valueMultiples(bestStreak)}\``;
  const currStreakSummary = `Current Streak: \`${currStreak} Wordle${valueMultiples(currStreak)}\``;

  return {
    totalSummary: gamesPlayedSummary,
    averageSummary: averageGuessSummary,
    solveSummary: solveSummary,
    streakSummary: bestStreakSummary + "\n" + currStreakSummary,
  };
}

async function getRecentActivity(user) {
  const firstRecord = await getFirstRecord();
  const lastRecord = await getLastRecord();

  const fullTimeline = await buildFullTimeline(user.wordles, firstRecord.date, lastRecord.date);

  /** Games This Week */
  const now = new Date();

  // Get the number of days elapsed in the current week
  const dayOfWeek = now.getDay();

  let denominator;
  if (dayOfWeek === 1) {
    // Monday => show full prev week
    denominator = 7;
  } else if (dayOfWeek === 0) {
    // Sunday => show Mon-Sat
    denominator = 6;
  } else {
    // Tue-Sat
    denominator = dayOfWeek - 1;
  }

  // Calculate the start of the counting period
  const startOfPeriod = new Date(now);
  if (dayOfWeek === 1) {
    // Monday => get full prev week scores
    startOfPeriod.setDate(now.getDate() - 7);
  } else {
    // Other days => current weeks Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfPeriod.setDate(now.getDate() + diffToMonday);
  }
  startOfPeriod.setHours(0, 0, 0, 0);

  // Count games up to yesterday
  const endOfPeriod = new Date(now);
  endOfPeriod.setHours(0, 0, 0, 0);

  const participatedGames = fullTimeline.filter(
    (entry) => entry.date >= startOfPeriod && entry.date < endOfPeriod && entry.status !== "missing"
  );

  const weekGamesSummary = `This Week: \`${participatedGames.length}\`/\`${denominator} Wordles\``;

  /** Recent Average */
  const solvedGames = participatedGames.filter((entry) => entry.status === "solved");
  const recentAverage = solvedGames.length
    ? (solvedGames.reduce((acc, wordle) => acc + wordle.score, 0) / solvedGames.length).toFixed(1)
    : "N/A";

  const averageSummary = `Recent Average: \`${recentAverage}\``;

  /** Last Missed */
  const lastMissed = fullTimeline
    .filter((entry) => entry.status !== "solved")
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const lastMissedSummary = `Last Day Missed: \`${
    lastMissed ? lastMissed.date.toLocaleDateString("en-GB") : "N/A"
  }\``;

  return {
    weeklySummary: weekGamesSummary,
    averageSummary: averageSummary,
    lastMissedSummary: lastMissedSummary,
  };
}

async function getLastGames(user, amount) {
  const firstRecord = await getFirstRecord();
  const lastRecord = await getLastRecord();

  const fullTimeline = await buildFullTimeline(user.wordles, firstRecord.date, lastRecord.date);

  const lastGames = fullTimeline
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, amount)
    .map(
      (wordle) =>
        wordle.status === "solved"
          ? `\`${wordle.score}\``
          : wordle.status === "failed"
          ? "`×`"
          : "`\u2591`" // for missed days
    );
  const games = lastGames.join(" • ");

  const visibleGames = games.replace(/`/g, "");
  const leftLabel = "newer";
  const rightLabel = "older";
  const totalLength = visibleGames.length;
  const spacing = Math.max(1, totalLength - leftLabel.length - rightLabel.length - 10);
  const labels = leftLabel + " <<" + "=".repeat(spacing) + "<< " + rightLabel;

  const summary = `${games}\n-# ${labels}`;

  return { summary };
}
