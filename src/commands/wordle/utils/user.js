const { prisma } = require("../../../prisma-client");

async function getUser(userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: { wordles: { orderBy: { date: "desc" } } },
  });
}

async function getAllUsers() {
  return await prisma.user.findMany({
    where: { wordles: { some: {} } },
    include: { wordles: { orderBy: { date: "desc" } } },
  });
}

module.exports = { getUser, getAllUsers };
