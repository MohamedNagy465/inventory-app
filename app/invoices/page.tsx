
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";
import { ui } from "../../lib/ui";
import InvoiceForm from "./InvoiceForm";
import SellerPOS from "./seller/SellerPOS";
import { getOpenShift } from "../../lib/shift";

function formatInvoiceDate(date: Date) {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function NewInvoice() {
  const session = await getSession();

  if (!session) return null;

  // الوردية مطلوبة للبائع فقط
  const shiftRequired = session.role === "SELLER";
  const shift = shiftRequired
    ? await getOpenShift(session.userId)
    : null;

  const initialShift = shift
    ? {
        id: shift.id,
        openingCash: shift.openingCash,
        openedAt: shift.openedAt.toISOString(),
      }
    : null;

  const [products, customers] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  const customerData = customers.map(({ id, name }) => ({
    id,
    name,
  }));

  // البائع والموظف يستخدمان شاشة البيع السريعة
  if (
    session.role === "SELLER" ||
    session.role === "EMPLOYEE"
  ) {
    return (
      <SellerPOS
        products={products.map(
          ({ id, name, price, stock, barcode }) => ({
            id,
            name,
            price,
            stock,
            barcode,
          })
        )}
        customers={customerData}
        initialShift={initialShift}
        shiftRequired={shiftRequired}
      />
    );
  }

  // المدير يستخدم نموذج الفاتورة التقليدي
  return (
    <InvoiceForm
      products={products.map(
        ({ id, name, price, stock }) => ({
          id,
          name,
          price,
          stock,
        })
      )}
      customers={customerData}
    />
  );
}

// حالة الدفع من المدفوع والإجمالي
function paymentStatus(total: number, paid: number) {
  const remaining =
    Math.round(total * 100) - Math.round(paid * 100);

  if (remaining <= 0) {
    return {
      label: "مدفوعة",
      className: "bg-green-100 text-green-700",
    };
  }

  if (paid > 0) {
    return {
      label: "جزئي",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "آجل",
    className: "bg-red-100 text-red-700",
  };
}

async function InvoicesList() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { id: "desc" },
    take: 20,
    include: {
      customer: true,
      user: {
        select: { name: true },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  return (
    <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
      {invoices.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="font-semibold text-gray-700">
            مفيش فواتير لسه
          </p>
          <p className="mt-1 text-xs text-gray-400">
            الفواتير الجديدة هتظهر هنا.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {invoices.map((inv) => {
              const status = paymentStatus(
                inv.total,
                inv.paidAmount
              );

              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="block min-w-0 p-3.5 transition hover:bg-gray-50 active:bg-gray-100"
                >
                  {/* Invoice number and payment status */}
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        رقم الفاتورة
                      </p>

                      <p className="mt-0.5 text-base font-extrabold text-blue-700">
                        #{inv.id}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Invoice details */}
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-gray-50 p-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">
                        العميل
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-800">
                        {inv.customer?.name ?? "-"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">
                        الموظف
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-800">
                        {inv.user.name}
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
                        {formatInvoiceDate(inv.date)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">
                        عدد الأصناف
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {inv._count.items}
                      </p>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      إجمالي الفاتورة
                    </span>

                    <span
                      className="text-base font-extrabold text-gray-900"
                      dir="ltr"
                    >
                      {inv.total.toFixed(2)}
                    </span>
                  </div>

                  <p className="mt-2 text-left text-[11px] font-medium text-blue-600">
                    عرض تفاصيل الفاتورة ←
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className={ui.th}>رقم</th>
                  <th className={ui.th}>التاريخ</th>
                  <th className={ui.th}>العميل</th>
                  <th className={ui.th}>الموظف</th>
                  <th className={ui.th}>الأصناف</th>
                  <th className={ui.th}>الإجمالي</th>
                  <th className={ui.th}>الدفع</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const status = paymentStatus(
                    inv.total,
                    inv.paidAmount
                  );

                  return (
                    <tr
                      key={inv.id}
                      className="relative cursor-pointer transition hover:bg-gray-50"
                    >
                      <td className={`${ui.td} font-medium`}>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="text-blue-600 after:absolute after:inset-0"
                        >
                          #{inv.id}
                        </Link>
                      </td>

                      <td className={ui.td}>
                        <span dir="ltr">
                          {formatInvoiceDate(inv.date)}
                        </span>
                      </td>

                      <td className={ui.td}>
                        {inv.customer?.name ?? "-"}
                      </td>

                      <td className={ui.td}>
                        {inv.user.name}
                      </td>

                      <td className={ui.td}>
                        {inv._count.items}
                      </td>

                      <td className={`${ui.td} font-semibold`}>
                        <span dir="ltr">
                          {inv.total.toFixed(2)}
                        </span>
                      </td>

                      <td className={ui.td}>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
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
  );
}

// المدير فقط يشوف قائمة آخر الفواتير
async function RecentInvoices() {
  const session = await getSession();

  if (session?.role !== "ADMIN") return null;

  return (
    <section className="min-w-0">
      <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-2 sm:mt-8">
        <h2 className="font-bold text-gray-800 sm:text-lg">
          آخر الفواتير
        </h2>

        <span className="text-xs text-gray-400">
          آخر 20 فاتورة
        </span>
      </div>

      <InvoicesList />
    </section>
  );
}

export default function InvoicesPage() {
  return (
    <main
      dir="rtl"
      className={`${ui.page} min-w-0 space-y-5 sm:space-y-6`}
    >
      {/* Page heading */}
      <header className="mb-5 min-w-0 sm:mb-6">
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
          الفواتير
        </h1>

        <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
          إنشاء فاتورة جديدة ومراجعة آخر الفواتير
        </p>
      </header>

      {/* New invoice */}
      <Suspense
        fallback={
          <div
            className="min-h-32 animate-pulse rounded-xl bg-gray-100"
            aria-busy="true"
          />
        }
      >
        <NewInvoice />
      </Suspense>

      {/* Recent invoices */}
      <Suspense
        fallback={
          <div className="mt-8 space-y-3" aria-busy="true">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-100" />
            <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <RecentInvoices />
      </Suspense>
    </main>
  );
}
