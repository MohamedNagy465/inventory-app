-- CreateTable
CREATE TABLE "ShiftSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "openingCash" REAL NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "ShiftSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShiftReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceCount" INTEGER NOT NULL,
    "totalSales" REAL NOT NULL,
    "cashSales" REAL NOT NULL,
    "halfCreditSales" REAL NOT NULL,
    "creditSales" REAL NOT NULL,
    "openingCash" REAL NOT NULL DEFAULT 0,
    "expectedCash" REAL NOT NULL DEFAULT 0,
    "collected" REAL NOT NULL,
    "creditAmount" REAL NOT NULL,
    "countedCash" REAL,
    "difference" REAL,
    "note" TEXT,
    CONSTRAINT "ShiftReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ShiftReport" ("cashSales", "closedAt", "collected", "countedCash", "creditAmount", "creditSales", "difference", "halfCreditSales", "id", "invoiceCount", "note", "periodStart", "totalSales", "userId") SELECT "cashSales", "closedAt", "collected", "countedCash", "creditAmount", "creditSales", "difference", "halfCreditSales", "id", "invoiceCount", "note", "periodStart", "totalSales", "userId" FROM "ShiftReport";
DROP TABLE "ShiftReport";
ALTER TABLE "new_ShiftReport" RENAME TO "ShiftReport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ShiftSession_userId_closedAt_idx" ON "ShiftSession"("userId", "closedAt");
