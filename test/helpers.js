/** All Wordle dates are calculated in the bot's timezone, so pin it for every test */
process.env.TZ = "Pacific/Auckland";

/** Local date at midnight (month is 1-based, unlike `new Date`) */
function day(year, month, date, hours = 0) {
  return new Date(year, month - 1, date, hours);
}

/** Timeline entries, as produced by `buildFullTimeline` */
const solved = (score) => ({ date: new Date(), status: "solved", score });
const failed = () => ({ date: new Date(), status: "failed", score: null });
const missing = () => ({ date: new Date(), status: "missing", score: null });

/** Repeat an entry factory `n` times */
const times = (n, make) => Array.from({ length: n }, make);

module.exports = { day, solved, failed, missing, times };
