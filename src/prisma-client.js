const { PrismaBetterSQLite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("../generated/prisma/index.js");
require("dotenv/config");

const databaseUrl = process.env.DATABASE_URL;

const adapter = new PrismaBetterSQLite3({ url: "./prisma/dev.db" });

const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
