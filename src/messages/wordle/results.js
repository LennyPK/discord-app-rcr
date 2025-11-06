module.exports = {
  name: "results",
  condition: (message) => message.content.includes("Here are yesterday's results"),
  async execute(message) {
    message.reply("got to save scores");
  },
};
