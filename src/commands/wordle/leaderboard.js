const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_leaderboard")
    .setDescription("Display the selected Wordle leaderboard")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Select the leaderboard range")
        .setRequired(false)
        .addChoices(
          { name: "Weekly", value: "weekly" },
          { name: "Monthly", value: "monthly" },
          { name: "All Time (default)", value: "all" }
        )
    ),
  async execute(interaction) {
    await interaction.reply(`Selected leaderboard: ${interaction.options.getString("type")}`);
  },
};
