
import { Suspense } from "react";
import { prisma } from "../../lib/prisma";
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";
import OrderActions from "./OrderActions";

const statusStyle: Record<string, { label: string; cls: string }> = {
  APPROVED: {
    label: "تمت الموافقة",
    cls: "bg-green-100 text-green-700",
  },
  REJECTED: {
    label: "مرفوض",
    cls: "bg-red-100 text-red-700",
  },
};

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
    timeStyle: "short",
  });

async function OrdersContent() {
  await requireRole(["ADMIN", "EMPLOYEE"]);

  const include = {
    customer: true,
    rep: { select: { name: true } },
    items: { include: { product: true } },
  } as const;

  const [pending, done] = await Promise.all([
    prisma.order.findMany({
      where: { status: "PENDING" },
      orderBy: { id: "asc" },
      include,
    }),

    prisma.order.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { id: "desc" },
      take: 20,
      include,
    }),
  ]);

  return (
    <div className="w-full min-w-0 space-y-7">

      {/* Pending orders */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-800 sm:text-lg">
            بانتظار الموافقة
          </h2>

          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            {pending.length} طلب معلّق
          </span>
        </div>

        {pending.length === 0 ? (
          <div className={`${ui.tableCard} mb-4`}>
            <div className="px-4 py-10 text-center">
              <p className="text-2xl">✓</p>
              <p className="mt-2 text-sm font-semibold text-gray-700">
                مفيش طلبات معلّقة
              </p>
              <p className="mt-1 text-xs text-gray-400">
                كل الطلبات تمت معالجتها.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((o) => {
              const total = o.items.reduce(
                (s, it) =>
                  s + it.product.price * it.quantity,
                0
              );

              return (
                <article
                  key={o.id}
                  className={`${ui.card} min-w-0 space-y-4`}
                >
                  {/* Order header */}
                  <div className="flex min-w-0 flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-gray-900">
                          طلب #{o.id}
                        </h3>

                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          بانتظار الموافقة
                        </span>
                      </div>

                      <p className="mt-2 break-words text-sm font-semibold text-gray-800">
                        {o.customer?.name ?? "بدون عميل"}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>
                          المندوب: {o.rep.name}
                        </span>

                        <span className="hidden sm:inline">·</span>

                        <span dir="ltr">
                          {fmt(o.createdAt)}
                        </span>
                      </div>

                      {o.note && (
                        <p className="mt-3 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                          <span className="font-semibold">
                            ملاحظة:
                          </span>{" "}
                          {o.note}
                        </p>
                      )}
                    </div>

                    <div className="w-full shrink-0 sm:w-auto">
                      <OrderActions orderId={o.id} />
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-gray-600">
                        أصناف الطلب
                      </h4>

                      <span className="text-[11px] text-gray-400">
                        {o.items.length} صنف
                      </span>
                    </div>

                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 px-3">
                      {o.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex min-w-0 items-start justify-between gap-3 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium text-gray-800">
                              {it.product.name}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              الكمية: {it.quantity}
                            </p>

                            {it.product.stock < it.quantity && (
                              <p className="mt-1 text-xs font-medium text-red-600">
                                المتاح في المخزون: {it.product.stock}
                              </p>
                            )}
                          </div>

                          <span
                            className="shrink-0 text-sm font-semibold text-gray-800"
                            dir="ltr"
                          >
                            {(it.product.price * it.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Order total */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-3">
                    <span className="text-xs font-medium text-gray-500 sm:text-sm">
                      الإجمالي بالأسعار الحالية
                    </span>

                    <span
                      className="text-lg font-extrabold text-gray-900"
                      dir="ltr"
                    >
                      {total.toFixed(2)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Processed orders */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-800 sm:text-lg">
            آخر الطلبات المعالجة
          </h2>

          <span className="text-xs text-gray-400">
            آخر 20 طلب
          </span>
        </div>

        <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
          {done.length === 0 ? (
            <p className={ui.empty}>
              مفيش طلبات معالجة لسه
            </p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-gray-100 md:hidden">
                {done.map((o) => {
                  const st = statusStyle[o.status];

                  return (
                    <article
                      key={o.id}
                      className="min-w-0 p-3.5"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="font-extrabold text-gray-900">
                          طلب #{o.id}
                        </p>

                        {st ? (
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            -
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-gray-50 p-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400">
                            المندوب
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                            {o.rep.name}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400">
                            العميل
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                            {o.customer?.name ?? "-"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400">
                            التاريخ
                          </p>
                          <p
                            className="mt-1 text-xs font-medium text-gray-700"
                            dir="ltr"
                          >
                            {fmt(o.createdAt)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400">
                            رقم الفاتورة
                          </p>
                          <p className="mt-1 text-sm font-bold text-blue-700">
                            {o.invoiceId ? `#${o.invoiceId}` : "-"}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[680px] text-right">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={ui.th}>رقم</th>
                      <th className={ui.th}>المندوب</th>
                      <th className={ui.th}>العميل</th>
                      <th className={ui.th}>التاريخ</th>
                      <th className={ui.th}>الحالة</th>
                      <th className={ui.th}>الفاتورة</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {done.map((o) => {
                      const st = statusStyle[o.status];

                      return (
                        <tr
                          key={o.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className={`${ui.td} font-medium`}>
                            #{o.id}
                          </td>

                          <td className={ui.td}>
                            {o.rep.name}
                          </td>

                          <td className={ui.td}>
                            {o.customer?.name ?? "-"}
                          </td>

                          <td className={ui.td}>
                            <span dir="ltr">
                              {fmt(o.createdAt)}
                            </span>
                          </td>

                          <td className={ui.td}>
                            {st ? (
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}
                              >
                                {st.label}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td className={ui.td}>
                            {o.invoiceId ? `#${o.invoiceId}` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <main
      dir="rtl"
      className={`${ui.page} min-w-0 space-y-5 sm:space-y-6`}
    >
      <header className="min-w-0">
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
          الطلبات
        </h1>

        <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
          طلبات المناديب بانتظار موافقتك ومراجعة الطلبات المعالجة.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <OrdersContent />
      </Suspense>
    </main>
  );
}
