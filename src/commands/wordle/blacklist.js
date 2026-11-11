const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../prisma-client");

const EMBED_COLOR = 5763719;
const MAX_CHOICES = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_blacklist")
    .setDescription("Hide players from the Wordle leaderboards (their scores are still recorded)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Hide a player from the leaderboards")
        .addStringOption((option) =>
          option
            .setName("user")
            .setDescription("Player to hide (includes players who have left the server)")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Show a hidden player on the leaderboards again")
        .addStringOption((option) =>
          option
            .setName("user")
            .setDescription("Player to show again")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List hidden players")),

  /** Suggest players from the database, so players who left the server can still be picked */
  async autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const query = interaction.options.getFocused().trim();

    const users = await prisma.user.findMany({
      where: {
        excluded: subcommand === "remove",
        ...(query && {
          OR: [
            { id: { contains: query } },
            { username: { contains: query } },
            { globalName: { contains: query } },
            { guildName: { contains: query } },
          ],
        }),
      },
      orderBy: { wordles: { _count: "desc" } },
      take: MAX_CHOICES,
    });

    await interaction.respond(
      users.map((user) => ({ name: displayName(user).slice(0, 100), value: user.id }))
    );
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") return await listExcluded(interaction);

    const user = await resolveUser(interaction.options.getString("user"));
    if (!user) {
      return await interaction.reply({
        content: "Couldn't find that player in the database. Pick one from the suggestions.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const excluded = subcommand === "add";
    if (user.excluded === excluded) {
      return await interaction.reply({
        content: `${displayName(user)} is already ${excluded ? "hidden from" : "shown on"} the leaderboards.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { excluded } });

    await interaction.reply({
      content: excluded
        ? `Hidden **${displayName(user)}** from the leaderboards. Their scores are still recorded.`
        : `**${displayName(user)}** will show on the leaderboards again.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

/**
 * Find a user from an autocomplete value (Discord ID), a pasted mention, or an exact name.
 * @param {string} input
 */
async function resolveUser(input) {
  const value = input.trim();
  const id = value.match(/^<@!?(\d+)>$/)?.[1] ?? (/^\d+$/.test(value) ? value : null);

  if (id) return await prisma.user.findUnique({ where: { id } });

  return await prisma.user.findFirst({
    where: { OR: [{ username: value }, { globalName: value }, { guildName: value }] },
  });
}

function displayName(user) {
  if (user.globalName === "unknown") return `Unknown player (${user.id})`;
  return user.globalName === user.username
    ? user.globalName
    : `${user.globalName} (@${user.username})`;
}

async function listExcluded(interaction) {
  const users = await prisma.user.findMany({
    where: { excluded: true },
    orderBy: { globalName: "asc" },
  });

  /** Names are shown alongside mentions, since mentions of players who left don't resolve */
  const description =
    users.length > 0
      ? users.map((user) => `- <@${user.id}> ${displayName(user)}`).join("\n")
      : "No players are hidden.";

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(":no_entry_sign: Hidden from Leaderboards")
        .setDescription(description.slice(0, 4096))
        .setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  });
}
