import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth";
import PrintButton from "./PrintButton";
import AutoPrint from "./AutoPrint";

const fmt = (n: number) => n.toFixed(2);

const paymentLabels: Record<string, string> = {
  CASH: "نقدي",
  CREDIT: "آجل",
  HALF_CREDIT: "نصف آجل",
};

async function InvoiceContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ADMIN", "EMPLOYEE", "SELLER"]);
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) notFound();

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      ...(session.role === "SELLER" ? { userId: session.userId } : {}),
    },
    include: {
      customer: true,
      user: { select: { name: true } },
      order: { select: { id: true } },
      items: {
        include: { product: { select: { name: true } } },
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
  const paidAmount = Number(invoice.paidAmount ?? 0);
  const remaining = Math.max(0, Number(invoice.total) - paidAmount);
  const paymentLabel = paymentLabels[invoice.paymentType] ?? "غير محدد";

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={session.role === "SELLER" ? "/invoices/seller" : "/invoices"}
          className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          {session.role === "SELLER" ? "← رجوع لنقطة البيع" : "← رجوع للفواتير"}
        </Link>
        <PrintButton />
      </div>

      <article
        id="invoice-print-area"
        className="mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
      >
        {/* Brand and invoice number */}
        <header className="border-b-2 border-slate-900 px-5 py-5 sm:px-8 sm:py-6 print:px-0 print:pb-4 print:pt-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 print:bg-transparent print:px-0 print:py-0">
                فاتورة بيع
              </span>
              <h1 className="break-words text-xl font-black tracking-tight text-slate-900 sm:text-2xl print:text-2xl">
                الصالح للتجارة والتوزيع
              </h1>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                نظام المخزون والمبيعات
              </p>
            </div>

            <div className="shrink-0 text-left">
              <p className="text-xs font-semibold text-slate-500">رقم الفاتورة</p>
              <p className="mt-1 text-2xl font-black leading-none text-slate-900 sm:text-3xl" dir="ltr">
                #{invoice.id}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500" dir="ltr">
                {date}
              </p>
            </div>
          </div>
        </header>

        {/* Customer and seller information */}
        <section className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 sm:px-8 print:grid-cols-2 print:gap-6 print:px-0 print:py-4">
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4 print:rounded-none print:bg-transparent print:p-0">
            <p className="text-[11px] font-bold tracking-wide text-slate-500">بيانات العميل</p>
            <p className="mt-1.5 break-words text-sm font-extrabold text-slate-900">
              {invoice.customer?.name ?? "بدون عميل"}
            </p>
            {invoice.customer?.phone && (
              <p className="mt-1 text-xs text-slate-500" dir="ltr">
                {invoice.customer.phone}
              </p>
            )}
            {invoice.placeName && (
              <p className="mt-2 break-words text-xs font-semibold text-slate-700">
                <span className="text-slate-500">المكان: </span>
                {invoice.placeName}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 sm:p-4 print:rounded-none print:bg-transparent print:p-0">
            <p className="text-[11px] font-bold tracking-wide text-slate-500">بيانات الفاتورة</p>
            <p className="mt-1.5 break-words text-sm font-extrabold text-slate-900">
              {invoice.user.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">تم إصدار الفاتورة بواسطة</p>
            {invoice.order && (
              <p className="mt-2 text-xs font-semibold text-slate-600">
                مرتبطة بالطلب رقم #{invoice.order.id}
              </p>
            )}
          </div>
        </section>

        {/* Items table: also used in print */}
        <section className="px-5 py-4 sm:px-8 print:px-0 print:py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900">تفاصيل الأصناف</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 print:bg-transparent print:px-0">
              {invoice.items.length} صنف
            </span>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[420px] border-collapse text-right text-sm print:min-w-0">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-slate-600 print:bg-slate-100">
                  <th className="px-3 py-2.5 text-xs font-bold">الصنف</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-bold">الكمية</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-bold">سعر الوحدة</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="max-w-[260px] break-words px-3 py-3 text-sm font-semibold text-slate-800 print:py-2">
                      {item.product.name}
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-slate-700 print:py-2">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-slate-700 print:py-2" dir="ltr">
                      {fmt(item.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-left text-sm font-bold text-slate-900 print:py-2" dir="ltr">
                      {fmt(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Totals and payment summary */}
        <section className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:mx-8 sm:p-5 print:mx-0 print:mb-0 print:rounded-none print:bg-white print:p-0">
          {Number(invoice.discount ?? 0) > 0 && (
            <div className="mb-2 flex items-center justify-between gap-4 text-xs text-slate-600">
              <span>الخصم</span>
              <span className="font-bold" dir="ltr">{fmt(Number(invoice.discount))}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-slate-600">إجمالي الفاتورة</span>
            <strong className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl" dir="ltr">
              {fmt(invoice.total)}
            </strong>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 print:mt-2 print:pt-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">طريقة الدفع</p>
              <p className="mt-1 break-words text-xs font-bold text-slate-800 sm:text-sm">{paymentLabel}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">المدفوع</p>
              <p className="mt-1 text-xs font-bold text-slate-800 sm:text-sm" dir="ltr">{fmt(paidAmount)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">المتبقي</p>
              <p className={`mt-1 text-xs font-extrabold sm:text-sm ${remaining > 0 ? "text-rose-700" : "text-emerald-700"}`} dir="ltr">
                {fmt(remaining)}
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-100 px-5 py-4 text-center sm:px-8 print:px-0 print:py-3">
          <p className="text-sm font-bold text-slate-700">شكرًا لتعاملكم معنا</p>
          <p className="mt-1 text-[10px] text-slate-400">الصالح للتجارة والتوزيع</p>
        </footer>
      </article>

      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; min-width: 0 !important; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: absolute !important;
            top: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          table { width: 100% !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          footer { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

// قراءة searchParams داخل مكوّن فرعي تحت Suspense تمنع تشغيلها أثناء prerendering.
async function InvoicePrintBehavior({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>;
}) {
  const query = await searchParams;
  return <AutoPrint enabled={query.print === "1"} />;
}

export default function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  return (
    <main dir="rtl" className="min-w-0 print:p-0">
      <Suspense fallback={null}>
        <InvoicePrintBehavior searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={
          <div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
        }
      >
        <InvoiceContent params={params} />
      </Suspense>
    </main>
  );
}
