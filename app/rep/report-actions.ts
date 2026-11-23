"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";
import { computeRepDaily } from "../../lib/rep-report";

type Result =
  | { ok: true; updated: boolean }
  | { ok: false; error: string };

const MARKER = "تقرير يومي للمندوب";

// المندوب يرسل تقرير نهاية اليوم للمدير. الأرقام تُحسب في السيرفر ولا تُؤخذ من الواجهة.
// إرسال التقرير مرة ثانية في نفس اليوم يحدّث تقرير اليوم بدل ما يكرره.
export async function submitDailyReport(input: {
  note?: string;
}): Promise<Result> {
  const session = await getSession();
  if (!session || session.role !== "REP") {
    return { ok: false, error: "غير مسموح بإرسال التقرير" };
  }

  const note =
    typeof input?.note === "string" ? input.note.trim().slice(0, 300) : "";

  try {
    const d = await computeRepDaily(session.userId);

    const existing = await prisma.shiftReport.findFirst({
      where: { userId: session.userId, periodStart: d.today },
      select: { id: true },
    });

    const data = {
      periodStart: d.today,
      closedAt: new Date(),
      invoiceCount: d.invoiceCount,
      totalSales: d.totalSales,
      cashSales: d.cashSales,
      halfCreditSales: d.halfCreditSales,
      creditSales: d.creditSales,
      openingCash: 0,
      expectedCash: 0,
      collected: d.collected,
      // "له بره": إجمالي المتبقي على عملاء المندوب
      creditAmount: d.outstanding,
      countedCash: null,
      difference: null,
      note: note ? `${MARKER}: ${note}` : MARKER,
    };

    if (existing) {
      await prisma.shiftReport.update({ where: { id: existing.id }, data });
    } else {
      await prisma.shiftReport.create({
        data: { ...data, userId: session.userId },
      });
    }

    revalidatePath("/rep");
    revalidatePath("/shift-reports");
    revalidatePath("/dashboard");
    return { ok: true, updated: !!existing };
  } catch (error) {
    console.error("submitDailyReport failed:", error);
    return { ok: false, error: "حدث خطأ أثناء إرسال التقرير، حاول مرة أخرى" };
  }
}