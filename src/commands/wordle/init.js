const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { wait } = require("../../utils");
const { prisma } = require("../../prisma-client");
const { updateMembers } = require("../utility/update-members");
const { sendPaginatedList } = require("../../pagination");
const { isResultsMessage, saveResults } = require("./utils/results");

const RANGE = {
  WEEK: "week",
  MONTH: "month",
  ALL: "all",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_init")
    .setDescription("Initialize the leaderboard and scrape the channel for users and scores")
    .addStringOption((options) =>
      options
        .setName("range")
        .setDescription("How far back to scan this channel for Wordle results")
        .setRequired(true)
        .addChoices(
          { name: "Last 7 days", value: RANGE.WEEK },
          { name: "Last 30 days", value: RANGE.MONTH },
          { name: "All time (since May 2025)", value: RANGE.ALL }
        )
    )
    .addBooleanOption((options) =>
      options
        .setName("verbose")
        .setDescription("Display a summarised list of scores per member.")
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      /** Extract command options */
      const range = interaction.options.getString("range");
      const verbose = interaction.options.getBoolean("verbose");

      /** Sync guild members first, so scores link to real names */
      await updateMembers(interaction);

      await wait(5000);

      const scores = await scrapeMessages(interaction, range);

      await displaySummary(interaction, verbose, scores);
    } catch (error) {
      console.error(error);
      await interaction.editReply("There was an error while executing this command!");
      return;
    }
  },
};

async function scrapeMessages(interaction, range) {
  /** Set date to scan messages since */
  let scanUntil = new Date("2025-05-01");

  /** If `range` is not provided (null), `scanUntil` remains "2025-05-01" (default).
   * Otherwise, update `scanUntil` based on the selected range.
   */
  if (range) {
    switch (range) {
      case RANGE.WEEK:
        scanUntil = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case RANGE.MONTH:
        scanUntil = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        break;
    }
  }

  await interaction.editReply({
    content:
      "-# Scraping channel for Wordle scores since `" +
      scanUntil.toLocaleDateString("en-GB") +
      "`...",
    embeds: [],
  });
  console.info(
    `Scraping channel for Wordle scores since ${scanUntil.toLocaleDateString("en-GB")}...`
  );

  await wait(2000);

  /** Parse messages */
  const channel = interaction.channel;

  const wordleResults = await fetchResultsUntil(interaction, channel, scanUntil);

  console.info(`Total Wordles: ${wordleResults.length}`);
  await interaction.editReply(
    "-# ...fetched a total of " +
      wordleResults.length +
      " Wordle" +
      (wordleResults.length === 1 ? "" : "s") +
      " since `" +
      scanUntil.toLocaleDateString("en-GB") +
      "`."
  );
  if (wordleResults.length > 0) {
    console.info(wordleResults[wordleResults.length - 1].content);
    console.info(
      new Date(wordleResults[wordleResults.length - 1].createdTimestamp).toLocaleDateString("en-GB")
    );
  }

  await wait(2000);

  /** Parse scores and return for display */
  return await parseScores(interaction, wordleResults);
}

async function fetchResultsUntil(interaction, channel, untilDate) {
  const allMessages = [];
  let lastId = undefined;
  const limit = 100;

  while (true) {
    /** Fetch a batch (100 messages max) */
    const fetched = await channel.messages.fetch({ limit, before: lastId });

    /** No more messages */
    if (fetched.size === 0) break;

    /** Convert to array (newest → oldest) */
    const messages = Array.from(fetched.values());

    let reachedUntil = false;

    /** Populate messages array until the date is reached */
    for (const message of messages) {
      if (message.createdTimestamp < untilDate) {
        reachedUntil = true;
        break;
      }
      if (isResultsMessage(message)) allMessages.push(message);
    }

    /** Stop if we reached the target date */
    if (reachedUntil) break;

    /** Update pagination marker */
    lastId = messages[messages.length - 1].id;

    console.info(
      "...(" +
        new Date(fetched.last().createdTimestamp).toLocaleDateString("en-GB") +
        ") fetched " +
        allMessages.length +
        " Wordle" +
        (allMessages.length === 1 ? "" : "s") +
        " so far..."
    );
    await interaction.editReply(
      "-# ...`(" +
        new Date(fetched.last().createdTimestamp).toLocaleDateString("en-GB") +
        ")` fetched " +
        allMessages.length +
        " Wordle" +
        (allMessages.length === 1 ? "" : "s") +
        " so far..."
    );

    /** Optional: rate-limit safety pause */
    await wait(500);
  }

  return allMessages;
}

async function parseScores(interaction, messages) {
  console.info("Parsing individual Wordle scores...");
  await interaction.editReply("-# Parsing individual Wordle scores...");

  let scoresFound = 0;

  for (const [index, message] of messages.entries()) {
    console.info(`Processing message ${index + 1}/${messages.length}`);
    scoresFound += (await saveResults(message)).length;
  }

  console.info("...Parsed scores.");

  return scoresFound;
}

async function displaySummary(interaction, verbose, scoresFound) {
  const users = await prisma.user.findMany({
    where: { wordles: { some: {} } },
    select: {
      id: true,
      _count: { select: { wordles: true } },
    },
    orderBy: { wordles: { _count: "desc" } },
  });

  if (!verbose) {
    return await interaction.editReply({
      content: null,
      embeds: [
        new EmbedBuilder()
          .setColor(5763719)
          .setTitle("✅ Scraping complete!")
          .setDescription("Found and saved `" + scoresFound + "` Wordle scores.")
          .setTimestamp(),
      ],
    });
  }

  await sendPaginatedList(interaction, users, {
    itemsPerPage: 10,
    title: "✅ Scraping complete!",
    description: "Found and saved `" + scoresFound + "` Wordle scores.",
    listTitle: "Total Wordles per User",
    formatItem: (user) => `- <@${user.id}>: ${user._count.wordles} Wordles`,
    ephemeral: false,
    followUp: true,
    publicNavPerm: true,
  });
}
