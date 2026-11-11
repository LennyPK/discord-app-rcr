const { EmbedBuilder } = require("discord.js");
const { isResultsMessage, getWordleDate, saveResults } = require("../../commands/wordle/utils/results");

const EMBED_COLOR = 5763719;

module.exports = {
  name: "results",
  condition: isResultsMessage,
  async execute(message) {
    const newWordles = await saveResults(message);

    if (newWordles.length === 0) {
      console.info("No new Wordle scores found");
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("No New Wordles found")
            .setDescription("No changes or additions were made.")
            .setTimestamp(),
        ],
      });
      return;
    }

    const summary = [
      `Wordle date: ${getWordleDate(message).toLocaleDateString("en-GB")}`,
      newWordles
        .map((wordle, index) => `${index + 1}. [${wordle.score || "X"}] <@${wordle.userId}>`)
        .join("\n"),
    ].join("\n");

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle("New Wordle added to Database")
          .setDescription(summary)
          .setTimestamp(),
      ],
    });
  },
};
