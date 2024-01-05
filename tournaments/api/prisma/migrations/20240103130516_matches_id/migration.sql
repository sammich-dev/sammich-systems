-- CreateTable
CREATE TABLE "Tournaments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "finished" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "TournamentParticipants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "TournamentParticipants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentsMatches" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openDate" DATETIME,
    "resolutionDate" DATETIME,
    "winnerIndex" INTEGER,
    "players" TEXT NOT NULL,
    "scores" INTEGER,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "TournamentsMatches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tournaments_title_key" ON "Tournaments"("title");
