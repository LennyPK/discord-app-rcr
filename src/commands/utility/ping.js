const { SlashCommandBuilder } = require("discord.js");
const { sendPaginatedList } = require("../../pagination");

module.exports = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!"),
  async execute(interaction) {
    await interaction.reply("Pong!!");

    // const items = Array.from({ length: 100 }, (_, i) => `Item ${i + 1}`);

    // await sendPaginatedList(interaction, items, {
    //   itemsPerPage: 10,
    //   title: "Item List",
    //   description: "This is an item list.",
    //   listTitle: "Items",
    //   formatItem: (item, idx) => `${idx + 1}. Item ${item}`,
    //   ephemeral: false,
    //   followUp: true,
    // });
  },
};
