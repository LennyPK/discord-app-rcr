// src/utils/pagination.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  CommandInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
} = require("discord.js");

/**
 * Send paginated embeds from an array of items.
 * @param {ChatInputCommandInteraction} interaction - Interaction to reply to.
 * @param {Array} items - Array of strings or objects to display.
 * @param {object} [options]
 * @param {number} [options.itemsPerPage=10] - Number of items per page.
 * @param {function} [options.formatItem] - Function to format an item into a string (default: item.toString()).
 * @param {string} [options.title] - Embed title.
 * @param {string} [options.description] - Embed description.
 * @param {string} [options.listTitle] - Embed list's title.
 * @param {number} [options.color=0x5781ff] - Embed color.
 * @param {boolean} [options.timeout=120000] - Pagination timeout in ms.
 * @param {boolean} [options.ephemeral=false] - Whether to make the message ephemeral.
 * @param {boolean} [options.followUp=false] - Whether to use followUp instead of reply.
 */
async function sendPaginatedList(interaction, items, options = {}) {
  if (!items || items.length === 0) throw new Error("No items provided for pagination.");

  const {
    itemsPerPage = 10,
    formatItem = (i, idx) => `${idx + 1}. ${i}`,
    title = "Paginated List",
    description = null,
    listTitle = "List Title",
    color = 0x5781ff,
    timeout = 120000,
    ephemeral = false,
    followUp = false,
  } = options;

  // Split items into pages
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const embeds = [];

  for (let i = 0; i < items.length; i += itemsPerPage) {
    const pageItems = items.slice(i, i + itemsPerPage);
    const content = pageItems.map((item, idx) => formatItem(item, i + idx)).join("\n");

    embeds.push(
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .addFields({
          name: listTitle,
          value: content,
        })
        .setFooter({ text: `Page ${Math.floor(i / itemsPerPage) + 1}/${totalPages}` })
    );
  }

  if (embeds.length === 1) {
    // Single page, just send normally
    return followUp
      ? interaction.followUp({ embeds, ephemeral })
      : interaction.reply({ embeds, ephemeral });
  }

  // Pagination buttons
  let currentPage = 0;

  const firstButton = new ButtonBuilder()
    .setCustomId("first")
    .setLabel("⏮️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const prevButton = new ButtonBuilder()
    .setCustomId("prev")
    .setLabel("◀️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  // const pageButton = new ButtonBuilder()
  //   .setCustomId("gap")
  //   .setLabel("\u200b")
  //   .setStyle(ButtonStyle.Secondary)
  //   .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId("next")
    .setLabel("▶️")
    .setStyle(ButtonStyle.Primary);

  const lastButton = new ButtonBuilder()
    .setCustomId("last")
    .setLabel("⏭️")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(
    firstButton,
    prevButton,
    // pageButton,
    nextButton,
    lastButton
  );

  const msg = followUp
    ? await interaction.followUp({ embeds: [embeds[currentPage]], components: [row], ephemeral })
    : await interaction.reply({ embeds: [embeds[currentPage]], components: [row], ephemeral });

  const collector = msg.createMessageComponentCollector({ time: timeout });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        content: "You can't control this pagination.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (i.customId === "first") currentPage = 0;
    if (i.customId === "prev") currentPage--;
    if (i.customId === "next") currentPage++;
    if (i.customId === "last") currentPage = embeds.length - 1;

    currentPage = Math.max(0, Math.min(currentPage, embeds.length - 1));

    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage === embeds.length - 1;

    row.components[0].setDisabled(isFirstPage); // firstButton
    row.components[1].setDisabled(isFirstPage); // prevButton
    // row.components[2].setLabel(`Page ${currentPage + 1}/${embeds.length}`); // pageButton
    row.components[2].setDisabled(isLastPage); // nextButton
    row.components[3].setDisabled(isLastPage); // lastButton

    await i.update({ embeds: [embeds[currentPage]], components: [row] });
  });

  collector.on("end", async () => {
    row.components.forEach((btn) => btn.setDisabled(true));
    await msg.edit({ components: [row] }).catch(() => {});
  });

  return msg;
}

module.exports = { sendPaginatedList };
