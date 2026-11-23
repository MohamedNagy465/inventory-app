"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

// من يقدر يضيف عملاء: المدير والموظف والمندوب
const ALLOWED = ["ADMIN", "EMPLOYEE", "REP"];

type Result =
  | {
      ok: true;
      customer: { id: number; name: string; phone: string | null };
      existed: boolean;
    }
  | { ok: false; error: string };

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// دالة إضافة العميل المشتركة بين صفحة العملاء ونافذة المندوب
export async function createCustomer(input: {
  name: string;
  phone?: string;
  /** لو فيه عميل بنفس الاسم يرجّعه بدل ما يكرره (يستخدمها المندوب) */
  reuseExistingByName?: boolean;
}): Promise<Result> {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role)) {
    return { ok: false, error: "غير مسموح بإضافة عملاء" };
  }

  const name =
    typeof input?.name === "string"
      ? input.name.trim().replace(/\s+/g, " ")
      : "";
  if (name.length < 2) {
    return { ok: false, error: "اكتب اسم العميل (حرفان على الأقل)" };
  }
  if (name.length > 100) {
    return { ok: false, error: "اسم العميل طويل جدًا" };
  }

  // الأرقام العربية تتحوّل للاتينية
  const phone =
    typeof input?.phone === "string"
      ? input.phone
          .trim()
          .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
      : "";
  if (phone && !/^[0-9+\-\s()]{5,20}$/.test(phone)) {
    return { ok: false, error: "رقم الموبايل غير صحيح" };
  }

  try {
    if (input.reuseExistingByName) {
      const existing = await prisma.customer.findFirst({
        where: { name },
        select: { id: true, name: true, phone: true },
      });
      if (existing) return { ok: true, customer: existing, existed: true };
    }

    const customer = await prisma.customer.create({
      data: { name, phone: phone || null },
      select: { id: true, name: true, phone: true },
    });

    revalidatePath("/customers");
    revalidatePath("/rep");
    revalidatePath("/invoices");
    return { ok: true, customer, existed: false };
  } catch (error) {
    console.error("createCustomer failed:", error);
    return { ok: false, error: "تعذر إضافة العميل، حاول مرة أخرى" };
  }
}