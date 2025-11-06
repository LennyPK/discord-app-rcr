const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { wait } = require("../../utils");
const { prisma } = require("../../prisma-client");
const { updateMembers } = require("../utility/update-members");
const { sendPaginatedList } = require("../../pagination");
require("dotenv/config");

const wordleAppId = process.env.WORDLE_APP_ID;

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
        .setDescription(
          "Scrape messages until this date (YYYY-MM-DD). Defaults to the beginning of Wordle (May 2025)."
        )
        .setRequired(true)
        .addChoices(
          {
            name: `Last 7 days (since ${new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toLocaleDateString("en-GB")})`,
            value: RANGE.WEEK,
          },
          {
            name: `Last 30 days (since ${new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toLocaleDateString("en-GB")})`,
            value: RANGE.MONTH,
          },
          { name: "All Time (default)", value: RANGE.ALL }
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
      // TODO: Change Ephemeral flag if content needs to be displayed
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      /** Extract command options */
      const range = interaction.options.getString("range");
      const verbose = interaction.options.getBoolean("verbose");

      /** Fetch all guild members */
      // TODO: Enable after testing
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
  const resultRegex = /here are yesterday'?s results/i;

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
      if (
        message.author.bot &&
        message.author.id === wordleAppId &&
        resultRegex.test(message.content)
      ) {
        allMessages.push(message);
      }
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

  const scoreRegex = /(?:👑)?\s*([1-6X])\/6:\s*(.*)/;
  const userRegex = /(?:<@(\d+)>|@([a-zA-Z0-9_]+))/g;

  let scoresFound = 0;

  for (const [index, message] of messages.entries()) {
    console.info("=======================");
    console.info(`Processing message ${index + 1}/${messages.length}: ${message.id}`);

    const lines = message.content.split("\n");

    const createdAt = new Date(message.createdTimestamp);
    const wordleDate = new Date(createdAt);
    wordleDate.setDate(createdAt.getDate() - 1);
    wordleDate.setHours(12, 0, 0, 0);
    console.info("Timestamp: " + message.createdTimestamp);
    console.info("Message date: " + createdAt.toLocaleDateString("en-GB"));
    console.info("Message time: " + createdAt.toLocaleTimeString("en-GB"));
    console.info("Wordle date: " + wordleDate.toLocaleDateString("en-GB"));
    console.info("Wordle time: " + wordleDate.toLocaleTimeString("en-GB"));

    for (const line of lines) {
      const scoreMatch = line.match(scoreRegex);
      if (!scoreMatch) continue;

      const scoreValue = scoreMatch[1];
      const solved = scoreValue !== "X";
      const score = solved ? parseInt(scoreValue, 10) : null;
      const usersPart = scoreMatch[2];

      /** reset regex state before iterating matches for this line */
      userRegex.lastIndex = 0;
      let userMatch;

      while ((userMatch = userRegex.exec(usersPart)) !== null) {
        const discordId = userMatch[1];
        const username = userMatch[2];

        let dbUser = null;

        if (discordId) {
          /** Prefer exact match on Discord ID (stored in the `id` field in the DB). */
          dbUser = await prisma.user.findUnique({ where: { id: discordId } });

          if (!dbUser) {
            /** Create a placeholder user linked to the Discord ID only. */
            dbUser = await prisma.user.create({
              data: {
                id: discordId,
                username: "unknown",
                guildName: "unknown",
                globalName: "unknown",
              },
            });
          }
        } else if (username) {
          /** If only a name is present, try to resolve to an existing user by name.
           * If not found, skip — do not create users based on name alone.
           */
          dbUser = await prisma.user.findFirst({
            where: {
              OR: [{ globalName: username }, { username: username }, { guildName: username }],
            },
          });

          if (!dbUser) {
            console.info(`Skipping user '${username}' (not found by name and no Discord ID)`);
            continue;
          }
        } else {
          /** No identifier — skip */
          console.info("Skipping unidentified user mention");
          continue;
        }

        try {
          /** Upsert the Wordle result for the found/created user */
          await prisma.wordle.upsert({
            where: {
              userId_date: {
                userId: dbUser.id,
                date: wordleDate,
              },
            },
            update: {
              score: score,
              solved: solved,
            },
            create: {
              userId: dbUser.id,
              score: score,
              solved: solved,
              date: wordleDate,
            },
          });
          console.info(
            "Wordle score [" +
              score +
              "] recorded for " +
              dbUser.globalName +
              " on " +
              wordleDate.toLocaleDateString("en-GB")
          );
        } catch (error) {
          console.error(error.message);
        }

        scoresFound++;
      }
    }
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
    formatItem: (user, idx) => `- <@${user.id}>: ${user._count.wordles} Wordles`,
    ephemeral: false,
    followUp: true,
    publicNavPerm: true,
  });
}
