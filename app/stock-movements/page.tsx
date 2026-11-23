
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";

const DAY = 24 * 60 * 60 * 1000;

const movementTypes = {
  IN: {
    label: "إضافة مخزون",
    style: "bg-green-100 text-green-700",
  },
  OUT: {
    label: "خروج مخزون",
    style: "bg-red-100 text-red-700",
  },
  ADJUSTMENT: {
    label: "تسوية مخزون",
    style: "bg-amber-100 text-amber-700",
  },
  RETURN: {
    label: "مرتجع",
    style: "bg-blue-100 text-blue-700",
  },
} as const;

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

function formatDate(date: Date) {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00+03:00`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toLocaleDateString("en-CA", {
      timeZone: "Asia/Riyadh",
    }) !== value
  ) {
    return null;
  }

  return date;
}

function validNumber(value?: string) {
  if (!value || !/^\d+$/.test(value)) return undefined;

  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0
    ? number
    : undefined;
}

function MovementBadge({ type }: { type: string }) {
  const info =
    movementTypes[type as keyof typeof movementTypes];

  return (
    <span
      className={`inline-flex max-w-full items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        info?.style ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {info?.label ?? type}
    </span>
  );
}

function MovementValue({
  label,
  value,
  dir,
}: {
  label: string;
  value: React.ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500 sm:text-xs">
        {label}
      </p>

      <div
        className="mt-1 break-words text-sm font-semibold text-gray-800"
        dir={dir}
      >
        {value}
      </div>
    </div>
  );
}

