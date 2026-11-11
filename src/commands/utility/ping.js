const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");

const EMBED_COLOR = 5763719;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check that the bot is online and see its response time"),
  async execute(interaction) {
    const sent = Date.now();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const roundTrip = Date.now() - sent;

    /** -1 until the first heartbeat after login */
    const websocket = interaction.client.ws.ping;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle(":green_square: Wordle bot is online")
          .addFields(
            { name: ":stopwatch: Response", value: `\`${roundTrip}ms\``, inline: true },
            {
              name: ":satellite: Gateway",
              value: websocket >= 0 ? `\`${websocket}ms\`` : "`measuring…`",
              inline: true,
            },
            { name: ":clock3: Uptime", value: `\`${formatUptime(interaction.client.uptime)}\``, inline: true }
          )
          .setTimestamp(),
      ],
    });
  },
};

/** @param {number} ms */
function formatUptime(ms) {
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return [days && `${days}d`, (days || hours) && `${hours}h`, `${mins}m`].filter(Boolean).join(" ");
}
