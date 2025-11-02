const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../prisma-client");
const { wait } = require("../../utils");

async function updateMembers(interaction) {
  /** Fetch all guild members */
  await interaction.editReply("Updating users...");

  await wait(1000);

  const guild = interaction.guild;
  await guild.members.fetch();
  const members = guild.members.cache;

  const membersToSave = members.filter((member) => !member.user.bot);

  const result = await saveMembers(membersToSave);

  await interaction.editReply({
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(5763719)
        .setTitle("✅ Member sync complete!")
        .setDescription("All members have been synced with the database.")
        .addFields(
          {
            name: "🆕 Created",
            value: `**${result.createdUsers}** ${result.createdUsers === 1 ? "user" : "users"}`,
            inline: true,
          },
          {
            name: "🔄 Updated",
            value: `**${result.updatedUsers}** ${result.updatedUsers === 1 ? "user" : "users"}`,
            inline: true,
          },
          {
            name: "👥 Synchronized Users",
            value:
              result.users.length === 0
                ? "*No users synchronized*"
                : result.users
                    .slice(0, 20)
                    .map((user) => `- <@${user.discordId}>`)
                    .join("\n"),
          }
        )
        .setTimestamp(),
    ],
  });
}

async function saveMembers(members) {
  console.info("Saving members to database...");

  /** Defensive check */
  if (!members || members.size === 0) return { createdUsers: 0, updatedUsers: 0 };

  /** Extract all Discord IDs (Collection.map passes the value as the first arg) */
  const discordIds = members.map((member) => member.user?.id).filter(Boolean);

  /** Fetch existing users */
  const existingUsers = await prisma.user.findMany({
    where: { discordId: { in: discordIds } },
    select: { discordId: true },
  });

  /** Build a lookup Set */
  const existingIds = new Set(existingUsers.map((user) => user.discordId));

  let created = 0;
  let updated = 0;

  /** Loop through members */
  const savedUsers = [];
  for (const [id, member] of members) {
    const { user, nickname } = member;

    /** Defensive check */
    if (!user) continue;

    const isExisting = existingIds.has(user.id);

    const savedUser = await prisma.user.upsert({
      where: { discordId: id },
      update: {
        username: user.username,
        guildName: nickname || user.username,
        globalName: user.globalName || user.username,
      },
      create: {
        discordId: id,
        username: user.username,
        guildName: nickname || user.username,
        globalName: user.globalName || user.username,
      },
    });

    if (isExisting) updated++;
    else created++;

    savedUsers.push(savedUser);
  }

  console.info("...Saved members to database.");

  return {
    createdUsers: created,
    updatedUsers: updated,
    users: savedUsers,
  };
}

async function execute(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    updateMembers(interaction);
  } catch (error) {
    console.error(error);
    await interaction.editReply("There was an error while executing this command!");
    return;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update_members")
    .setDescription(
      "Sync all server members to the database; create new user records and update existing ones."
    ),
  execute,
  updateMembers,
};
