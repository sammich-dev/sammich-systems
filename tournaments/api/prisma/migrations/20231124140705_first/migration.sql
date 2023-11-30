-- CreateTable
CREATE TABLE "Tournaments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TournamentParticipants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adress" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "TournamentParticipants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournaments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentsMatches" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openDate" DATETIME NOT NULL,
    "resolutionDate" DATETIME NOT NULL,
    "winnerIndex" INTEGER NOT NULL,
    "players" TEXT NOT NULL,
    "scores" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "TournamentsMatches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournaments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tournaments_title_key" ON "Tournaments"("title");
