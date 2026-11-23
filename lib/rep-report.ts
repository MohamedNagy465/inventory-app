import { prisma } from "./prisma";

const OFFSET = 3 * 60 * 60 * 1000; // توقيت السعودية UTC+3

// بداية اليوم بتوقيت السعودية
export function dayStart(date: Date) {
  const s = new Date(date.getTime() + OFFSET);
  s.setUTCHours(0, 0, 0, 0);
  return new Date(s.getTime() - OFFSET);
}

const cents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => c / 100;

// أرقام تقرير المندوب اليومي. نفس الحساب يُستخدم في الصفحة وفي إرسال التقرير.
export async function computeRepDaily(userId: number) {
  const today = dayStart(new Date());
  const mine = { OR: [{ userId }, { order: { repId: userId } }] };

  const [todayInvoices, allInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...mine, date: { gte: today } },
      select: { total: true, paidAmount: true, paymentType: true },
    }),
    prisma.invoice.findMany({
      where: mine,
      select: { total: true, paidAmount: true },
    }),
  ]);

  let totalSales = 0;
  let collected = 0;
  let creditToday = 0;
  let cashSales = 0;
  let halfCreditSales = 0;
  let creditSales = 0;

  for (const inv of todayInvoices) {
    const total = cents(inv.total);
    const paid = Math.min(cents(inv.paidAmount), total);
    totalSales += total;
    collected += paid;
    creditToday += total - paid;

    if (inv.paymentType === "CASH") cashSales += total;
    else if (inv.paymentType === "HALF_CREDIT") halfCreditSales += total;
    else creditSales += total;
  }

  // له بره: المتبقي على كل فواتير المندوب (مش اليوم بس)
  let outstanding = 0;
  for (const inv of allInvoices) {
    outstanding += Math.max(0, cents(inv.total) - cents(inv.paidAmount));
  }

  return {
    today,
    invoiceCount: todayInvoices.length,
    totalSales: fromCents(totalSales),
    collected: fromCents(collected),
    creditToday: fromCents(creditToday),
    cashSales: fromCents(cashSales),
    halfCreditSales: fromCents(halfCreditSales),
    creditSales: fromCents(creditSales),
    outstanding: fromCents(outstanding),
  };
}