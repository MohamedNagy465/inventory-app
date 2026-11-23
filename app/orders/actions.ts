
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

type ActionResult =
  | { ok: true; invoiceId?: number }
  | { ok: false; error: string };

// اعتماد طلب المندوب وإنشاء فاتورة وخصم المخزون
export async function approveOrder(
  orderId: number
): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  }

  if (session.role !== "ADMIN") {
    return { ok: false, error: "غير مسموح إلا للمدير باعتماد الطلبات" };
  }

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { ok: false, error: "رقم الطلب غير صحيح" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // حجز الطلب لمنع اعتماده مرتين
      const reserved = await tx.order.updateMany({
        where: {
          id: orderId,
          status: "PENDING",
          invoiceId: null,
        },
        data: {
          status: "APPROVED",
        },
      });

      if (reserved.count !== 1) {
        const existingOrder = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!existingOrder) {
          throw new Error("الطلب غير موجود");
        }

        if (existingOrder.invoiceId) {
          throw new Error("تم إصدار فاتورة لهذا الطلب بالفعل");
        }

        throw new Error("لا يمكن اعتماد هذا الطلب في حالته الحالية");
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new Error("الطلب غير موجود");
      }

      if (order.items.length === 0) {
        throw new Error("الطلب لا يحتوي على منتجات");
      }

      // دمج الكميات في حالة تكرار المنتج
      const quantities = new Map<number, number>();

      for (const item of order.items) {
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new Error("توجد كمية غير صحيحة في الطلب");
        }

        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? 0) + item.quantity
        );
      }

      const productIds = Array.from(quantities.keys());

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("بعض المنتجات الموجودة في الطلب غير موجودة");
      }

      let total = 0;

      const invoiceItems: {
        productId: number;
        quantity: number;
        unitPrice: number;
      }[] = [];

      // التأكد من المخزون وخصمه وتسجيل حركته
      for (const product of products) {
        const quantity = quantities.get(product.id)!;

        const updatedStock = await tx.product.updateMany({
          where: {
            id: product.id,
            stock: { gte: quantity },
          },
          data: {
            stock: { decrement: quantity },
          },
        });

        if (updatedStock.count !== 1) {
          throw new Error(
            `المخزون غير كافٍ للمنتج: ${product.name}. المتاح ${product.stock}`
          );
        }

        const currentProduct = await tx.product.findUnique({
          where: { id: product.id },
          select: { stock: true },
        });

        if (!currentProduct) {
          throw new Error(`تعذر تحديث مخزون ${product.name}`);
        }

        const previousStock = currentProduct.stock + quantity;
        const newStock = currentProduct.stock;

        await tx.stockMovement.create({
          data: {
            type: "OUT",
            quantity,
            previousStock,
            newStock,
            note: `خصم بسبب اعتماد الطلب رقم #${order.id}`,
            productId: product.id,
            userId: session.userId,
          },
        });

        total += product.price * quantity;

        invoiceItems.push({
          productId: product.id,
          quantity,
          unitPrice: product.price,
        });
      }

      total = Math.round(total * 100) / 100;

      // الطلب المعتمد لم يحدد أي مبلغ محصل،
      // لذلك تُنشأ الفاتورة آجل والمدفوع صفر.
      const invoice = await tx.invoice.create({
        data: {
          total,
          customerId: order.customerId,
          userId: session.userId,
          paidAmount: 0,
          paymentType: "CREDIT",
          items: {
            create: invoiceItems,
          },
        },
      });

      // ربط الفاتورة بالطلب
      await tx.order.update({
        where: { id: order.id },
        data: {
          invoiceId: invoice.id,
        },
      });

      return {
        invoiceId: invoice.id,
        total,
      };
    });

    // تحديث الصفحات المرتبطة بالعملية
    revalidatePath("/orders");
    revalidatePath("/rep");
    revalidatePath("/invoices");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    revalidatePath("/collections");
    revalidatePath("/payments");

    return {
      ok: true,
      invoiceId: result.invoiceId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء اعتماد الطلب",
    };
  }
}

// رفض طلب المندوب
export async function rejectOrder(
  orderId: number
): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  }

  if (session.role !== "ADMIN") {
    return { ok: false, error: "غير مسموح إلا للمدير برفض الطلبات" };
  }

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { ok: false, error: "رقم الطلب غير صحيح" };
  }

  try {
    const result = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: "PENDING",
        invoiceId: null,
      },
      data: {
        status: "REJECTED",
      },
    });

    if (result.count !== 1) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return { ok: false, error: "الطلب غير موجود" };
      }

      return {
        ok: false,
        error: "لا يمكن رفض الطلب في حالته الحالية",
      };
    }

    revalidatePath("/orders");
    revalidatePath("/rep");
    revalidatePath("/dashboard");

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء رفض الطلب",
    };
  }
}
