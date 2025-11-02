const { PrismaClient } = require("../generated/prisma/index.js");

const prisma = new PrismaClient();

module.exports = { prisma };
