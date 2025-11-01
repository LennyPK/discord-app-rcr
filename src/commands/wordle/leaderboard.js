const { SlashCommandBuilder } = require("discord.js");

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
          { name: "Weekly", value: "weekly" },
          { name: "Monthly", value: "monthly" },
          { name: "All Time", value: "all" }
        )
    ),
  async execute(interaction) {
    await interaction.reply(`Selected leaderboard: ${interaction.options.getString("type")}`);
  },
};
