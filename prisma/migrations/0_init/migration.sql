-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "globalName" TEXT NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Wordle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "score" INTEGER,
    "solved" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Wordle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_guildName_idx" ON "User"("guildName");

-- CreateIndex
CREATE INDEX "User_globalName_idx" ON "User"("globalName");

-- CreateIndex
CREATE UNIQUE INDEX "Wordle_userId_date_key" ON "Wordle"("userId", "date");

