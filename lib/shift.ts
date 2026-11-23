import { prisma } from "./prisma";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const fmtDate = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });

type PayInfo = { total: number; paidAmount: number; paymentType: string };

export function paidOf(inv: PayInfo) {
  if (inv.paymentType === "CASH") return inv.total;
  return Math.min(Math.max(inv.paidAmount, 0), inv.total);
}

export type InvoiceRow = {
  id: number;
  date: Date;
  total: number;
  paid: number;
  paymentType: string;
  customerName: string | null;
};

export function summarize(invoices: PayInfo[]) {
  let totalSales = 0;
  let cashSales = 0;
  let halfCreditSales = 0;
  let creditSales = 0;
  let creditAmount = 0;

  for (const inv of invoices) {
    totalSales += inv.total;
    creditAmount += Math.max(0, inv.total - paidOf(inv));
    if (inv.paymentType === "CASH") cashSales += inv.total;
    else if (inv.paymentType === "HALF_CREDIT") halfCreditSales += inv.total;
    else creditSales += inv.total;
  }

  return {
    invoiceCount: invoices.length,
    totalSales: round2(totalSales),
    cashSales: round2(cashSales),
    halfCreditSales: round2(halfCreditSales),
    creditSales: round2(creditSales),
    creditAmount: round2(creditAmount),
  };
}

export async function getOpenShift(userId: number) {
  return prisma.shiftSession.findFirst({
    where: { userId, closedAt: null },
    orderBy: { openedAt: "desc" },
    select: { id: true, openingCash: true, openedAt: true },
  });
}

// حساب بيانات الوردية المفتوحة. التحصيلات تُحسب حسب وقت استلامها الفعلي.
export async function getShiftSummary(userId: number) {
  const [openShift, last, user] = await Promise.all([
    getOpenShift(userId),
    prisma.shiftReport.findFirst({
      where: { userId },
      orderBy: { closedAt: "desc" },
      select: { closedAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  const periodStart = openShift?.openedAt ?? last?.closedAt ?? user?.createdAt ?? new Date(0);
  const periodEnd = new Date();

  const [invoices, paymentTotals] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, date: { gt: periodStart, lte: periodEnd } },
      orderBy: { id: "asc" },
      select: {
        id: true, date: true, total: true, paidAmount: true, paymentType: true, customerId: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { repId: userId, createdAt: { gt: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
  ]);

  const rows: InvoiceRow[] = invoices.map((invoice) => ({
    id: invoice.id,
    date: invoice.date,
    total: invoice.total,
    paid: paidOf(invoice),
    paymentType: invoice.paymentType,
    customerName: invoice.customer?.name ?? null,
  }));

  const salesSummary = summarize(invoices);
  const noCustomerCollected = invoices
    .filter((invoice) => invoice.customerId === null)
    .reduce((sum, invoice) => sum + paidOf(invoice), 0);
  const collected = round2((paymentTotals._sum.amount ?? 0) + noCustomerCollected);
  const openingCash = round2(openShift?.openingCash ?? 0);

  return {
    periodStart,
    periodEnd,
    rows,
    ...salesSummary,
    collected,
    openingCash,
    expectedCash: round2(openingCash + collected),
    shiftSessionId: openShift?.id ?? null,
  };
}
