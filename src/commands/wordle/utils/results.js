const { prisma } = require("../../../prisma-client");
require("../../../env");

const wordleAppId = process.env.WORDLE_APP_ID;

const RESULTS_REGEX = /here are yesterday'?s results/i;
/** e.g. "👑 3/6: <@123> <@456>" or "X/6: @name" */
const SCORE_LINE_REGEX = /(?:👑)?\s*([1-6X])\/6:\s*(.*)/;
const USER_REGEX = /(?:<@(\d+)>|@([a-zA-Z0-9_]+))/g;

/**
 * Whether a message is the Wordle app's daily results post.
 * @param {import("discord.js").Message} message
 */
function isResultsMessage(message) {
  return (
    message.author.bot && message.author.id === wordleAppId && RESULTS_REGEX.test(message.content)
  );
}

/**
 * The Wordle a results post is for: the day before it was posted, stored at 10:00 local time.
 * @param {import("discord.js").Message} message
 */
function getWordleDate(message) {
  const wordleDate = new Date(message.createdTimestamp);
  wordleDate.setDate(wordleDate.getDate() - 1);
  wordleDate.setHours(10, 0, 0, 0);
  return wordleDate;
}

/**
 * Parse the score lines of a results post.
 * @param {string} content
 * @returns {Array<{ discordId: string | undefined, username: string | undefined, score: number | null, solved: boolean }>}
 */
function parseResults(content) {
  const results = [];

  for (const line of content.split("\n")) {
    const scoreMatch = line.match(SCORE_LINE_REGEX);
    if (!scoreMatch) continue;

    const solved = scoreMatch[1] !== "X";
    const score = solved ? parseInt(scoreMatch[1], 10) : null;

    for (const userMatch of scoreMatch[2].matchAll(USER_REGEX)) {
      results.push({ discordId: userMatch[1], username: userMatch[2], score, solved });
    }
  }

  return results;
}

/**
 * Find the database user for a parsed result.
 * Mentions with a Discord ID create a placeholder user if needed; plain names must already exist.
 */
async function resolveUser({ discordId, username }) {
  if (discordId) {
    const user = await prisma.user.findUnique({ where: { id: discordId } });
    if (user) return user;

    return await prisma.user.create({
      data: { id: discordId, username: "unknown", guildName: "unknown", globalName: "unknown" },
    });
  }

  if (username) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ globalName: username }, { username }, { guildName: username }] },
    });
    if (!user) console.info(`Skipping user '${username}' (not found by name and no Discord ID)`);
    return user;
  }

  return null;
}

/**
 * Parse a results post and save every score to the database.
 * @param {import("discord.js").Message} message
 * @returns {Promise<Array<object>>} Saved Wordle records, including their user.
 */
async function saveResults(message) {
  const wordleDate = getWordleDate(message);
  const dateLabel = wordleDate.toLocaleDateString("en-GB");
  console.info(`Saving Wordle results for ${dateLabel} (message ${message.id})`);

  const saved = [];

  for (const result of parseResults(message.content)) {
    const user = await resolveUser(result);
    if (!user) continue;

    try {
      const wordle = await prisma.wordle.upsert({
        where: { userId_date: { userId: user.id, date: wordleDate } },
        update: { score: result.score, solved: result.solved },
        create: { userId: user.id, score: result.score, solved: result.solved, date: wordleDate },
        include: { user: true },
      });

      console.info(`  [${result.score ?? "X"}] ${user.globalName}`);
      saved.push(wordle);
    } catch (error) {
      console.error(`Failed to save Wordle for ${user.id} on ${dateLabel}: ${error.message}`);
    }
  }

  return saved;
}

module.exports = { isResultsMessage, getWordleDate, parseResults, saveResults };