async function StockMovementsContent({
  searchParams,
}: {
  searchParams: Promise<{
    productId?: string;
    userId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  await requireRole(["ADMIN", "EMPLOYEE"]);

  const params = await searchParams;

  const productId = validNumber(params.productId);
  const userId = validNumber(params.userId);

  const type =
    params.type &&
    Object.prototype.hasOwnProperty.call(
      movementTypes,
      params.type
    )
      ? params.type
      : undefined;

  const fromDate = parseDate(params.dateFrom);
  const toDate = parseDate(params.dateTo);

  const endExclusive = toDate
    ? new Date(toDate.getTime() + DAY)
    : null;

  const [
    movements,
    products,
    users,
    totalMovements,
    totalIn,
    totalOut,
  ] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        ...(productId ? { productId } : {}),
        ...(userId ? { userId } : {}),
        ...(type ? { type } : {}),
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(endExclusive ? { lt: endExclusive } : {}),
        },
      },
      include: {
        product: {
          select: { name: true },
        },
        user: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),

    prisma.product.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.user.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.stockMovement.count(),

    prisma.stockMovement.count({
      where: { type: "IN" },
    }),

    prisma.stockMovement.count({
      where: { type: "OUT" },
    }),
  ]);

  return (
    <>
      {/* ================================== */}
      {/* STATISTICS */}
      {/* ================================== */}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <div className={`${ui.card} min-w-0`}>
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            إجمالي الحركات
          </p>

          <p className="mt-2 break-all text-2xl font-extrabold text-gray-900 sm:text-3xl">
            {formatNumber(totalMovements)}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            جميع حركات المخزون المسجلة
          </p>
        </div>

        <div className={`${ui.card} min-w-0`}>
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            عمليات إضافة المخزون
          </p>

          <p className="mt-2 break-all text-2xl font-extrabold text-green-600 sm:text-3xl">
            {formatNumber(totalIn)}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            إجمالي عمليات الإضافة
          </p>
        </div>

        <div className={`${ui.card} min-w-0`}>
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            عمليات خروج المخزون
          </p>

          <p className="mt-2 break-all text-2xl font-extrabold text-red-600 sm:text-3xl">
            {formatNumber(totalOut)}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            إجمالي عمليات الخروج
          </p>
        </div>
      </div>

      {/* ================================== */}
      {/* FILTERS */}
      {/* ================================== */}

      <form
        method="GET"
        action="/stock-movements"
        className={`${ui.card} mb-5 min-w-0 sm:mb-6`}
      >
        <div className="mb-4">
          <h2 className="font-bold text-gray-800">
            البحث والتصفية
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            حدد المنتج أو الموظف أو نوع الحركة أو الفترة الزمنية.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="min-w-0">
            <label
              htmlFor="filter-product"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              المنتج
            </label>

            <select
              id="filter-product"
              name="productId"
              defaultValue={params.productId ?? ""}
              className={`${ui.input} min-h-11 w-full`}
            >
              <option value="">كل المنتجات</option>

              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="filter-user"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              الموظف
            </label>

            <select
              id="filter-user"
              name="userId"
              defaultValue={params.userId ?? ""}
              className={`${ui.input} min-h-11 w-full`}
            >
              <option value="">كل الموظفين</option>

              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="filter-type"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              نوع الحركة
            </label>

            <select
              id="filter-type"
              name="type"
              defaultValue={type ?? ""}
              className={`${ui.input} min-h-11 w-full`}
            >
              <option value="">كل أنواع الحركات</option>
              <option value="IN">إضافة مخزون</option>
              <option value="OUT">خروج مخزون</option>
              <option value="ADJUSTMENT">تسوية مخزون</option>
              <option value="RETURN">مرتجع</option>
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="filter-date-from"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              من تاريخ
            </label>

            <input
              id="filter-date-from"
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom ?? ""}
              className={`${ui.input} min-h-11 w-full`}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="filter-date-to"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              إلى تاريخ
            </label>

            <input
              id="filter-date-to"
              type="date"
              name="dateTo"
              defaultValue={params.dateTo ?? ""}
              className={`${ui.input} min-h-11 w-full`}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="submit"
            className={`${ui.btn} flex min-h-11 w-full items-center justify-center sm:w-auto`}
          >
            بحث وتصفية
          </button>

          <Link
            href="/stock-movements"
            className="flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 sm:w-auto"
          >
            مسح الفلاتر
          </Link>

          <Link
            href="/products"
            className="flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 sm:w-auto"
          >
            العودة للمنتجات
          </Link>
        </div>
      </form>

      {/* ================================== */}
      {/* MOVEMENTS HEADER */}
      {/* ================================== */}

      <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-3 sm:px-4">
          <div>
            <h2 className="font-bold text-gray-800">
              سجل حركات المخزون
            </h2>

            <p className="mt-1 text-xs text-gray-500 sm:hidden">
              تفاصيل الإضافات والخروج والتسويات
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
            {movements.length} حركة معروضة
          </span>
        </div>

        {/* ================================== */}
        {/* MOBILE CARDS */}
        {/* ================================== */}

        <div className="space-y-3 p-3 md:hidden">
          {movements.map((movement) => (
            <article
              key={movement.id}
              className="min-w-0 rounded-xl border border-gray-200 bg-white p-3"
            >
              {/* Product and movement type */}
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">
                    المنتج
                  </p>

                  <h3 className="mt-1 break-words text-sm font-bold text-gray-900">
                    {movement.product.name}
                  </h3>
                </div>

                <div className="shrink-0">
                  <MovementBadge type={movement.type} />
                </div>
              </div>

              {/* Quantity and stock */}
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2.5">
                <MovementValue
                  label="الكمية"
                  value={formatNumber(movement.quantity)}
                  dir="ltr"
                />

                <MovementValue
                  label="قبل الحركة"
                  value={formatNumber(movement.previousStock)}
                  dir="ltr"
                />

                <MovementValue
                  label="بعد الحركة"
                  value={formatNumber(movement.newStock)}
                  dir="ltr"
                />
              </div>

              {/* User and date */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MovementValue
                  label="المستخدم"
                  value={movement.user.name}
                />

                <MovementValue
                  label="التاريخ"
                  value={formatDate(movement.createdAt)}
                  dir="ltr"
                />
              </div>

              {/* Note */}
              {movement.note && (
                <div className="mt-3 border-t border-gray-100 pt-2.5">
                  <p className="text-[11px] text-gray-500">
                    ملاحظات
                  </p>

                  <p className="mt-1 break-words text-sm leading-6 text-gray-700">
                    {movement.note}
                  </p>
                </div>
              )}
            </article>
          ))}

          {movements.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-gray-600">
                مفيش حركات مخزون مسجلة تطابق البحث.
              </p>

              <p className="mt-1 text-xs text-gray-400">
                جرب تغيير الفلاتر أو الفترة الزمنية.
              </p>
            </div>
          )}
        </div>

        {/* ================================== */}
        {/* DESKTOP TABLE */}
        {/* ================================== */}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-right">
            <thead className="bg-gray-50">
              <tr>
                <th className={ui.th}>المنتج</th>
                <th className={ui.th}>نوع الحركة</th>
                <th className={ui.th}>الكمية</th>
                <th className={ui.th}>قبل</th>
                <th className={ui.th}>بعد</th>
                <th className={ui.th}>المستخدم</th>
                <th className={ui.th}>ملاحظات</th>
                <th className={ui.th}>التاريخ</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {movements.map((movement) => {
                const info =
                  movementTypes[
                    movement.type as keyof typeof movementTypes
                  ];

                return (
                  <tr
                    key={movement.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className={`${ui.td} font-semibold`}>
                      {movement.product.name}
                    </td>

                    <td className={ui.td}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          info?.style ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {info?.label ?? movement.type}
                      </span>
                    </td>

                    <td className={`${ui.td} font-semibold`}>
                      {formatNumber(movement.quantity)}
                    </td>

                    <td className={ui.td}>
                      {formatNumber(movement.previousStock)}
                    </td>

                    <td className={ui.td}>
                      {formatNumber(movement.newStock)}
                    </td>

                    <td className={ui.td}>
                      {movement.user.name}
                    </td>

                    <td className={`${ui.td} max-w-52`}>
                      <span className="break-words text-sm text-gray-500">
                        {movement.note || "-"}
                      </span>
                    </td>

                    <td className={ui.td}>
                      <span
                        dir="ltr"
                        className="whitespace-nowrap"
                      >
                        {formatDate(movement.createdAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {movements.length === 0 && (
                <tr>
                  <td colSpan={8} className={ui.empty}>
                    مفيش حركات مخزون مسجلة تطابق البحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Limit notice */}
        {movements.length === 200 && (
          <p className="border-t border-gray-100 bg-gray-50 px-3 py-3 text-center text-xs leading-5 text-gray-500 sm:px-4">
            يتم عرض آخر 200 حركة. استخدم الفلاتر لتحديد النتائج.
          </p>
        )}
      </div>
    </>
  );
}

// ==========================================
// PAGE
// ==========================================

export default function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    productId?: string;
    userId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  return (
    <main dir="rtl" className={`${ui.page} min-w-0`}>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
          حركة المخزون
        </h1>

        <p className="mt-1 text-xs leading-6 text-gray-500 sm:text-sm">
          متابعة جميع عمليات دخول وخروج وتسوية المنتجات
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            </div>

            <p className="py-4 text-center text-sm text-gray-400">
              جارٍ تحميل حركات المخزون...
            </p>
          </div>
        }
      >
        <StockMovementsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
