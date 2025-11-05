function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const WORDLE_APP_ID = "1211781489931452447";

module.exports = {
  wait,
  WORDLE_APP_ID,
};
