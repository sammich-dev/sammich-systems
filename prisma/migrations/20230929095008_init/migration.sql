-- CreateTable
CREATE TABLE "User" (
    "ID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "address" TEXT NOT NULL,
    "displayName" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ID_UNIQUE" ON "User"("ID");
