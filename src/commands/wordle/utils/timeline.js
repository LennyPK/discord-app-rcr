const { prisma } = require("../../../prisma-client");

async function getFirstRecord() {
  return await prisma.wordle.findFirst({
    select: { date: true, user: true },
    orderBy: { date: "asc" },
  });
}

async function getLastRecord() {
  return await prisma.wordle.findFirst({
    select: { date: true },
    orderBy: { date: "desc" },
  });
}

async function buildFullTimeline(wordles, startDate, endDate) {
  const wordleMap = new Map();

  for (const wordle of wordles) {
    const key = wordle.date.toLocaleDateString("en-GB");
    wordleMap.set(key, wordle);
  }

  const timeline = [];
  const current = new Date(startDate);
  const last = new Date(endDate);

  while (current <= last) {
    const key = current.toLocaleDateString("en-GB");
    const wordle = wordleMap.get(key);
    let status = "missing";
    let score = null;

    if (wordle) {
      status = wordle.solved ? "solved" : "failed";
      score = wordle.score;
    }

    timeline.push({ date: new Date(current), status, score });
    current.setDate(current.getDate() + 1);
  }
  return timeline;
}

module.exports = { getFirstRecord, getLastRecord, buildFullTimeline };
