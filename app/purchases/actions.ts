
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

type PurchaseInput = {
  supplierName?: string;
  supplierInvoiceNo?: string;
  note?: string;
  items: {
    productId: number;
    quantity: number;
    unitCost: number;
  }[];
};

type PurchaseResult =
  | {
      ok: true;
      purchaseId: number;
      total: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function createPurchase(
  input: PurchaseInput
): Promise<PurchaseResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  }

  if (session.role !== "ADMIN") {
    return { ok: false, error: "غير مسموح إلا للمدير بتسجيل المشتريات" };
  }

  if (!input || !Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "أضف منتجًا واحدًا على الأقل" };
  }

  if (input.items.length > 100) {
    return { ok: false, error: "عدد المنتجات أكبر من المسموح" };
  }

  const supplierName = input.supplierName?.trim().slice(0, 150) || null;
  const supplierInvoiceNo =
    input.supplierInvoiceNo?.trim().slice(0, 100) || null;
  const note = input.note?.trim().slice(0, 500) || null;

  const items = input.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitCost: Math.round(item.unitCost * 100) / 100,
  }));

  const productIds = items.map((item) => item.productId);

  if (new Set(productIds).size !== productIds.length) {
    return {
      ok: false,
      error: "يوجد منتج مكرر. اجمع الكميات في سطر واحد لكل منتج.",
    };
  }

  for (const item of items) {
    if (
      !Number.isInteger(item.productId) ||
      item.productId <= 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitCost) ||
      item.unitCost <= 0
    ) {
      return {
        ok: false,
        error: "تأكد من صحة المنتجات والكميات وأسعار الشراء",
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const productIds = items.map((item) => item.productId);

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      if (products.length !== items.length) {
        throw new Error("بعض المنتجات غير موجودة");
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // حساب الإجمالي بالسنت لتجنب أخطاء الكسور العشرية
      const totalCents = items.reduce(
        (sum, item) =>
          sum + Math.round(item.unitCost * 100) * item.quantity,
        0
      );

      const total = totalCents / 100;

      // إنشاء فاتورة الشراء
      const purchase = await tx.purchase.create({
        data: {
          supplierName,
          supplierInvoiceNo,
          note,
          total,
          userId: session.userId,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
            })),
          },
        },
      });

      // إضافة الكميات للمخزون وتسجيل حركة IN
      for (const item of items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error("المنتج غير موجود");
        }

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
          select: {
            stock: true,
          },
        });

        const newStock = updatedProduct.stock;
        const previousStock = newStock - item.quantity;

        await tx.stockMovement.create({
          data: {
            type: "IN",
            quantity: item.quantity,
            previousStock,
            newStock,
            note: `إضافة من فاتورة شراء رقم #${purchase.id}`,
            productId: item.productId,
            userId: session.userId,
            purchaseId: purchase.id,
          },
        });
      }

      return {
        purchaseId: purchase.id,
        total,
      };
    });

    revalidatePath("/purchases");
    revalidatePath("/products");
    revalidatePath("/dashboard");

    return {
      ok: true,
      ...result,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تسجيل فاتورة الشراء",
    };
  }
}
