const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("wordle-init").setDescription("Replies with Pong!"),
  async execute(interaction) {
    await interaction.reply("Initialise Wordle");
  },
};
