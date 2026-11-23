
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth";
import { ui } from "../../../lib/ui";
import PrintButton from "./PrintButton";

const fmt = (n: number) => n.toFixed(2);

async function InvoiceContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "EMPLOYEE"]);

  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { name: true } },
      order: { select: { id: true } },
      items: {
        include: {
          product: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!invoice) notFound();

  const date = invoice.date.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      {/* Actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/invoices"
          className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 hover:underline"
        >
          ← رجوع للفواتير
        </Link>

        <PrintButton />
      </div>

      {/* Invoice */}
      <div
        className={`${ui.card} min-w-0 overflow-hidden print:border-0 print:p-0 print:shadow-none`}
      >
        {/* Header */}
        <div className="flex min-w-0 flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-gray-900 sm:text-xl">
              📦 نظام المخزون
            </p>

            <p className="mt-1 text-sm text-gray-500">
              فاتورة بيع
            </p>
          </div>

          <div className="min-w-0 sm:text-left">
            <p className="text-xl font-extrabold text-gray-900 sm:text-2xl">
              فاتورة #{invoice.id}
            </p>

            <p
              className="mt-1 text-xs text-gray-500 sm:text-sm"
              dir="ltr"
            >
              {date}
            </p>
          </div>
        </div>

        {/* Customer and employee details */}
        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-gray-100 py-4 sm:grid-cols-2 sm:gap-4">
          <div className="min-w-0 rounded-xl bg-gray-50 p-3 sm:bg-transparent sm:p-0">
            <p className="text-xs font-medium text-gray-500">
              العميل
            </p>

            <p className="mt-1 break-words text-sm font-bold text-gray-900">
              {invoice.customer?.name ?? "بدون عميل"}
            </p>

            {invoice.customer?.phone && (
              <p className="mt-1 text-xs text-gray-500" dir="ltr">
                {invoice.customer.phone}
              </p>
            )}
          </div>

          <div className="min-w-0 rounded-xl bg-gray-50 p-3 sm:bg-transparent sm:p-0">
            <p className="text-xs font-medium text-gray-500">
              تمت بواسطة
            </p>

            <p className="mt-1 break-words text-sm font-bold text-gray-900">
              {invoice.user.name}
            </p>

            {invoice.order && (
              <p className="mt-1 text-xs text-gray-400">
                من طلب #{invoice.order.id}
              </p>
            )}
          </div>
        </div>

        {/* Mobile products cards */}
        <div className="space-y-3 py-4 md:hidden print:hidden">
          <h2 className="text-sm font-bold text-gray-800">
            أصناف الفاتورة ({invoice.items.length})
          </h2>

          {invoice.items.map((item, index) => (
            <div
              key={item.id}
              className="min-w-0 rounded-xl border border-gray-200 p-3"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                  {index + 1}
                </span>

                <p className="min-w-0 flex-1 break-words text-sm font-bold leading-6 text-gray-900">
                  {item.product.name}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="min-w-0 rounded-lg bg-gray-50 p-2">
                  <p className="text-[11px] text-gray-400">
                    الكمية
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-800">
                    {item.quantity}
                  </p>
                </div>

                <div className="min-w-0 rounded-lg bg-gray-50 p-2">
                  <p className="text-[11px] text-gray-400">
                    سعر الوحدة
                  </p>
                  <p
                    className="mt-1 break-all text-sm font-bold text-gray-800"
                    dir="ltr"
                  >
                    {fmt(item.unitPrice)}
                  </p>
                </div>

                <div className="min-w-0 rounded-lg bg-blue-50 p-2">
                  <p className="text-[11px] text-blue-500">
                    الإجمالي
                  </p>
                  <p
                    className="mt-1 break-all text-sm font-extrabold text-blue-700"
                    dir="ltr"
                  >
                    {fmt(item.unitPrice * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table and print table */}
        <div className="hidden overflow-x-auto py-4 md:block print:block print:overflow-visible">
          <table className="w-full min-w-[480px] text-right text-sm print:min-w-0">
            <thead className="bg-gray-50 print:bg-transparent">
              <tr>
                <th className={ui.th}>الصنف</th>
                <th className={ui.th}>الكمية</th>
                <th className={ui.th}>السعر</th>
                <th className={ui.th}>الإجمالي</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className={`${ui.td} font-medium`}>
                    {item.product.name}
                  </td>

                  <td className={ui.td}>
                    {item.quantity}
                  </td>

                  <td className={ui.td}>
                    <span dir="ltr">
                      {fmt(item.unitPrice)}
                    </span>
                  </td>

                  <td className={`${ui.td} font-semibold`}>
                    <span dir="ltr">
                      {fmt(item.unitPrice * item.quantity)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <span className="text-sm font-semibold text-gray-600 sm:text-base">
            إجمالي الفاتورة
          </span>

          <span
            className="break-all text-2xl font-extrabold text-gray-900 sm:text-3xl"
            dir="ltr"
          >
            {fmt(invoice.total)}
          </span>
        </div>

        <div className="mt-4 hidden border-t border-gray-100 pt-3 text-center text-xs text-gray-400 print:block">
          شكرًا لتعاملكم معنا
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main
      dir="rtl"
      className={`${ui.page} min-w-0 print:p-0`}
    >
      <Suspense
        fallback={
          <div
            className="h-64 animate-pulse rounded-xl bg-gray-100"
            aria-busy="true"
          />
        }
      >
        <InvoiceContent params={params} />
      </Suspense>
    </main>
  );
}
