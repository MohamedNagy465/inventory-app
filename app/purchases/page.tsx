
import { Suspense } from "react";
import { prisma } from "../../lib/prisma";
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";
import PurchaseForm from "./PurchaseForm";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date) {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ==========================================
// STATISTICS CARD
// ==========================================

function StatCard({
  title,
  value,
  description,
  icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
  tone?: "blue" | "green" | "amber";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={`${ui.card} flex min-w-0 items-start justify-between gap-3`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 sm:text-sm">
          {title}
        </p>

        <p className="mt-2 break-all text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
          {value}
        </p>

        <p className="mt-1 text-[11px] text-gray-400 sm:text-xs">
          {description}
        </p>
      </div>

      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-12 sm:w-12 ${tones[tone]}`}>
        {icon}
      </span>
    </div>
  );
}

// ==========================================
// PURCHASE ITEMS
// ==========================================

function PurchaseItems({
  items,
}: {
  items: {
    id: number;
    quantity: number;
    unitCost: number;
    product: { name: string };
  }[];
}) {
  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="min-w-0 rounded-xl border border-gray-100 bg-white p-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                {index + 1}
              </span>

              <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-6 text-gray-800">
                {item.product.name}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-400 sm:text-xs">
                  الكمية
                </p>
                <p className="mt-1 text-sm font-bold text-gray-800">
                  {item.quantity}
                </p>
              </div>

              <div className="min-w-0 rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-400 sm:text-xs">
                  تكلفة الوحدة
                </p>
                <p className="mt-1 break-all text-xs font-bold text-gray-800" dir="ltr">
                  {money(item.unitCost)}
                </p>
              </div>

              <div className="min-w-0 rounded-lg bg-blue-50 p-2">
                <p className="text-[10px] text-blue-500 sm:text-xs">
                  الإجمالي
                </p>
                <p className="mt-1 break-all text-xs font-extrabold text-blue-700" dir="ltr">
                  {money(item.quantity * item.unitCost)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full min-w-[500px] text-right text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600">
                المنتج
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">
                الكمية
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">
                تكلفة الوحدة
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">
                الإجمالي
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {item.product.name}
                </td>

                <td className="px-4 py-3">
                  {item.quantity}
                </td>

                <td className="px-4 py-3">
                  <span dir="ltr">
                    {money(item.unitCost)}
                  </span>
                </td>

                <td className="px-4 py-3 font-semibold">
                  <span dir="ltr">
                    {money(item.quantity * item.unitCost)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ==========================================
// PURCHASES CONTENT
// ==========================================

async function PurchasesContent() {
  await requireRole(["ADMIN"]);

  const [products, purchases, purchaseCount, purchaseTotal] =
    await Promise.all([
      prisma.product.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          stock: true,
        },
      }),

      prisma.purchase.findMany({
        orderBy: { id: "desc" },
        take: 30,
        include: {
          user: {
            select: { name: true },
          },
          items: {
            include: {
              product: {
                select: { name: true },
              },
            },
          },
        },
      }),

      prisma.purchase.count(),

      prisma.purchase.aggregate({
        _sum: {
          total: true,
        },
      }),
    ]);

  const totalPurchases = purchaseTotal._sum.total ?? 0;

  const totalUnits = purchases.reduce(
    (sum, purchase) =>
      sum +
      purchase.items.reduce(
        (itemSum, item) => itemSum + item.quantity,
        0
      ),
    0
  );

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">

      {/* Statistics */}
      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="إجمالي فواتير الشراء"
          value={purchaseCount.toLocaleString("en-US")}
          description="عدد الفواتير المسجلة"
          icon="🧾"
          tone="blue"
        />

        <StatCard
          title="إجمالي قيمة المشتريات"
          value={money(totalPurchases)}
          description="القيمة الإجمالية لجميع المشتريات"
          icon="💰"
          tone="green"
        />

        <StatCard
          title="الوحدات في آخر 30 فاتورة"
          value={totalUnits.toLocaleString("en-US")}
          description="إجمالي الكميات في الفواتير المعروضة"
          icon="📦"
          tone="amber"
        />
      </section>

      {/* New Purchase */}
      <section className="min-w-0 space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 sm:text-xl">
            تسجيل فاتورة شراء جديدة
          </h2>

          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            أدخل بيانات المورد والمنتجات وتكلفة الشراء.
          </p>
        </div>

        <PurchaseForm products={products} />
      </section>

      {/* Purchase History */}
      <section className="min-w-0 space-y-3 sm:space-y-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-gray-900 sm:text-xl">
              سجل المشتريات
            </h2>

            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              أحدث عمليات شراء مسجلة في النظام.
            </p>
          </div>

          <span className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 sm:text-sm">
            {purchaseCount.toLocaleString("en-US")} فاتورة
          </span>
        </div>

        <div className={`${ui.tableCard} min-w-0 divide-y divide-gray-100 overflow-hidden`}>
          {purchases.length === 0 ? (
            <div className="px-4 py-12 text-center sm:py-16">
              <div className="mb-3 text-4xl">📦</div>

              <h3 className="font-bold text-gray-800">
                لا توجد مشتريات مسجلة
              </h3>

              <p className="mt-2 text-xs text-gray-400 sm:text-sm">
                فواتير الشراء الجديدة ستظهر هنا.
              </p>
            </div>
          ) : (
            purchases.map((purchase) => (
              <details
                key={purchase.id}
                className="group min-w-0"
              >
                {/* Purchase summary */}
                <summary className="flex min-w-0 cursor-pointer list-none flex-col gap-3 p-3.5 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">
                        فاتورة شراء #{purchase.id}
                      </h3>

                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700 sm:text-xs">
                        تم التسجيل
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-gray-500 sm:gap-x-4 sm:text-xs">
                      <span className="max-w-full break-words">
                        المورد: {purchase.supplierName || "غير محدد"}
                      </span>

                      <span dir="ltr">
                        {formatDate(purchase.date)}
                      </span>

                      <span>
                        {purchase.items.length} أصناف
                      </span>

                      <span>
                        المسجل: {purchase.user.name}
                      </span>
                    </div>

                    {purchase.supplierInvoiceNo && (
                      <p className="mt-2 break-words text-[11px] text-gray-400 sm:text-xs">
                        رقم فاتورة المورد: {purchase.supplierInvoiceNo}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 sm:hidden">
                        إجمالي الفاتورة
                      </p>

                      <strong
                        className="text-lg font-extrabold text-gray-900 sm:text-xl"
                        dir="ltr"
                      >
                        {money(purchase.total)}
                      </strong>
                    </div>

                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500 transition-transform group-open:rotate-180">
                      ▼
                    </span>
                  </div>
                </summary>

                {/* Purchase details */}
                <div className="min-w-0 border-t border-gray-100 bg-gray-50/60 p-3 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-gray-800">
                      تفاصيل الأصناف
                    </h4>

                    <span className="text-[11px] text-gray-400">
                      {purchase.items.length} أصناف
                    </span>
                  </div>

                  <PurchaseItems items={purchase.items} />

                  {purchase.note && (
                    <p className="mt-3 break-words rounded-xl border border-gray-100 bg-white p-3 text-xs leading-6 text-gray-600 sm:text-sm">
                      <strong className="text-gray-800">
                        ملاحظات:
                      </strong>{" "}
                      {purchase.note}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
                    <span className="text-sm font-bold text-gray-700">
                      إجمالي الفاتورة
                    </span>

                    <strong
                      className="break-all text-lg font-extrabold text-green-700 sm:text-xl"
                      dir="ltr"
                    >
                      {money(purchase.total)}
                    </strong>
                  </div>
                </div>
              </details>
            ))
          )}

          {purchaseCount > 30 && (
            <div className="bg-gray-50 px-3 py-3 text-center text-[11px] leading-5 text-gray-500 sm:px-4 sm:text-xs">
              يتم عرض أحدث 30 فاتورة من أصل{" "}
              {purchaseCount.toLocaleString("en-US")} فاتورة.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ==========================================
// PURCHASES PAGE
// ==========================================

export default function PurchasesPage() {
  return (
    <main
      dir="rtl"
      className={`${ui.page} min-w-0 space-y-5 sm:space-y-7 lg:space-y-8`}
    >
      <header className="min-w-0">
        <div className="mb-2 inline-flex flex-wrap items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 sm:text-xs">
          <span>●</span>
          إدارة المخزون
          <span className="text-blue-300">/</span>
          المشتريات
        </div>

        <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
          إدارة المشتريات
        </h1>

        <p className="mt-1 text-xs leading-6 text-gray-500 sm:mt-2 sm:text-sm">
          تسجيل فواتير التوريد وإضافة البضاعة إلى المخزون ومتابعة عمليات الشراء.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="min-w-0 animate-pulse space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="h-28 rounded-xl bg-gray-200" />
              <div className="h-28 rounded-xl bg-gray-200" />
              <div className="h-28 rounded-xl bg-gray-200" />
            </div>

            <div className="h-72 rounded-xl bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
          </div>
        }
      >
        <PurchasesContent />
      </Suspense>
    </main>
  );
}
