import { prisma } from "../lib/prisma";

async function main() {
  const confirm = process.argv.includes("--confirm");

  const [invoices, items, payments, reports, shifts] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoiceItem.count(),
    prisma.payment.count(),
    prisma.shiftReport.count(),
    prisma.shiftSession.count(),
  ]);

  console.log({ invoices, items, payments, reports, shifts });

  if (!confirm) {
    console.log("Dry run only, nothing deleted. Add --confirm to delete.");
    return;
  }

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { invoiceId: { not: null } },
      data: { invoiceId: null },
    }),
    prisma.invoiceItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.shiftReport.deleteMany(),
    prisma.shiftSession.deleteMany(),
    prisma.invoice.deleteMany(),
  ]);

  console.log("Done: invoices, payments and shift reports deleted.");
}

main().finally(() => prisma.$disconnect());