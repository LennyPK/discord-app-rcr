const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_init")
    .setDescription("Initialize the leaderboard and scrape the channel for users and scores"),
  async execute(interaction) {
    await interaction.reply("Initialise Wordle");
  },
};
