
import { prisma } from "../lib/prisma";

const costs = [
  { id: 2, name: "البلح", costPrice: 14.93 },
  { id: 27, name: "بسكويت شاي", costPrice: 2.50 },
  { id: 16, name: "ملح طعام 1 كجم", costPrice: 4.50 },
  { id: 19, name: "نسكافيه 200 جم", costPrice: 26.00 },
  { id: 31, name: "منظف أطباق 750 مل", costPrice: 10.00 },
  { id: 3, name: "بيبسي", costPrice: 7.25 },
  { id: 4, name: "تفاح", costPrice: 10.00 },
  { id: 33, name: "مناديل (علبة 200)", costPrice: 2.60 },
  { id: 36, name: "معجون أسنان 100 مل", costPrice: 10.50 },
];

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(
    apply
      ? "\nتحديث فعلي لقاعدة البيانات"
      : "\nمعاينة فقط - لن يتم تعديل البيانات"
  );

  const validUpdates: typeof costs = [];

  for (const item of costs) {
    const product = await prisma.product.findUnique({
      where: { id: item.id },
      select: {
        id: true,
        name: true,
        costPrice: true,
      },
    });

    if (!product) {
      console.log(`❌ المنتج رقم ${item.id} غير موجود`);
      continue;
    }

    if (product.costPrice > 0) {
      console.log(
        `⏭️ ${product.name}: لديه تكلفة مسجلة بالفعل (${product.costPrice})`
      );
      continue;
    }

    console.log(
      `${product.id} | ${product.name} | التكلفة المقترحة: ${item.costPrice}`
    );

    validUpdates.push(item);
  }

  console.log(`\nعدد المنتجات التي يمكن تحديثها: ${validUpdates.length}`);

  if (!apply) {
    console.log(
      "\nراجع الأسعار والأحجام، ثم شغّل السكريبت باستخدام --apply"
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const item of validUpdates) {
      await tx.product.updateMany({
        where: {
          id: item.id,
          costPrice: 0,
        },
        data: {
          costPrice: item.costPrice,
        },
      });
    }
  });

  console.log("\n✅ انتهى تحديث تكاليف المنتجات.");
}

main()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
