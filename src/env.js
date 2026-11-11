const path = require("node:path");

/** Load .env from the project root, regardless of the folder the bot is started from */
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
