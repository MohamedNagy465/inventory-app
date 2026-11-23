"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

type Input = {
  customerId: number | null;
  note: string;
  items: { productId: number; quantity: number }[];
};

type Result =
  | { ok: true; orderId: number }
  | { ok: false; error: string };

// المندوب يسجّل طلب، ومبيتخصمش من المخزون غير لما المدير يوافق
export async function createOrder(input: Input): Promise<Result> {
  const session = await getSession();
  if (!session || (session.role !== "REP" && session.role !== "ADMIN")) {
    return { ok: false, error: "غير مسموح" };
  }

  if (input.customerId !== null && !Number.isInteger(input.customerId)) {
    return { ok: false, error: "بيانات العميل غير صحيحة" };
  }

  const merged = new Map<number, number>();
  for (const it of input.items) {
    if (!Number.isInteger(it.productId) || !Number.isInteger(it.quantity) || it.quantity <= 0) {
      return { ok: false, error: "بيانات المنتجات غير صحيحة" };
    }
    merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
  }
  if (merged.size === 0) return { ok: false, error: "الطلب فاضي" };

  try {
    const count = await prisma.product.count({
      where: { id: { in: [...merged.keys()] } },
    });
    if (count !== merged.size) return { ok: false, error: "منتج غير موجود" };

    const order = await prisma.order.create({
      data: {
        repId: session.userId,
        customerId: input.customerId,
        note: input.note.trim().slice(0, 300) || null,
        items: {
          create: [...merged].map(([productId, quantity]) => ({ productId, quantity })),
        },
      },
    });

    revalidatePath("/rep");
    revalidatePath("/orders");
    return { ok: true, orderId: order.id };
  } catch {
    return { ok: false, error: "حصل خطأ، جرّب تاني" };
  }
}