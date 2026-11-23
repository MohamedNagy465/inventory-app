"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";
import { isExpenseCategory } from "../../lib/expenses";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseSaudiDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00+03:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  const check = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export async function createExpense(input: {
  amount: number;
  category: string;
  description: string;
  date: string;
}): Promise<ActionResult> {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return {
      ok: false,
      error: "غير مسموح بتسجيل المصروفات",
    };
  }

  if (
    !input ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    input.amount > 1_000_000_000
  ) {
    return {
      ok: false,
      error: "اكتب مبلغًا صحيحًا أكبر من صفر",
    };
  }

  if (!isExpenseCategory(input.category)) {
    return {
      ok: false,
      error: "اختار تصنيفًا صحيحًا للمصروف",
    };
  }

  const date = parseSaudiDate(input.date);

  if (!date) {
    return {
      ok: false,
      error: "تاريخ المصروف غير صحيح",
    };
  }

  const description =
    typeof input.description === "string"
      ? input.description.trim().slice(0, 250)
      : "";

  try {
    await prisma.expense.create({
      data: {
        amount:
          Math.round(
            (input.amount + Number.EPSILON) * 100
          ) / 100,

        category: input.category,
        description: description || null,
        date,
        userId: session.userId,
      },
    });

    revalidatePath("/expenses");
    revalidatePath("/dashboard");

    return { ok: true };
  } catch (error) {
    console.error("createExpense failed:", error);

    return {
      ok: false,
      error: "حصل خطأ أثناء حفظ المصروف",
    };
  }
}

export async function deleteExpense(
  id: number
): Promise<ActionResult> {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return {
      ok: false,
      error: "غير مسموح بحذف المصروفات",
    };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      error: "رقم المصروف غير صحيح",
    };
  }

  try {
    await prisma.expense.delete({
      where: { id },
    });

    revalidatePath("/expenses");
    revalidatePath("/dashboard");

    return { ok: true };
  } catch (error) {
    console.error("deleteExpense failed:", error);

    return {
      ok: false,
      error: "تعذر حذف المصروف",
    };
  }
}