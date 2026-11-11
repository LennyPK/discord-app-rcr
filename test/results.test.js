const { day } = require("./helpers");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const WORDLE_APP_ID = "1211781489931452447";
process.env.WORDLE_APP_ID = WORDLE_APP_ID;

const {
  isResultsMessage,
  getWordleDate,
  parseResults,
} = require("../src/commands/wordle/utils/results");

const RESULTS_POST = [
  "**Your group is on a 12 day streak!** 🔥 Here are yesterday's results:",
  "👑 3/6: <@111> <@222>",
  "4/6: @its_snaz <@333>",
  "X/6: <@444>",
].join("\n");

const message = ({ content = RESULTS_POST, authorId = WORDLE_APP_ID, bot = true, postedAt } = {}) => ({
  content,
  author: { id: authorId, bot },
  createdTimestamp: (postedAt ?? new Date()).getTime(),
});

describe("isResultsMessage", () => {
  it("accepts the Wordle app's results post", () => {
    assert.equal(isResultsMessage(message()), true);
  });

  it("accepts 'yesterdays' without an apostrophe", () => {
    assert.equal(isResultsMessage(message({ content: "Here are yesterdays results:" })), true);
  });

  it("ignores other messages from the Wordle app", () => {
    assert.equal(isResultsMessage(message({ content: "Wordle No. 1,600 is ready!" })), false);
  });

  it("ignores results posted by anyone else", () => {
    assert.equal(isResultsMessage(message({ authorId: "999", bot: true })), false);
    assert.equal(isResultsMessage(message({ authorId: WORDLE_APP_ID, bot: false })), false);
  });
});

describe("parseResults", () => {
  it("parses every player on every score line", () => {
    assert.deepEqual(parseResults(RESULTS_POST), [
      { discordId: "111", username: undefined, score: 3, solved: true },
      { discordId: "222", username: undefined, score: 3, solved: true },
      { discordId: undefined, username: "its_snaz", score: 4, solved: true },
      { discordId: "333", username: undefined, score: 4, solved: true },
      { discordId: "444", username: undefined, score: null, solved: false },
    ]);
  });

  it("ignores lines that aren't scores", () => {
    assert.deepEqual(parseResults("Here are yesterday's results:\nGreat job everyone!"), []);
  });

  it("handles a score line with no players", () => {
    assert.deepEqual(parseResults("5/6:"), []);
  });

  it("only matches letters, numbers and underscores in plain names", () => {
    /** Known limitation: names with other characters are cut short */
    assert.equal(parseResults("2/6: @Jessica.L")[0].username, "Jessica");
  });
});

describe("getWordleDate", () => {
  it("is the day before the post, at 10:00", () => {
    const wordleDate = getWordleDate(message({ postedAt: day(2026, 11, 13, 8) }));
    assert.deepEqual(wordleDate, day(2026, 11, 12, 10));
  });

  it("handles month and year boundaries", () => {
    assert.deepEqual(getWordleDate(message({ postedAt: day(2026, 3, 1, 8) })), day(2026, 2, 28, 10));
    assert.deepEqual(getWordleDate(message({ postedAt: day(2027, 1, 1, 8) })), day(2026, 12, 31, 10));
  });

  it("stays at 10:00 local time across daylight saving changes", () => {
    /** NZ daylight saving starts 27 Sep 2026 and ends 5 Apr 2026 */
    assert.deepEqual(getWordleDate(message({ postedAt: day(2026, 9, 28, 8) })), day(2026, 9, 27, 10));
    assert.deepEqual(getWordleDate(message({ postedAt: day(2026, 4, 6, 8) })), day(2026, 4, 5, 10));
  });
});
