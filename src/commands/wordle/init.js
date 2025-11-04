const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { wait } = require("../../utils");
const { prisma } = require("../../prisma-client");
const { updateMembers } = require("../utility/update-members");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordle_init")
    .setDescription("Initialize the leaderboard and scrape the channel for users and scores")
    .addStringOption((option) =>
      option
        .setName("range")
        .setDescription(
          "Scrape messages until this date (YYYY-MM-DD). Defaults to the beginning of Wordle (May 2025)."
        )
        .setRequired(false)
        .addChoices(
          {
            name: `Last 7 days (since ${new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toLocaleDateString("en-GB")})`,
            value: "weekly",
          },
          {
            name: `Last 30 days (since ${new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toLocaleDateString("en-GB")})`,
            value: "monthly",
          },
          { name: "All Time (default)", value: "all" }
        )
    ),
  async execute(interaction) {
    try {
      // TODO: Change Ephemeral flag if content needs to be displayed
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const range = interaction.options.getString("range");

      /** Fetch all guild members */
      // TODO: Enable after testing
      // await updateMembers(interaction);

      // await wait(5000);

      await scrapeMessages(interaction, range);
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
      case "weekly":
        scanUntil = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        scanUntil = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        break;
    }
  }

  await interaction.editReply({
    content:
      "-# Scraping channel for Wordle scores since " +
      scanUntil.toLocaleDateString("en-GB") +
      "...",
    embeds: [],
  });
  console.info(
    `Scraping channel for Wordle scores since ${scanUntil.toLocaleDateString("en-GB")}...`
  );

  await wait(2000);

  /** Parse messages */
  const channel = interaction.channel;

  const wordleResults = await fetchResultsUntil(interaction, channel, scanUntil);

  console.info(`Messages array length: ${wordleResults.length}`);
  await interaction.editReply(
    `-# Fetched ${wordleResults.length} messages since ${scanUntil.toLocaleDateString("en-GB")}`
  );
  console.info(wordleResults[wordleResults.length - 1].content);
  console.info(new Date(wordleResults[wordleResults.length - 1].createdTimestamp).getDate());

  await wait(2000);

  // TODO: fetch
  // console.info(wordleResults.map((message) => message.content));
  parseScores(interaction, wordleResults);
}

async function fetchResultsUntil(interaction, channel, untilDate) {
  const allMessages = [];
  let lastId = undefined;
  const limit = 100;
  const wordleAppId = "1211781489931452447";
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
    for (const msg of messages) {
      if (msg.createdTimestamp < untilDate) {
        reachedUntil = true;
        break;
      }
      if (msg.author.bot && msg.author.id === wordleAppId && resultRegex.test(msg.content)) {
        allMessages.push(msg);
      }
    }

    /** Stop if we reached the target date */
    if (reachedUntil) break;

    /** Update pagination marker */
    lastId = messages[messages.length - 1].id;

    console.info(`Fetched ${allMessages.length} messages so far...`);
    await interaction.editReply(`-# Fetched ${allMessages.length} messages so far...`);

    /** Optional: rate-limit safety pause */
    await wait(500);
  }

  return allMessages;
}

async function parseScores(interaction, messages) {
  console.info("Parsing scores...");
  await interaction.editReply("-# Parsing scores...");

  const scoreRegex = /(?:👑)?\s*([1-6X])\/6:\s*(.*)/;
  const userRegex = /(?:<@(\d+)>|@([a-zA-Z0-9_]+))/g;

  let scoresFound = 0;
  // const wordlePromises = [];

  // for (const message of messages) {
  messages.forEach(async (message, index) => {
    console.info(`Processing message ${index}/${messages.length}: ${message.id}`);

    const lines = message.content.split("\n");

    // const messageDate = new Date(new Date(message.createdTimestamp).setHours(11, 0, 0, 0));
    // const date = new Date(messageDate.setDate(messageDate.getDate() - 1)).toLocaleDateString(
    //   "en-GB"
    // );
    const createdAt = new Date(message.createdTimestamp);
    const wordleDate = new Date(createdAt);
    wordleDate.setDate(createdAt.getDate() - 1);
    wordleDate.setHours(11, 0, 0, 0);
    console.info("Message date: " + createdAt.toLocaleDateString("en-GB"));
    console.info("Message time: " + createdAt.toLocaleTimeString("en-GB"));
    console.info("Wordle date: " + wordleDate.toLocaleDateString("en-GB"));
    console.info("Wordle time: " + wordleDate.toLocaleTimeString("en-GB"));
    // console.info("Message Date: " + message.createdTimestamp);

    for (const line of lines) {
      // console.info("Processing line", line);

      const scoreMatch = line.match(scoreRegex);
      if (!scoreMatch) continue;

      // console.info("-----------------------");
      // console.info("Full match:", scoreMatch[0]);
      // console.info("Score value:", scoreMatch[1]);
      // console.info("Users part:", scoreMatch[2]);
      // console.info("-----------------------");

      const scoreValue = scoreMatch[1];
      const solved = scoreValue !== "X";
      const score = solved ? parseInt(scoreValue, 10) : null;
      const usersPart = scoreMatch[2];

      // reset regex state before iterating matches for this line
      userRegex.lastIndex = 0;
      let userMatch;

      while ((userMatch = userRegex.exec(usersPart)) !== null) {
        const discordId = userMatch[1];
        const username = userMatch[2];

        // console.info("Processing user:", { discordId, username }, "with a score of", score, solved);

        // wordlePromises.push(
        //   (async () => {
        let dbUser = null;

        if (discordId) {
          // Prefer exact match on Discord ID (stored in the `id` field in the DB).
          dbUser = await prisma.user.findUnique({ where: { id: discordId } });

          if (!dbUser) {
            // Create a placeholder user linked to the Discord ID only.
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
          // If only a name is present, try to resolve to an existing user by name.
          // If not found, skip — do not create users based on name alone.
          dbUser = await prisma.user.findFirst({
            where: {
              OR: [{ globalName: username }, { username: username }, { guildName: username }],
            },
          });

          if (!dbUser) {
            console.info(`Skipping user '${username}' (not found by name and no Discord ID)`);
            // return;
            continue;
          }
        } else {
          // No identifier — skip
          console.info("Skipping unidentified user mention");
          // return;
          continue;
        }

        try {
          // Upsert the Wordle result for the found/created user
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
          console.info("Wordle score recorded");
        } catch (error) {
          console.error(error.message);
        }

        scoresFound++;
      }
    }
  });
  // await Promise.all(wordlePromises);
  console.info("...Parsed scores.");

  await interaction.editReply(`Scraping complete. Found and saved ${scoresFound} scores.`);
}
