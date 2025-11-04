const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_stats")
    .setDescription("Display your Wordle statistics"),
  async execute(interaction) {
    await interaction.reply("My stats!");
  },
};
