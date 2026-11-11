const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { rankPlayers } = require("./utils/scoring");
const { PERIOD, getPeriodRange } = require("./utils/periods");

const MEDALS = [":first_place:", ":second_place:", ":third_place:"];

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
          { name: "Weekly", value: PERIOD.WEEKLY },
          { name: "Monthly", value: PERIOD.MONTHLY },
          { name: "Yearly", value: PERIOD.YEARLY },
          { name: "All Time", value: PERIOD.ALL }
        )
    ),
  async execute(interaction) {
    const type = interaction.options.getString("type");
    await leaderboard(interaction, type);
  },
};

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {typeof PERIOD[keyof typeof PERIOD]} type
 */
async function leaderboard(interaction, type) {
  const range = await getPeriodRange(type);
  const { title, description } = describePeriod(type, range);
  const rankings = await rankPlayers(range);

  const lines =
    rankings.length > 0
      ? rankings.map(formatRanking)
      : ["-# No Wordles recorded for this period yet."];

  let footer = "No Wordles recorded yet";
  if (range) {
    footer = range.periodDays ? `Day ${range.days}/${range.periodDays}` : `${range.days} Wordles`;
  }

  return await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(5763719)
        .setTitle(title)
        .setDescription(description + "\n" + lines.join("\n"))
        .setFooter({ text: footer })
        .setTimestamp(),
    ],
  });
}

function describePeriod(type, range) {
  /** Name the period after the range it covers (e.g. on the 1st, last month) */
  const periodDate = range ? range.from : new Date();

  switch (type) {
    case PERIOD.WEEKLY:
      return {
        title: ":date: Weekly Wordle Leaderboard",
        description: "Rankings based on Wordles from Monday up to the latest results.",
      };
    case PERIOD.MONTHLY:
      return {
        title: `:calendar_spiral: ${periodDate.toLocaleString("en-GB", { month: "long" })} Wordle Leaderboard`,
        description: "Rankings based on Wordles from the start of the month up to the latest results.",
      };
    case PERIOD.YEARLY:
      return {
        title: `:sparkles: ${periodDate.getFullYear()} Wordle Leaderboard`,
        description: "Rankings based on Wordles from 1 January up to the latest results.",
      };
    default:
      return {
        title: ":earth_asia: All-Time Wordle Leaderboard",
        description: "Cumulative rankings across all recorded Wordles.",
      };
  }
}

function formatRanking({ user, score, metrics }, index) {
  const pos = MEDALS[index] || `${index + 1}.`;
  return (
    `${pos} <@${user.id}> ${score.toFixed(2)}` +
    "\n" +
    `-# ${metrics.gamesPlayed}/${metrics.days}` +
    " • " +
    `${(metrics.solveRate * 100).toFixed(0)}% solved`
  );
}
