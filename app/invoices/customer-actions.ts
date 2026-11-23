"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

const ALLOWED = ["ADMIN", "EMPLOYEE", "SELLER"];

// أخطاء متوقعة: رسائلها آمنة للعرض
class CustomerError extends Error {}

const toCents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => c / 100;

type BalanceResult = { ok: true; balance: number } | { ok: false; error: string };

// إجمالي المتبقي على كل فواتير العميل
export async function getCustomerBalance(
  customerId: number
): Promise<BalanceResult> {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role)) {
    return { ok: false, error: "غير مسموح" };
  }
  if (typeof customerId !== "number" || !Number.isInteger(customerId) || customerId <= 0) {
    return { ok: false, error: "بيانات العميل غير صحيحة" };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { customerId },
      select: { total: true, paidAmount: true },
    });

    const cents = invoices.reduce(
      (sum, inv) => sum + Math.max(0, toCents(inv.total) - toCents(inv.paidAmount)),
      0
    );
    return { ok: true, balance: fromCents(cents) };
  } catch (error) {
    console.error("getCustomerBalance failed:", error);
    return { ok: false, error: "تعذر جلب مستحقات العميل" };
  }
}

type CollectInput = { customerId: number; amount: number; note?: string };
type CollectResult =
  | { ok: true; collected: number; balance: number }
  | { ok: false; error: string };

// تحصيل مبلغ من العميل وتوزيعه على أقدم الفواتير غير المسددة أولًا
export async function collectFromCustomer(
  input: CollectInput
): Promise<CollectResult> {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role)) {
    return { ok: false, error: "غير مسموح بتسجيل تحصيل" };
  }

  if (
    !input ||
    typeof input.customerId !== "number" ||
    typeof input.amount !== "number" ||
    !Number.isInteger(input.customerId) ||
    input.customerId <= 0 ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    return { ok: false, error: "راجع بيانات العميل والمبلغ" };
  }

  const note =
    typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoices = await tx.invoice.findMany({
        where: { customerId: input.customerId },
        orderBy: { date: "asc" },
        select: { id: true, total: true, paidAmount: true },
      });

      const open = invoices
        .map((inv) => ({
          ...inv,
          remaining: toCents(inv.total) - toCents(inv.paidAmount),
        }))
        .filter((inv) => inv.remaining > 0);

      const owed = open.reduce((s, inv) => s + inv.remaining, 0);
      const amountCents = toCents(input.amount);

      if (amountCents <= 0) throw new CustomerError("المبلغ غير صحيح");
      if (owed <= 0) throw new CustomerError("لا توجد مستحقات على هذا العميل");
      if (amountCents > owed) {
        throw new CustomerError(
          `المبلغ أكبر من المستحق. المستحق ${fromCents(owed).toFixed(2)}`
        );
      }

      let left = amountCents;
      for (const inv of open) {
        if (left <= 0) break;
        const part = Math.min(left, inv.remaining);

        // قفل متفائل: ينجح فقط لو لم يتغير paidAmount منذ القراءة
        const updated = await tx.invoice.updateMany({
          where: { id: inv.id, paidAmount: inv.paidAmount },
          data: { paidAmount: fromCents(toCents(inv.paidAmount) + part) },
        });
        if (updated.count === 0) {
          throw new CustomerError(
            "تم تعديل إحدى الفواتير قبل لحظات. حاول مرة أخرى"
          );
        }

        await tx.payment.create({
          data: {
            amount: fromCents(part),
            note,
            customerId: input.customerId,
            invoiceId: inv.id,
            repId: session.userId,
          },
        });

        left -= part;
      }

      return {
        collected: fromCents(amountCents),
        balance: fromCents(owed - amountCents),
      };
    });

    revalidatePath("/collections");
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath("/rep");
    revalidatePath("/dashboard");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof CustomerError) {
      return { ok: false, error: error.message };
    }
    console.error("collectFromCustomer failed:", error);
    return { ok: false, error: "حدث خطأ أثناء تسجيل التحصيل" };
  }
}