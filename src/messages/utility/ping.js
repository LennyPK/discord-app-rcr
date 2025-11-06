module.exports = {
  name: "ping",
  condition: (message) => message.content.includes("ping"),
  async execute(message) {
    message.reply("pong!");
  },
};
