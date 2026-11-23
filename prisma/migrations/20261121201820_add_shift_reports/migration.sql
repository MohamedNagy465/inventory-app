-- CreateTable
CREATE TABLE "ShiftReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceCount" INTEGER NOT NULL,
    "totalSales" REAL NOT NULL,
    "cashSales" REAL NOT NULL,
    "halfCreditSales" REAL NOT NULL,
    "creditSales" REAL NOT NULL,
    "collected" REAL NOT NULL,
    "creditAmount" REAL NOT NULL,
    "countedCash" REAL,
    "difference" REAL,
    "note" TEXT,
    CONSTRAINT "ShiftReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
