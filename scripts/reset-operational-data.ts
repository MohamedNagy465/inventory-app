import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";

/**
 * Clears operational data while preserving User records.
 *
 * Safe usage:
 *   npx tsx scripts/reset-operational-data.ts
 *   npx tsx scripts/reset-operational-data.ts --confirm-reset
 *
 * The first command is a dry run. The second creates a SQLite backup first,
 * then deletes operational records inside a transaction.
 */

const confirmReset = process.argv.includes("--confirm-reset");

async function main() {
  const [
    users,
    products,
    customers,
    invoices,
    invoiceItems,
    orders,
    orderItems,
    stockMovements,
    payments,
    purchases,
    purchaseItems,
    shiftReports,
    shiftSessions,
    expenses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.customer.count(),
    prisma.invoice.count(),
    prisma.invoiceItem.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.stockMovement.count(),
    prisma.payment.count(),
    prisma.purchase.count(),
    prisma.purchaseItem.count(),
    prisma.shiftReport.count(),
    prisma.shiftSession.count(),
    prisma.expense.count(),
  ]);

  const summary = {
    usersPreserved: users,
    toDelete: {
      products,
      customers,
      invoices,
      invoiceItems,
      orders,
      orderItems,
      stockMovements,
      payments,
      purchases,
      purchaseItems,
      shiftReports,
      shiftSessions,
      expenses,
    },
  };

  console.log("\nملخص البيانات الحالية:");
  console.log(JSON.stringify(summary, null, 2));

  if (!confirmReset) {
    console.log(
      "\nوضع معاينة فقط: لم يتم حذف أي بيانات. للمسح الفعلي شغّل الأمر مع --confirm-reset.",
    );
    return;
  }

  // Create a consistent SQLite backup before changing anything.
  const backupDirectory = path.resolve(process.cwd(), "backups");
  await fs.mkdir(backupDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `before-reset-${timestamp}.db`);
  const escapedBackupPath = backupPath.replace(/'/g, "''");

  // VACUUM INTO must run outside a transaction. It creates a standalone DB copy.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedBackupPath}'`);

  const backupStat = await fs.stat(backupPath);
  if (!backupStat.isFile() || backupStat.size === 0) {
    throw new Error("تعذر التحقق من النسخة الاحتياطية؛ تم إيقاف عملية الحذف.");
  }

  console.log(`\nتم إنشاء النسخة الاحتياطية: ${backupPath}`);

  await prisma.$transaction(
    async (tx) => {
      // Remove dependent records first to respect SQLite foreign-key constraints.
      await tx.payment.deleteMany();
      await tx.shiftReport.deleteMany();
      await tx.shiftSession.deleteMany();
      await tx.expense.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.invoiceItem.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.purchaseItem.deleteMany();

      // Parent/business records.
      await tx.order.deleteMany();
      await tx.invoice.deleteMany();
      await tx.purchase.deleteMany();
      await tx.customer.deleteMany();
      await tx.product.deleteMany();

      // User records are intentionally preserved.
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const [remainingUsers, remainingProducts, remainingCustomers, remainingInvoices, remainingPurchases] =
    await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.customer.count(),
      prisma.invoice.count(),
      prisma.purchase.count(),
    ]);

  if (
    remainingUsers !== users ||
    remainingProducts !== 0 ||
    remainingCustomers !== 0 ||
    remainingInvoices !== 0 ||
    remainingPurchases !== 0
  ) {
    throw new Error("تم تنفيذ الحذف، لكن فحص البيانات المتبقية لم يطابق المتوقع.");
  }

  console.log("\nتم تنظيف بيانات التشغيل بنجاح.");
  console.log(`عدد حسابات المستخدمين التي تم الاحتفاظ بها: ${remainingUsers}`);
  console.log("المنتجات والعملاء وفواتير البيع والشراء والورديات والحركات أصبحت فارغة.");
  console.log(`النسخة الاحتياطية محفوظة هنا: ${backupPath}`);
}

main()
  .catch((error) => {
    console.error("\nفشلت عملية التنظيف:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
