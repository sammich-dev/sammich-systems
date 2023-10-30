/*
  Warnings:

  - Added the required column `playerIndex` to the `RecordedGame` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seed` to the `RecordedGame` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecordedGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "frames" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "playerIndex" INTEGER NOT NULL
);
INSERT INTO "new_RecordedGame" ("frames", "gameId", "id") SELECT "frames", "gameId", "id" FROM "RecordedGame";
DROP TABLE "RecordedGame";
ALTER TABLE "new_RecordedGame" RENAME TO "RecordedGame";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
