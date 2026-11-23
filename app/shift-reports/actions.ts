"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";
import { getOpenShift, getShiftSummary, round2 } from "../../lib/shift";

type ActiveShift = { id: number; openingCash: number; openedAt: string };
type StartResult = { ok: true; shift: ActiveShift; alreadyOpen?: boolean } | { ok: false; error: string };
type CloseResult =
  | { ok: true; reportId: number; invoiceCount: number; totalSales: number; collected: number; openingCash: number; expectedCash: number; countedCash: number; difference: number }
  | { ok: false; error: string };
type CloseSummaryResult =
  | {
      ok: true;
      summary: {
        invoiceCount: number;
        totalSales: number;
        cashSales: number;
        creditAmount: number;
        collected: number;
        openingCash: number;
        expectedCash: number;
      };
    }
  | { ok: false; error: string };

const canManageShift = (role: string) => role === "SELLER" || role === "REP";

export async function startShift(input: { openingCash: number }): Promise<StartResult> {
  const session = await getSession();
  if (!session || !canManageShift(session.role)) return { ok: false, error: "غير مسموح ببدء الوردية" };

  if (!input || !Number.isFinite(input.openingCash) || input.openingCash < 0) {
    return { ok: false, error: "رصيد بداية الدرج غير صحيح" };
  }

  try {
    const existing = await getOpenShift(session.userId);
    if (existing) {
      return {
        ok: true,
        alreadyOpen: true,
        shift: { id: existing.id, openingCash: existing.openingCash, openedAt: existing.openedAt.toISOString() },
      };
    }

    const created = await prisma.shiftSession.create({
      data: { userId: session.userId, openingCash: round2(input.openingCash) },
      select: { id: true, openingCash: true, openedAt: true },
    });

    revalidatePath("/rep");
    revalidatePath("/shift-reports");
    return {
      ok: true,
      shift: { id: created.id, openingCash: created.openingCash, openedAt: created.openedAt.toISOString() },
    };
  } catch (error) {
    console.error("startShift failed:", error);
    return { ok: false, error: "حصل خطأ أثناء بدء الوردية، جرّب تاني" };
  }
}

// ملخص الوردية المفتوحة (للعرض فقط قبل الإغلاق). الحفظ الفعلي بيتم في closeShift.
export async function getCloseSummary(): Promise<CloseSummaryResult> {
  const session = await getSession();
  if (!session || !canManageShift(session.role)) return { ok: false, error: "غير مسموح" };

  try {
    const openShift = await getOpenShift(session.userId);
    if (!openShift) return { ok: false, error: "لا توجد وردية مفتوحة" };

    const s = await getShiftSummary(session.userId);
    return {
      ok: true,
      summary: {
        invoiceCount: s.invoiceCount,
        totalSales: s.totalSales,
        cashSales: s.cashSales,
        creditAmount: s.creditAmount,
        collected: s.collected,
        openingCash: s.openingCash,
        expectedCash: s.expectedCash,
      },
    };
  } catch (error) {
    console.error("getCloseSummary failed:", error);
    return { ok: false, error: "تعذر حساب ملخص الوردية" };
  }
}

export async function closeShift(input: { countedCash: number | null; note: string }): Promise<CloseResult> {
  const session = await getSession();
  if (!session || !canManageShift(session.role)) return { ok: false, error: "غير مسموح بإغلاق الوردية" };

  if (!input || input.countedCash === null || !Number.isFinite(input.countedCash) || input.countedCash < 0) {
    return { ok: false, error: "اكتب النقدية الفعلية الموجودة في الدرج" };
  }

  const counted = round2(input.countedCash);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null;

  try {
    const openShift = await getOpenShift(session.userId);
    if (!openShift) return { ok: false, error: "ابدأ الوردية وسجّل رصيد الدرج أولًا" };

    const summary = await getShiftSummary(session.userId);
    const expectedCash = round2(openShift.openingCash + summary.collected);
    const difference = round2(counted - expectedCash);

    const report = await prisma.$transaction(async (tx) => {
      // يمنع إنشاء تقريرين لو تم الضغط على إغلاق الوردية من جهازين في نفس الوقت.
      const closed = await tx.shiftSession.updateMany({
        where: { id: openShift.id, closedAt: null },
        data: { closedAt: summary.periodEnd },
      });
      if (closed.count !== 1) throw new Error("SHIFT_ALREADY_CLOSED");

      return tx.shiftReport.create({
        data: {
          userId: session.userId,
          periodStart: openShift.openedAt,
          closedAt: summary.periodEnd,
          invoiceCount: summary.invoiceCount,
          totalSales: summary.totalSales,
          cashSales: summary.cashSales,
          halfCreditSales: summary.halfCreditSales,
          creditSales: summary.creditSales,
          openingCash: openShift.openingCash,
          expectedCash,
          collected: summary.collected,
          creditAmount: summary.creditAmount,
          countedCash: counted,
          difference,
          note,
        },
      });
    });

    revalidatePath("/shift-reports");
    revalidatePath("/invoices");
    revalidatePath("/rep");

    return {
      ok: true,
      reportId: report.id,
      invoiceCount: summary.invoiceCount,
      totalSales: summary.totalSales,
      collected: summary.collected,
      openingCash: openShift.openingCash,
      expectedCash,
      countedCash: counted,
      difference,
    };
  } catch (error) {
    console.error("closeShift failed:", error);
    return { ok: false, error: "حصل خطأ أثناء إغلاق الوردية، جرّب تاني" };
  }
}