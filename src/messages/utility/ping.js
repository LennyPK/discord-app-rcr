module.exports = {
  name: "ping",
  condition: (message) => message.content.includes("!ping") && !message.author.bot,
  async execute(message) {
    message.reply("pong!");
  },
};
