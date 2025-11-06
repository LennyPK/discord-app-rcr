const { EmbedBuilder } = require("discord.js");
const { prisma } = require("../../prisma-client");

require("dotenv/config");

const wordleAppId = process.env.WORDLE_APP_ID;
const resultRegex = /here are yesterday'?s results/i;

module.exports = {
  name: "results",
  condition: (message) =>
    message.author.bot && message.author.id === wordleAppId && resultRegex.test(message.content),
  async execute(message) {
    const newWordles = [];

    // TODO: Refactor with init.js if bothered

    const scoreRegex = /(?:👑)?\s*([1-6X])\/6:\s*(.*)/;
    const userRegex = /(?:<@(\d+)>|@([a-zA-Z0-9_]+))/g;

    const lines = message.content.split("\n");

    const createdAt = new Date(message.createdTimestamp);
    const wordleDate = new Date(createdAt);
    wordleDate.setDate(createdAt.getDate() - 1);
    wordleDate.setHours(12, 0, 0, 0);
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
          const newWordle = await prisma.wordle.upsert({
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
            include: {
              user: true,
            },
          });
          console.info(
            "Wordle score [" +
              (score || "X") +
              "] recorded for " +
              dbUser.globalName +
              " on " +
              wordleDate.toLocaleDateString("en-GB")
          );

          newWordles.push(newWordle);
        } catch (error) {
          console.error(error.message);
        }
      }
    }

    if (newWordles.length === 0) {
      console.info("No new Wordle scores found");
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(5763719)
            .setTitle("No New Wordles found")
            .setDescription("No changes or additions were made.")
            .setTimestamp(),
        ],
      });
      return;
    } else {
      const summary = [
        `Wordle date: ${wordleDate.toLocaleDateString("en-GB")}`,
        newWordles.map((wordle) => `- [${wordle.score || "X"}] <@${wordle.userId}>`).join("\n"),
      ].join("\n");

      console.info("New Wordle added to database:");
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(5763719)
            .setTitle("New Wordle added to Database")
            .setDescription(summary)
            .setTimestamp(),
        ],
      });
    }
  },
};
