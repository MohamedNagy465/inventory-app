"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

type PaymentInput = {
  invoiceId: number;
  amount: number;
  note?: string;
};

type PaymentResult =
  | { ok: true; paymentId: number; paidAmount: number; remaining: number }
  | { ok: false; error: string };

// أخطاء متوقعة فقط: رسائلها آمنة للعرض للمستخدم
class PaymentError extends Error {}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

export async function createPayment(
  input: PaymentInput
): Promise<PaymentResult> {
  const session = await getSession();

  if (!session || !["REP", "ADMIN"].includes(session.role)) {
    return { ok: false, error: "غير مسموح بتسجيل تحصيل" };
  }

  // التحقق وقت التشغيل: أنواع TypeScript لا تحمي من طلب مُعدَّل
  if (
    !input ||
    typeof input.invoiceId !== "number" ||
    typeof input.amount !== "number" ||
    !Number.isInteger(input.invoiceId) ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    return { ok: false, error: "راجع رقم الفاتورة والمبلغ" };
  }

  const note =
    typeof input.note === "string"
      ? input.note.trim().slice(0, 300) || null
      : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { order: true },
      });

      if (!invoice) {
        throw new PaymentError("الفاتورة غير موجودة");
      }

      // المندوب يسجل تحصيل فواتيره أو الطلبات التابعة له فقط
      if (
        session.role === "REP" &&
        invoice.userId !== session.userId &&
        invoice.order?.repId !== session.userId
      ) {
        throw new PaymentError("لا يمكنك تسجيل تحصيل على فاتورة مندوب آخر");
      }

      if (!invoice.customerId) {
        throw new PaymentError("الفاتورة غير مرتبطة بعميل");
      }

      // الحساب بالهللات لتجنب أخطاء الفاصلة العشرية
      const totalCents = toCents(invoice.total);
      const paidCents = toCents(invoice.paidAmount);
      const amountCents = toCents(input.amount);
      const remainingCents = totalCents - paidCents;

      if (amountCents <= 0) {
        throw new PaymentError("المبلغ غير صحيح");
      }

      if (remainingCents <= 0) {
        throw new PaymentError("الفاتورة مدفوعة بالكامل");
      }

      if (amountCents > remainingCents) {
        throw new PaymentError(
          `المبلغ أكبر من المتبقي. المتبقي ${fromCents(remainingCents).toFixed(2)}`
        );
      }

      const newPaidCents = paidCents + amountCents;

      // قفل متفائل: التحديث ينجح فقط إذا لم يتغير paidAmount منذ القراءة.
      // لو سجّل مندوب آخر تحصيلًا في نفس اللحظة، count = 0 ونرجع الخطأ.
      const updated = await tx.invoice.updateMany({
        where: { id: invoice.id, paidAmount: invoice.paidAmount },
        data: { paidAmount: fromCents(newPaidCents) },
      });

      if (updated.count === 0) {
        throw new PaymentError(
          "تم تعديل الفاتورة قبل لحظات. حدّث الصفحة وحاول مرة أخرى"
        );
      }

      const payment = await tx.payment.create({
        data: {
          amount: fromCents(amountCents),
          note,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          repId: session.userId,
        },
      });

      return {
        paymentId: payment.id,
        paidAmount: fromCents(newPaidCents),
        remaining: fromCents(totalCents - newPaidCents),
      };
    });

    revalidatePath("/rep");
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath("/collections");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, error: error.message };
    }
    // أي خطأ آخر (Prisma وغيره) يُسجَّل في السيرفر فقط
    console.error("createPayment failed:", error);
    return { ok: false, error: "حدث خطأ أثناء تسجيل التحصيل" };
  }
} 