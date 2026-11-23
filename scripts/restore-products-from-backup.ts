import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient as BackupPrismaClient } from "../app/generated/prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Restore ONLY the product catalogue from the pre-reset SQLite backup.
 * Existing live data is never modified in preview mode.
 *
 * Preview:
 *   npx tsx scripts/restore-products-from-backup.ts
 *
 * Import:
 *   npx tsx scripts/restore-products-from-backup.ts --confirm-import
 *
 * Restored fields: id, name, barcode, price, lowStockAt
 * Reset fields: stock = 0, costPrice = 0
 * No invoices, purchases, customers, payments, or stock movements are restored.
 */

const confirmImport = process.argv.includes("--confirm-import");
const backupFileName = "before-reset-2026-11-23T14-56-00-837Z.db";
const backupPath = path.resolve(process.cwd(), "backups", backupFileName);

function toSqliteFileUrl(filePath: string): string {
  // Prisma accepts a forward-slash SQLite file URL on Windows as well.
  return `file:${path.resolve(filePath).replace(/\\/g, "/")}`;
}

async function main() {
  const backupStat = await fs.stat(backupPath).catch(() => null);
  if (!backupStat?.isFile() || backupStat.size === 0) {
    throw new Error(
      `لم أجد النسخة الاحتياطية أو أنها فارغة: ${backupPath}`,
    );
  }

  const backupDb = new BackupPrismaClient({
    datasources: { db: { url: toSqliteFileUrl(backupPath) } },
  });

  try {
    const [oldProducts, currentProductCount] = await Promise.all([
      backupDb.product.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          barcode: true,
          price: true,
          lowStockAt: true,
        },
      }),
      prisma.product.count(),
    ]);

    if (oldProducts.length === 0) {
      throw new Error("النسخة الاحتياطية لا تحتوي على منتجات.");
    }

    console.log("\nمصدر البيانات:");
    console.log(backupPath);
    console.log(`\nعدد المنتجات في النسخة الاحتياطية: ${oldProducts.length}`);
    console.log(`عدد المنتجات حاليًا في النظام: ${currentProductCount}`);
    console.log("\nقائمة المنتجات التي سيتم استعادتها:");
    console.table(
      oldProducts.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode ?? "—",
        salePrice: product.price,
        stockAfterImport: 0,
        costPriceAfterImport: 0,
      })),
    );

    if (!confirmImport) {
      console.log(
        "\nوضع معاينة فقط: لم تتم إضافة أي منتجات. للموافقة شغّل الأمر مع --confirm-import.",
      );
      return;
    }

    if (currentProductCount !== 0) {
      throw new Error(
        "تم إيقاف الاستيراد لأن جدول المنتجات الحالي ليس فارغًا. لن أدمج البيانات تلقائيًا حتى لا تتكرر الأصناف.",
      );
    }

    await prisma.product.createMany({
      data: oldProducts.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        lowStockAt: product.lowStockAt,
        stock: 0,
        costPrice: 0,
      })),
    });

    const restoredCount = await prisma.product.count();
    if (restoredCount !== oldProducts.length) {
      throw new Error(
        `عدد المنتجات بعد الاستيراد غير مطابق. المتوقع ${oldProducts.length}، الموجود ${restoredCount}.`,
      );
    }

    console.log(`\nتمت استعادة ${restoredCount} منتج بنجاح.`);
    console.log("تم ضبط مخزون كل المنتجات على صفر.");
    console.log("تم ضبط تكلفة كل المنتجات على صفر لحين تسجيل فواتير الشراء الجديدة.");
    console.log("لم تتم استعادة أي فواتير بيع أو شراء أو عملاء أو مدفوعات.");
  } finally {
    await backupDb.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("\nفشلت استعادة المنتجات:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
