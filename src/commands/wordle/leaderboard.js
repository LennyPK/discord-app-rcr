const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");

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

  let title, description;

  switch (type) {
    case LEADERBOARD.WEEKLY:
      title = ":date: Weekly Wordle Leaderboard";
      description = "Rankings from Monday to today (**" + weekProgress + " days so far**).";
      break;
    case LEADERBOARD.MONTHLY:
      title = ":calendar_spiral: Monthly Wordle Leaderboard";
      description =
        "Rankings from the start of this month to today (**" + monthProgress + " days so far**).";
      break;
    case LEADERBOARD.ALL:
      title = ":earth_asia: All-Time Wordle Leaderboard";
      description = "Cumulative rankings  across all recorded Wordles";
  }

  return await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(5763719)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp(),
    ],
  });
}
