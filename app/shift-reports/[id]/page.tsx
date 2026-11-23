import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth";
import { ui } from "../../../lib/ui";
import {
  DifferenceBadge,
  fmt,
  formatDateTime,
  paymentLabel,
} from "../shared";

type Params = Promise<{ id: string }>;

function Stat({
  label,
  value,
  tone = "text-gray-900",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 break-words text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

async function ReportContent({ params }: { params: Params }) {
  await connection();

  const session = await requireRole(["ADMIN", "REP", "SELLER"]);
  const isAdmin = session.role === "ADMIN";

  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) notFound();

  // المندوب/البائع يفتح تقاريره بس
  const report = await prisma.shiftReport.findFirst({
    where: { id: reportId, ...(isAdmin ? {} : { userId: session.userId }) },
    include: { user: { select: { name: true } } },
  });
  if (!report) notFound();

  // فواتير نفس الشخص خلال فترة التقرير
  const invoices = await prisma.invoice.findMany({
    where: {
      userId: report.userId,
      date: { gte: report.periodStart, lte: report.closedAt },
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      date: true,
      total: true,
      paidAmount: true,
      paymentType: true,
      customer: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  const diffTone =
    report.difference === null || Math.abs(report.difference) < 0.005
      ? "text-gray-900"
      : report.difference < 0
      ? "text-red-600"
      : "text-amber-700";

  return (
    <div className="space-y-6">
      <section className={ui.card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{report.user.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              من {formatDateTime(report.periodStart)}
              {" "}إلى {formatDateTime(report.closedAt)}
            </p>
          </div>
          <DifferenceBadge
            counted={report.countedCash}
            difference={report.difference}
          />
        </div>

        {report.note && (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <span className="font-semibold">ملاحظة: </span>
            {report.note}
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي المبيعات" value={fmt(report.totalSales)} />
        <Stat label="عدد الفواتير" value={fmt(report.invoiceCount)} />
        <Stat
          label="المبيعات الآجلة"
          value={fmt(report.creditAmount)}
          tone={report.creditAmount > 0 ? "text-amber-700" : "text-gray-900"}
        />
        <Stat
          label="النقدية المعدودة"
          value={report.countedCash === null ? "—" : fmt(report.countedCash)}
        />
        <Stat
          label="الفرق"
          value={report.difference === null ? "—" : fmt(report.difference)}
          tone={diffTone}
        />
      </section>

      <section className={ui.tableCard}>
        <div className="border-b px-4 py-3 font-semibold text-gray-800">
          فواتير الوردية ({invoices.length})
        </div>

        {invoices.length === 0 ? (
          <p className={ui.empty}>لا توجد فواتير في فترة هذا التقرير</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {invoices.map((inv) => {
              const remaining = Math.max(0, inv.total - inv.paidAmount);
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900">فاتورة #{inv.id}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        {paymentLabel(inv.paymentType)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {inv.customer ? (
                        <Link
                          href={`/customers/${inv.customer.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {inv.customer.name}
                        </Link>
                      ) : (
                        "بدون عميل"
                      )}
                      {" · "}
                      {formatDateTime(inv.date)}
                      {" · "}
                      {inv._count.items} أصناف
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-end">
                      <p className="font-extrabold text-gray-900">{fmt(inv.total)}</p>
                      {remaining > 0 && (
                        <p className="text-xs text-red-600">متبقي: {fmt(remaining)}</p>
                      )}
                    </div>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      فتح
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ShiftReportDetailsPage({ params }: { params: Params }) {
  return (
    <main dir="rtl" className={ui.page}>
      <header className="mb-6">
        <Link
          href="/shift-reports"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          كل التقارير
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-900">تفاصيل التقرير</h1>
      </header>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-gray-100" />}>
        <ReportContent params={params} />
      </Suspense>
    </main>
  );
}