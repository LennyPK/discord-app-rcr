const path = require("node:path");
const { PrismaBetterSQLite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("../generated/prisma/index.js");
require("./env");

/** Prisma resolves relative SQLite paths from the schema's folder, so do the same here */
const PRISMA_DIR = path.join(__dirname, "..", "prisma");

function resolveDatabasePath(databaseUrl = "file:./dev.db") {
  const filePath = databaseUrl.replace(/^file:/, "");
  return path.isAbsolute(filePath) ? filePath : path.join(PRISMA_DIR, filePath);
}

const adapter = new PrismaBetterSQLite3({ url: resolveDatabasePath(process.env.DATABASE_URL) });

const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
