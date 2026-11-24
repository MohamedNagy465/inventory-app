
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

type PaymentType = "CASH" | "CREDIT" | "HALF_CREDIT";
type PaymentMethod = "CASH" | "WALLET" | "TRANSFER";

type Input = {
  customerId: number | null;
  discount?: number;
  paymentType?: PaymentType;
  paymentMethod?: PaymentMethod | null;
  paidAmount?: number;
  placeName?: string | null;
  items: {
    productId: number;
    quantity: number;
  }[];
};

type Result =
  | {
      ok: true;
      invoiceId: number;
      total: number;
      discount: number;
      paymentMethod: PaymentMethod | null;
      paidAmount: number;
      remaining: number;
    }
  | { ok: false; error: string };

class InvoiceError extends Error {}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

const PAYMENT_TYPES: readonly PaymentType[] = [
  "CASH",
  "CREDIT",
  "HALF_CREDIT",
];

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "CASH",
  "WALLET",
  "TRANSFER",
];

export async function createInvoice(input: Input): Promise<Result> {
  const session = await getSession();

  if (!session) {
    return { ok: false, error: "لازم تسجّل دخول الأول" };
  }

  if (!input || typeof input !== "object") {
    return { ok: false, error: "بيانات الفاتورة غير صحيحة" };
  }

  if (
    input.customerId !== null &&
    (!Number.isSafeInteger(input.customerId) || input.customerId <= 0)
  ) {
    return { ok: false, error: "بيانات العميل غير صحيحة" };
  }

  if (
    input.placeName != null &&
    typeof input.placeName !== "string"
  ) {
    return { ok: false, error: "اسم المكان غير صحيح" };
  }

  const placeName = (input.placeName ?? "").trim();

  if (placeName.length > 120) {
    return {
      ok: false,
      error: "اسم المكان لا يمكن أن يتجاوز 120 حرفًا",
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "الفاتورة فاضية" };
  }

  const paymentType = input.paymentType ?? "CASH";

  if (!PAYMENT_TYPES.includes(paymentType)) {
    return { ok: false, error: "طريقة الدفع غير صحيحة" };
  }

  // التوافق مع الاستدعاءات القديمة، وقبول اختلاف حالة الأحرف.
  const requestedPaymentMethod = String(
    input.paymentMethod ?? "CASH"
  ).trim().toUpperCase();

  if (
    !PAYMENT_METHODS.includes(
      requestedPaymentMethod as PaymentMethod
    )
  ) {
    return { ok: false, error: "وسيلة التحصيل غير صحيحة" };
  }

  const paymentMethod = requestedPaymentMethod as PaymentMethod;

  const discountInput = input.discount ?? 0;
  const paidInput = input.paidAmount ?? 0;

  if (!Number.isFinite(discountInput) || discountInput < 0) {
    return { ok: false, error: "قيمة الخصم غير صحيحة" };
  }

  if (!Number.isFinite(paidInput) || paidInput < 0) {
    return { ok: false, error: "المبلغ المدفوع غير صحيح" };
  }

  if (paymentType !== "CASH" && input.customerId === null) {
    return {
      ok: false,
      error: "اختر عميلًا للبيع الآجل أو الجزئي",
    };
  }

  // دمج المنتجات المكررة قبل تنفيذ العملية.
  const merged = new Map<number, number>();

  for (const item of input.items) {
    if (
      !item ||
      !Number.isSafeInteger(item.productId) ||
      item.productId <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return { ok: false, error: "بيانات المنتجات غير صحيحة" };
    }

    const quantity =
      (merged.get(item.productId) ?? 0) + item.quantity;

    if (!Number.isSafeInteger(quantity)) {
      return { ok: false, error: "إجمالي الكمية غير صحيح" };
    }

    merged.set(item.productId, quantity);
  }

  const saleDate = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // أي عملية نقدية بدون عميل محدد تُربط بعميل افتراضي موحّد.
      let invoiceCustomerId = input.customerId;

      if (paymentType === "CASH" && invoiceCustomerId === null) {
        const existingCashCustomer = await tx.customer.findFirst({
          where: { name: "عميل نقدي" },
          orderBy: { id: "asc" },
          select: { id: true },
        });

        const cashCustomer = existingCashCustomer ??
          await tx.customer.create({
            data: { name: "عميل نقدي" },
            select: { id: true },
          });

        invoiceCustomerId = cashCustomer.id;
      }

      if (invoiceCustomerId !== null) {
        const customer = await tx.customer.findUnique({
          where: { id: invoiceCustomerId },
          select: { id: true },
        });

        if (!customer) {
          throw new InvoiceError("العميل غير موجود");
        }
      }

      const productIds = [...merged.keys()];

      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== merged.size) {
        throw new InvoiceError("يوجد منتج غير موجود");
      }

      /*
       * حساب متوسط تكلفة الشراء المرجّح لكل منتج.
       * نعتمد على فواتير الشراء المسجلة حتى تاريخ البيع.
       */
      const purchaseItems = await tx.purchaseItem.findMany({
        where: {
          productId: { in: productIds },
          purchase: {
            is: {
              date: { lte: saleDate },
            },
          },
        },
        select: {
          productId: true,
          quantity: true,
          unitCost: true,
        },
      });

      const costTotals = new Map<
        number,
        { quantity: number; totalCostCents: number }
      >();

      for (const purchaseItem of purchaseItems) {
        if (
          !Number.isFinite(purchaseItem.unitCost) ||
          purchaseItem.unitCost < 0 ||
          !Number.isSafeInteger(purchaseItem.quantity) ||
          purchaseItem.quantity <= 0
        ) {
          throw new InvoiceError(
            "توجد تكلفة شراء غير صحيحة في سجل المشتريات"
          );
        }

        const current = costTotals.get(purchaseItem.productId) ?? {
          quantity: 0,
          totalCostCents: 0,
        };

        current.quantity += purchaseItem.quantity;
        current.totalCostCents +=
          toCents(purchaseItem.unitCost) * purchaseItem.quantity;

        if (
          !Number.isSafeInteger(current.quantity) ||
          !Number.isSafeInteger(current.totalCostCents)
        ) {
          throw new InvoiceError(
            "إجمالي تكلفة الشراء أكبر من الحد المسموح"
          );
        }

        costTotals.set(purchaseItem.productId, current);
      }

      const productMap = new Map(
        products.map((product) => [product.id, product])
      );

      const invoiceItems: {
        productId: number;
        quantity: number;
        unitPrice: number;
        unitCost: number;
      }[] = [];

      let subtotalCents = 0;

      for (const [productId, quantity] of merged) {
        const product = productMap.get(productId);

        if (!product) {
          throw new InvoiceError("المنتج غير موجود");
        }

        if (!Number.isFinite(product.price) || product.price < 0) {
          throw new InvoiceError(
            `سعر المنتج ${product.name} غير صحيح`
          );
        }

        if (product.stock < quantity) {
          throw new InvoiceError(
            `الكمية غير كافية لـ ${product.name} (المتاح ${product.stock})`
          );
        }

        subtotalCents += toCents(product.price) * quantity;

        if (!Number.isSafeInteger(subtotalCents)) {
          throw new InvoiceError(
            "إجمالي الفاتورة أكبر من الحد المسموح"
          );
        }

        const cost = costTotals.get(productId);

        // لو مفيش سجل شراء للمنتج، نخزن صفر بدل اختراع تكلفة.
        const unitCostCents =
          cost && cost.quantity > 0
            ? Math.round(cost.totalCostCents / cost.quantity)
            : 0;

        invoiceItems.push({
          productId: product.id,
          quantity,
          unitPrice: product.price,
          unitCost: fromCents(unitCostCents),
        });
      }

      const discountCents = toCents(discountInput);

      if (!Number.isSafeInteger(discountCents)) {
        throw new InvoiceError("قيمة الخصم أكبر من الحد المسموح");
      }

      if (discountCents > subtotalCents) {
        throw new InvoiceError("الخصم أكبر من مجموع الفاتورة");
      }

      // total هو صافي الفاتورة بعد الخصم.
      const totalCents = subtotalCents - discountCents;
      const total = fromCents(totalCents);
      const discount = fromCents(discountCents);

      // الكاش يدفع كامل الصافي، والأنواع الأخرى تستخدم المدفوع المرسل.
      const paidCents =
        paymentType === "CASH"
          ? totalCents
          : toCents(paidInput);

      if (!Number.isSafeInteger(paidCents)) {
        throw new InvoiceError("المبلغ المدفوع أكبر من الحد المسموح");
      }

      if (paidCents > totalCents) {
        throw new InvoiceError(
          "المبلغ المدفوع أكبر من إجمالي الفاتورة بعد الخصم"
        );
      }

      if (
        paymentType === "HALF_CREDIT" &&
        !(paidCents > 0 && paidCents < totalCents)
      ) {
        throw new InvoiceError(
          "في حالة نصف آجل، يجب أن يكون المدفوع أكبر من صفر وأقل من الإجمالي"
        );
      }

      const paidAmount = fromCents(paidCents);
      const remaining = fromCents(totalCents - paidCents);

      const actualPaymentMethod =
        paidCents > 0 ? paymentMethod : null;

      const invoice = await tx.invoice.create({
        data: {
          date: saleDate,
          placeName: placeName || null,
          customerId: invoiceCustomerId,
          userId: session.userId,
          total,
          discount,
          paidAmount,
          paymentType,
          paymentMethod: actualPaymentMethod,
          items: {
            create: invoiceItems,
          },
        },
      });

      // تسجيل الدفعة الأولى ووسيلة التحصيل في نفس العملية.
      if (paidCents > 0 && invoiceCustomerId !== null) {
        await tx.payment.create({
          data: {
            amount: paidAmount,
            paymentMethod,
            note: `دفعة عند إصدار الفاتورة #${invoice.id}`,
            customerId: invoiceCustomerId,
            invoiceId: invoice.id,
            repId: session.userId,
          },
        });
      }

      // خصم المخزون وتسجيل الحركة لكل صنف.
      for (const item of invoiceItems) {
        const product = productMap.get(item.productId)!;
        const previousStock = product.stock;
        const newStock = previousStock - item.quantity;

        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: previousStock,
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new InvoiceError(
            `مخزون المنتج ${product.name} اتغيّر، حدّث الصفحة وحاول تاني`
          );
        }

        await tx.stockMovement.create({
          data: {
            type: "OUT",
            quantity: item.quantity,
            previousStock,
            newStock,
            productId: item.productId,
            userId: session.userId,
            note: `بيع - فاتورة رقم #${invoice.id}`,
          },
        });
      }

      return {
        invoiceId: invoice.id,
        total,
        discount,
        paymentMethod: actualPaymentMethod,
        paidAmount,
        remaining,
      };
    });

    revalidatePath("/invoices");
    revalidatePath("/products");
    revalidatePath("/rep");
    revalidatePath("/collections");
    revalidatePath("/payments");
    revalidatePath("/customers");
    revalidatePath("/dashboard");

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof InvoiceError) {
      return { ok: false, error: error.message };
    }

    console.error("Create invoice error:", error);

    return {
      ok: false,
      error: "حصل خطأ أثناء إنشاء الفاتورة، راجع سجل السيرفر",
    };
  }
}
