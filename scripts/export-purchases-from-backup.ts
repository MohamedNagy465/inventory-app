import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient as BackupPrismaClient } from "../app/generated/prisma/client";

/**
 * Read-only export of historical purchase invoices from the pre-reset SQLite backup.
 * It does NOT insert purchases, change product stock, or modify the current database.
 *
 * Run from the project root:
 *   npx tsx scripts/export-purchases-from-backup.ts
 */

const backupFileName = "before-reset-2026-11-23T14-56-00-837Z.db";
const backupPath = path.resolve(process.cwd(), "backups", backupFileName);
const exportDirectory = path.resolve(process.cwd(), "exports");

function toSqliteFileUrl(filePath: string): string {
  return `file:${path.resolve(filePath).replace(/\\/g, "/")}`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function main() {
  const backupStat = await fs.stat(backupPath).catch(() => null);
  if (!backupStat?.isFile() || backupStat.size === 0) {
    throw new Error(`لم أجد النسخة الاحتياطية أو أنها فارغة: ${backupPath}`);
  }

  const backupDb = new BackupPrismaClient({
    datasources: { db: { url: toSqliteFileUrl(backupPath) } },
  });

  try {
    const purchases = await backupDb.purchase.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        user: { select: { id: true, name: true } },
        items: {
          orderBy: { id: "asc" },
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    if (purchases.length === 0) {
      console.log("النسخة الاحتياطية لا تحتوي على فواتير شراء.");
      return;
    }

    const exportRows = purchases.flatMap((purchase) =>
      purchase.items.map((item) => ({
        purchaseId: purchase.id,
        purchaseDate: purchase.date.toISOString(),
        supplierName: purchase.supplierName ?? "",
        supplierInvoiceNo: purchase.supplierInvoiceNo ?? "",
        purchaseTotal: purchase.total,
        purchaseNote: purchase.note ?? "",
        createdBy: purchase.user.name,
        productId: item.productId,
        productName: item.product.name,
        salePriceAtBackup: item.product.price,
        quantity: item.quantity,
        unitCost: item.unitCost,
        lineTotal: money(item.quantity * item.unitCost),
      })),
    );

    const invoiceSummary = purchases.map((purchase) => ({
      purchaseId: purchase.id,
      date: purchase.date.toISOString(),
      supplier: purchase.supplierName ?? "—",
      supplierInvoiceNo: purchase.supplierInvoiceNo ?? "—",
      itemsCount: purchase.items.length,
      recordedTotal: purchase.total,
      calculatedItemsTotal: money(
        purchase.items.reduce(
          (sum, item) => sum + item.quantity * item.unitCost,
          0,
        ),
      ),
      createdBy: purchase.user.name,
      note: purchase.note ?? "—",
    }));

    console.log("\nمصدر البيانات:");
    console.log(backupPath);
    console.log(`\nعدد فواتير الشراء: ${purchases.length}`);
    console.log(`عدد بنود الشراء: ${exportRows.length}`);
    console.log("\nملخص فواتير الشراء:");
    console.table(invoiceSummary);
    console.log("\nتفاصيل بنود الشراء:");
    console.table(
      exportRows.map((row) => ({
        purchaseId: row.purchaseId,
        product: row.productName,
        quantity: row.quantity,
        unitCost: row.unitCost,
        lineTotal: row.lineTotal,
      })),
    );

    await fs.mkdir(exportDirectory, { recursive: true });
    const csvPath = path.join(exportDirectory, "purchases-from-backup.csv");
    const jsonPath = path.join(exportDirectory, "purchases-from-backup.json");

    for (const outputPath of [csvPath, jsonPath]) {
      const existing = await fs.stat(outputPath).catch(() => null);
      if (existing) {
        throw new Error(
          `ملف التصدير موجود بالفعل ولن أستبدله: ${outputPath}. انقله أو غيّر اسمه ثم أعد التشغيل.`,
        );
      }
    }

    const headers = [
      "purchaseId",
      "purchaseDate",
      "supplierName",
      "supplierInvoiceNo",
      "purchaseTotal",
      "purchaseNote",
      "createdBy",
      "productId",
      "productName",
      "salePriceAtBackup",
      "quantity",
      "unitCost",
      "lineTotal",
    ];
    const csv = [
      headers.map(csvCell).join(","),
      ...exportRows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(",")),
    ].join("\r\n");

    // UTF-8 BOM helps Excel display Arabic correctly on Windows.
    await fs.writeFile(csvPath, `\uFEFF${csv}\r\n`, "utf8");
    await fs.writeFile(
      jsonPath,
      JSON.stringify(
        {
          sourceBackup: backupPath,
          exportedAt: new Date().toISOString(),
          invoiceCount: purchases.length,
          itemCount: exportRows.length,
          invoices: purchases.map((purchase) => ({
            id: purchase.id,
            date: purchase.date,
            supplierName: purchase.supplierName,
            supplierInvoiceNo: purchase.supplierInvoiceNo,
            total: purchase.total,
            note: purchase.note,
            createdBy: purchase.user,
            items: purchase.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.product.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              lineTotal: money(item.quantity * item.unitCost),
            })),
          })),
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log("\nتم استخراج بيانات المشتريات من النسخة الاحتياطية.");
    console.log(`ملف CSV لفتحه في Excel: ${csvPath}`);
    console.log(`ملف JSON للاحتفاظ بنسخة كاملة: ${jsonPath}`);
    console.log("لم يتم إنشاء أي فاتورة شراء جديدة ولم يتم تغيير المخزون أو قاعدة البيانات الحالية.");
  } finally {
    await backupDb.$disconnect();
  }
}

main().catch((error) => {
  console.error("\nفشل استخراج بيانات المشتريات:", error);
  process.exitCode = 1;
});
