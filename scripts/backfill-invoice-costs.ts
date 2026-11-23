
import { prisma } from "../lib/prisma";

type CostPlan = {
  invoiceItemId: number;
  productId: number;
  productName: string;
  invoiceDate: Date;
  unitCost: number;
  source: "PURCHASE_AVERAGE" | "PRODUCT_COST";
};

async function main() {
  const applyChanges = process.argv.includes("--apply");

  console.log("\n=== Invoice Cost Backfill ===");
  console.log(
    applyChanges
      ? "MODE: APPLY - سيتم تحديث قاعدة البيانات"
      : "MODE: DRY RUN - لن يتم تعديل أي بيانات"
  );

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      unitCost: 0,
    },
    select: {
      id: true,
      productId: true,
      quantity: true,
      invoice: {
        select: {
          date: true,
        },
      },
      product: {
        select: {
          name: true,
          costPrice: true,
        },
      },
    },
  });

  if (invoiceItems.length === 0) {
    console.log("\nلا توجد بنود فواتير بدون تكلفة.");
    return;
  }

  const productIds = [
    ...new Set(invoiceItems.map((item) => item.productId)),
  ];

  const purchaseItems = await prisma.purchaseItem.findMany({
    where: {
      productId: {
        in: productIds,
      },
    },
    select: {
      productId: true,
      quantity: true,
      unitCost: true,
      purchase: {
        select: {
          date: true,
        },
      },
    },
  });

  const purchasesByProduct = new Map<
    number,
    {
      date: Date;
      quantity: number;
      unitCostCents: number;
    }[]
  >();

  for (const item of purchaseItems) {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitCost) ||
      item.unitCost < 0
    ) {
      continue;
    }

    const list =
      purchasesByProduct.get(item.productId) ?? [];

    list.push({
      date: item.purchase.date,
      quantity: item.quantity,
      unitCostCents: Math.round(item.unitCost * 100),
    });

    purchasesByProduct.set(item.productId, list);
  }

  const plans: CostPlan[] = [];

  const unresolved = new Map<
    number,
    {
      name: string;
      count: number;
    }
  >();

  for (const item of invoiceItems) {
    const purchases =
      purchasesByProduct.get(item.productId) ?? [];

    let purchasedQuantity = 0;
    let totalCostCents = 0;

    // المشتريات التي حدثت في تاريخ الفاتورة أو قبله.
    for (const purchase of purchases) {
      if (purchase.date > item.invoice.date) {
        continue;
      }

      purchasedQuantity += purchase.quantity;

      totalCostCents +=
        purchase.quantity * purchase.unitCostCents;
    }

    let unitCostCents = 0;
    let source: CostPlan["source"] = "PRODUCT_COST";

    // الأولوية لمتوسط تكلفة الشراء المرجّح.
    if (
      purchasedQuantity > 0 &&
      totalCostCents > 0
    ) {
      unitCostCents = Math.round(
        totalCostCents / purchasedQuantity
      );

      source = "PURCHASE_AVERAGE";
    } else {
      // المنتجات التي دخلت المخزون يدويًا.
      unitCostCents = Math.round(
        item.product.costPrice * 100
      );

      source = "PRODUCT_COST";
    }

    if (
      !Number.isSafeInteger(unitCostCents) ||
      unitCostCents <= 0
    ) {
      const current =
        unresolved.get(item.productId) ?? {
          name: item.product.name,
          count: 0,
        };

      current.count++;
      unresolved.set(item.productId, current);
      continue;
    }

    plans.push({
      invoiceItemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      invoiceDate: item.invoice.date,
      unitCost: unitCostCents / 100,
      source,
    });
  }

  const purchasePlans = plans.filter(
    (p) => p.source === "PURCHASE_AVERAGE"
  );

  const manualPlans = plans.filter(
    (p) => p.source === "PRODUCT_COST"
  );

  console.log(`\nبنود الفواتير بدون تكلفة: ${invoiceItems.length}`);
  console.log(`بنود يمكن تحديثها: ${plans.length}`);
  console.log(`من متوسط المشتريات: ${purchasePlans.length}`);
  console.log(`من تكلفة المنتج اليدوية: ${manualPlans.length}`);
  console.log(`بنود لا تزال بدون تكلفة: ${unresolved.size === 0 ? 0 : [...unresolved.values()].reduce((s, p) => s + p.count, 0)}`);

  if (plans.length > 0) {
    console.log("\nتفاصيل التكاليف:");

    for (const plan of plans) {
      console.log(
        `InvoiceItem #${plan.invoiceItemId} | ` +
          `${plan.productName} | ` +
          `التكلفة: ${plan.unitCost.toFixed(2)} | ` +
          `المصدر: ${plan.source}`
      );
    }
  }

  if (unresolved.size > 0) {
    console.log("\nمنتجات لا تزال تحتاج تكلفة:");

    for (const [id, product] of unresolved) {
      console.log(
        `Product #${id} | ${product.name} | ${product.count} بند`
      );
    }
  }

  if (!applyChanges) {
    console.log(
      "\nDry run انتهى. لم يتم تعديل قاعدة البيانات."
    );
    console.log(
      "راجع الأسعار، ثم استخدم --apply لتنفيذ التحديث."
    );
    return;
  }

  if (plans.length === 0) {
    console.log("\nلا توجد تكاليف يمكن تحديثها.");
    return;
  }

  let updatedCount = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const plan of plans) {
        const result = await tx.invoiceItem.updateMany({
          where: {
            id: plan.invoiceItemId,
            unitCost: 0,
          },
          data: {
            unitCost: plan.unitCost,
          },
        });

        updatedCount += result.count;
      }
    },
    {
      timeout: 60000,
    }
  );

  console.log("\nتمت العملية بنجاح.");
  console.log(`بنود تم تحديثها: ${updatedCount}`);
  console.log(
    `بنود لم يتم تحديثها: ${invoiceItems.length - updatedCount}`
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
