
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  CalendarDays,
  Wallet,
  ClipboardList,
} from "lucide-react";

import { prisma } from "../../lib/prisma";
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";
import {
  DifferenceBadge,
  fmt,
  formatDateTime,
} from "./shared";

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  page?: string;
  filter?: string;
}>;

function buildHref(page: number, onlyDiff: boolean) {
  const params = new URLSearchParams();

  if (onlyDiff) params.set("filter", "diff");
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();

  return qs ? `/shift-reports?${qs}` : "/shift-reports";
}

// ==========================================
// REPORT CARD
// ==========================================

function ReportCard({
  report,
  isAdmin,
}: {
  report: {
    id: number;
    closedAt: Date;
    invoiceCount: number;
    creditAmount: number;
    note: string | null;
    totalSales: number;
    countedCash: number;
    difference: number;
    user: { name: string };
  };
  isAdmin: boolean;
}) {
  return (
    <Link
      href={`/shift-reports/${report.id}`}
      className="group block min-w-0 p-3.5 transition hover:bg-gray-50/80 active:bg-gray-50 sm:p-5"
    >
      {/* Header */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <p className="break-words text-sm font-extrabold text-gray-900">
              {isAdmin ? report.user.name : `تقرير #${report.id}`}
            </p>

            {isAdmin && (
              <p className="mt-1 text-[11px] text-gray-400">
                تقرير رقم #{report.id}
              </p>
            )}
          </div>
        </div>

        <span className="shrink-0 text-xs font-semibold text-blue-600 transition group-hover:text-blue-700">
          عرض التقرير ←
        </span>
      </div>

      {/* Date and invoice count */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-gray-500 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {formatDateTime(report.closedAt)}
        </span>

        <span className="inline-flex items-center gap-1">
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          {fmt(report.invoiceCount)} فاتورة
        </span>

        {report.creditAmount > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            آجل {fmt(report.creditAmount)}
          </span>
        )}
      </div>

      {/* Financial summary */}
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium text-gray-500">
            المبيعات
          </p>

          <p
            className="mt-1 break-all text-base font-extrabold text-gray-900"
            dir="ltr"
          >
            {fmt(report.totalSales)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium text-gray-500">
            النقدية المعدودة
          </p>

          <p
            className="mt-1 break-all text-base font-extrabold text-gray-900"
            dir="ltr"
          >
            {fmt(report.countedCash)}
          </p>
        </div>
      </div>

      {/* Difference */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="text-xs font-semibold text-gray-600">
          فرق الدرج
        </span>

        <div className="shrink-0">
          <DifferenceBadge
            counted={report.countedCash}
            difference={report.difference}
          />
        </div>
      </div>

      {/* Note */}
      {report.note && (
        <p className="mt-3 break-words rounded-lg bg-amber-50/70 px-3 py-2 text-xs leading-5 text-gray-600">
          <span className="font-semibold text-gray-700">
            ملاحظة:{" "}
          </span>
          {report.note}
        </p>
      )}
    </Link>
  );
}

// ==========================================
// REPORT ROW - DESKTOP
// ==========================================

function ReportRow({
  report,
  isAdmin,
}: {
  report: {
    id: number;
    closedAt: Date;
    invoiceCount: number;
    creditAmount: number;
    note: string | null;
    totalSales: number;
    countedCash: number;
    difference: number;
    user: { name: string };
  };
  isAdmin: boolean;
}) {
  return (
    <li>
      <Link
        href={`/shift-reports/${report.id}`}
        className="group flex min-w-0 items-center gap-4 px-4 py-4 transition hover:bg-gray-50 sm:px-5"
      >
        {/* Employee / report */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gray-900">
              {isAdmin ? report.user.name : `تقرير #${report.id}`}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {formatDateTime(report.closedAt)}
              {" · "}
              {fmt(report.invoiceCount)} فاتورة
              {report.creditAmount > 0 &&
                ` · آجل ${fmt(report.creditAmount)}`}
            </p>

            {report.note && (
              <p className="mt-1 max-w-sm truncate text-xs text-gray-400">
                {report.note}
              </p>
            )}
          </div>
        </div>

        {/* Sales */}
        <div className="w-28 shrink-0 text-center">
          <p className="text-xs text-gray-400">المبيعات</p>

          <p
            className="mt-1 font-bold text-gray-900"
            dir="ltr"
          >
            {fmt(report.totalSales)}
          </p>
        </div>

        {/* Counted cash */}
        <div className="w-28 shrink-0 text-center">
          <p className="text-xs text-gray-400">
            النقدية المعدودة
          </p>

          <p
            className="mt-1 font-bold text-gray-900"
            dir="ltr"
          >
            {fmt(report.countedCash)}
          </p>
        </div>

        {/* Difference */}
        <div className="w-28 shrink-0 text-center">
          <p className="mb-1 text-xs text-gray-400">
            فرق الدرج
          </p>

          <DifferenceBadge
            counted={report.countedCash}
            difference={report.difference}
          />
        </div>

        <ChevronLeft className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:-translate-x-1 group-hover:text-blue-600" />
      </Link>
    </li>
  );
}

// ==========================================
// REPORTS CONTENT
// ==========================================

async function ReportsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();

  const session = await requireRole([
    "ADMIN",
    "REP",
    "SELLER",
  ]);

  const isAdmin = session.role === "ADMIN";

  const sp = await searchParams;

  const onlyDiff = sp.filter === "diff";

  const requestedPage = Math.max(
    1,
    parseInt(sp.page ?? "1", 10) || 1
  );

  // المدير يشوف كل التقارير،
  // والمندوب والبائع يشوفوا تقاريرهم فقط
  const where = {
    ...(isAdmin ? {} : { userId: session.userId }),

    ...(onlyDiff
      ? {
          OR: [
            { difference: { lt: -0.005 } },
            { difference: { gt: 0.005 } },
          ],
        }
      : {}),
  };

  const total = await prisma.shiftReport.count({
    where,
  });

  const pages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  const page = Math.min(requestedPage, pages);

  const reports = await prisma.shiftReport.findMany({
    where,
    orderBy: { closedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  const tabs = [
    { label: "الكل", diff: false },
    { label: "فيها فرق", diff: true },
  ];

  return (
    <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
      {/* Filters */}
      <nav
        aria-label="تصفية التقارير"
        className="flex min-w-0 items-center gap-2 border-b border-gray-200 px-2"
      >
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = onlyDiff === tab.diff;

            return (
              <Link
                key={tab.label}
                href={buildHref(1, tab.diff)}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-12 shrink-0 items-center border-b-2 px-4 text-xs font-bold transition sm:text-sm ${
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600 sm:text-xs">
          {fmt(total)} تقرير
        </span>
      </nav>

      {/* Empty state */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5 sm:py-14">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
            <FileText className="h-6 w-6" />
          </span>

          <p className="mt-3 text-sm font-bold text-gray-900">
            {onlyDiff
              ? "لا توجد تقارير بها فرق"
              : "لا توجد تقارير ورديات بعد"}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            ستظهر التقارير هنا بعد إغلاق الورديات.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile report cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isAdmin={isAdmin}
              />
            ))}
          </div>

          {/* Desktop report list */}
          <ul className="hidden divide-y divide-gray-100 md:block">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                isAdmin={isAdmin}
              />
            ))}
          </ul>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-3 py-3 sm:px-4">
          {page < pages ? (
            <Link
              href={buildHref(page + 1, onlyDiff)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-blue-600 transition hover:bg-blue-50 sm:text-sm"
            >
              <ChevronRight className="h-4 w-4" />
              الأقدم
            </Link>
          ) : (
            <span />
          )}

          <span className="text-[11px] font-medium text-gray-500 sm:text-xs">
            صفحة {page} من {pages}
          </span>

          {page > 1 ? (
            <Link
              href={buildHref(page - 1, onlyDiff)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-blue-600 transition hover:bg-blue-50 sm:text-sm"
            >
              الأحدث
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// SHIFT REPORTS PAGE
// ==========================================

export default function ShiftReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main
      dir="rtl"
      className={`${ui.page} min-w-0 space-y-5 sm:space-y-6`}
    >
      <header className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
              تقارير الورديات
            </h1>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
              كل التقارير المرسلة، واضغط على أي تقرير لعرض تفاصيله.
            </p>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div
            className="space-y-3"
            aria-busy="true"
          >
            <div className="h-12 animate-pulse rounded-xl bg-gray-100" />

            <div className="h-36 animate-pulse rounded-xl bg-gray-100" />

            <div className="h-36 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
