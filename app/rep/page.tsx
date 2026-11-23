
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Wallet,
  FileText,
  Package,
  User,
  Inbox,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";
import RepForm from "./RepForm";
import DailyReportForm from "./DailyReportForm";
import NewCustomerButton from "./NewCustomerButton";
import { computeRepDaily, dayStart } from "../../lib/rep-report";

const ORDERS_LIMIT = 20;

const STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

type Status = (typeof STATUSES)[number];

const statusStyle: Record<
  Status,
  {
    label: string;
    className: string;
    Icon: LucideIcon;
  }
> = {
  PENDING: {
    label: "بانتظار الموافقة",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    Icon: Clock,
  },
  APPROVED: {
    label: "تمت الموافقة",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: "مرفوض",
    className: "bg-red-50 text-red-700 ring-red-200",
    Icon: XCircle,
  },
};

const tabs: {
  value: Status | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "الكل" },
  { value: "PENDING", label: "بانتظار الموافقة" },
  { value: "APPROVED", label: "مقبولة" },
  { value: "REJECTED", label: "مرفوضة" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date) {
  return date.toLocaleString("ar-EG-u-nu-latn", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paymentLabel(type: string) {
  if (type === "CASH") return "كاش";
  if (type === "HALF_CREDIT") return "نصف كاش / نصف آجل";
  if (type === "CREDIT") return "آجل";
  return type;
}

// ==========================================
// STATUS BADGE
// ==========================================

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const {
    label,
    className,
    Icon,
  } = statusStyle[status as Status] ?? statusStyle.PENDING;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset sm:text-xs ${className}`}
    >
      <Icon
        className="h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

// ==========================================
// STATISTICS CARD
// ==========================================

function StatCard({
  label,
  value,
  description,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  Icon: LucideIcon;
  tone: "blue" | "amber" | "green" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="flex min-w-0 items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:gap-3 sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-5 text-gray-500 sm:text-sm">
          {label}
        </p>

        <p className="mt-2 break-all text-xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
          {value}
        </p>

        <p className="mt-1 break-words text-[10px] leading-4 text-gray-400 sm:text-xs sm:leading-5">
          {description}
        </p>
      </div>

      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tones[tone]}`}
      >
        <Icon
          className="h-4 w-4 sm:h-5 sm:w-5"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}

// ==========================================
// HEADER ACTIONS
// ==========================================

async function HeaderActions() {
  await connection();

  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
      <Link
        href="/shift-reports"
        className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2.5 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 sm:px-4 sm:text-sm"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">تقارير الورديات</span>
      </Link>

      <Link
        href="/collections"
        className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2.5 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 sm:px-4 sm:text-sm"
      >
        <Wallet className="h-4 w-4 shrink-0" />
        <span className="truncate">التحصيلات</span>
      </Link>

      {isAdmin && (
        <Link
          href="/orders"
          className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 sm:col-span-1 sm:px-4 sm:text-sm"
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          إدارة الطلبات
        </Link>
      )}
    </div>
  );
}

// ==========================================
// REP CONTENT
// ==========================================

async function RepContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();

  const session = await requireRole(["REP", "ADMIN"]);
  const { status } = await searchParams;
  const isAdmin = session.role === "ADMIN";

  const filter = STATUSES.find((s) => s === status);

  const orderWhere = isAdmin
    ? {}
    : { repId: session.userId };

  const invoiceWhere = isAdmin
    ? {}
    : {
        OR: [
          { userId: session.userId },
          { order: { repId: session.userId } },
        ],
      };

  const [
    products,
    customers,
    orders,
    grouped,
    invoices,
    invoiceTotals,
    dailySummary,
    sentReport,
  ] = await Promise.all([
    isAdmin
      ? Promise.resolve([])
      : prisma.product.findMany({
          where: { stock: { gt: 0 } },
          orderBy: { name: "asc" },
        }),

    isAdmin
      ? Promise.resolve([])
      : prisma.customer.findMany({
          orderBy: { name: "asc" },
        }),

    prisma.order.findMany({
      where: {
        ...orderWhere,
        ...(filter ? { status: filter } : {}),
      },
      orderBy: { id: "desc" },
      take: ORDERS_LIMIT,
      include: {
        customer: true,
        rep: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),

    prisma.order.groupBy({
      by: ["status"],
      where: orderWhere,
      _count: true,
    }),

    prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: { id: "desc" },
      take: ORDERS_LIMIT,
      select: {
        id: true,
        date: true,
        total: true,
        paidAmount: true,
        paymentType: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),

    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: {
        total: true,
        paidAmount: true,
      },
      _count: { id: true },
    }),

    // تقرير نهاية اليوم للمندوب
    isAdmin
      ? Promise.resolve(null)
      : computeRepDaily(session.userId),

    isAdmin
      ? Promise.resolve(null)
      : prisma.shiftReport.findFirst({
          where: {
            userId: session.userId,
            periodStart: dayStart(new Date()),
          },
          select: {
            id: true,
            closedAt: true,
          },
        }),
  ]);

  const counts: Record<string, number> = {
    ALL: 0,
  };

  for (const group of grouped) {
    counts[group.status] = group._count;
    counts.ALL += group._count;
  }

  const salesTotal = invoiceTotals._sum.total ?? 0;

  const dueAmount = Math.max(
    0,
    salesTotal - (invoiceTotals._sum.paidAmount ?? 0)
  );

  const shownTotal = counts[filter ?? "ALL"] ?? 0;

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">

      {/* ================================== */}
      {/* REP TRANSACTION FORM / ADMIN INFO */}
      {/* ================================== */}

      {!isAdmin ? (
        <section
          id="new-transaction"
          className="min-w-0 scroll-mt-6"
        >
          <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-gray-900">
                عملية جديدة
              </h2>

              <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                سجّل عملية بيع مباشرة، وسيتم إصدار الفاتورة وخصم المخزون بعد التأكيد.
              </p>
            </div>

            <div className="shrink-0">
              <NewCustomerButton />
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
            <RepForm
              products={products.map(
                ({ id, name, price, stock }) => ({
                  id,
                  name,
                  price,
                  stock,
                })
              )}
              customers={customers.map(({ id, name }) => ({
                id,
                name,
              }))}
            />
          </div>
        </section>
      ) : (
        <section className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm sm:h-11 sm:w-11">
                <Users className="h-5 w-5" />
              </span>

              <div className="min-w-0">
                <h2 className="font-extrabold text-gray-900">
                  متابعة نشاط المندوبين
                </h2>

                <p className="mt-1 text-xs leading-6 text-gray-600 sm:text-sm">
                  من هنا تقدر تتابع طلبات كل المندوبين وحالاتها. هذه الصفحة للمتابعة فقط، ولا تحتوي على نموذج إنشاء فاتورة أو بيع مباشر للمدير.
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Link
                href="/shift-reports"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 sm:px-4 sm:text-sm"
              >
                <FileText className="h-4 w-4" />
                تقارير الورديات
              </Link>

              <Link
                href="/orders"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 sm:px-4 sm:text-sm"
              >
                <ClipboardList className="h-4 w-4" />
                إدارة الطلبات
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================================== */}
      {/* STATISTICS */}
      {/* ================================== */}

      <section className="min-w-0">
        <div className="mb-3">
          <h2 className="text-lg font-extrabold text-gray-900">
            {isAdmin
              ? "ملخص أداء المندوبين"
              : "ملخص نشاطي"}
          </h2>

          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            {isAdmin
              ? "نظرة عامة على الطلبات المسجلة من جميع المندوبين"
              : "نظرة عامة على مبيعاتك وفواتيرك والمبالغ المستحقة"}
          </p>
        </div>

        {isAdmin ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="إجمالي الطلبات"
              value={formatNumber(counts.ALL)}
              description="طلبات جميع المندوبين"
              Icon={ClipboardList}
              tone="blue"
            />

            <StatCard
              label="بانتظار الموافقة"
              value={formatNumber(counts.PENDING ?? 0)}
              description="تحتاج إلى مراجعة"
              Icon={Clock}
              tone="amber"
            />

            <StatCard
              label="طلبات مقبولة"
              value={formatNumber(counts.APPROVED ?? 0)}
              description="تم اعتمادها"
              Icon={CheckCircle2}
              tone="green"
            />

            <StatCard
              label="طلبات مرفوضة"
              value={formatNumber(counts.REJECTED ?? 0)}
              description="لم تتم الموافقة عليها"
              Icon={XCircle}
              tone="red"
            />
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="فواتيري"
              value={formatNumber(invoiceTotals._count.id)}
              description="إجمالي الفواتير المسجلة باسمك أو المرتبطة بطلباتك"
              Icon={FileText}
              tone="blue"
            />

            <StatCard
              label="إجمالي المبيعات"
              value={formatMoney(salesTotal)}
              description="إجمالي كل فواتيرك"
              Icon={Package}
              tone="green"
            />

            <Link
              href="/collections"
              className="block min-w-0 rounded-xl transition hover:-translate-y-0.5"
            >
              <StatCard
                label="مستحق للتحصيل"
                value={formatMoney(dueAmount)}
                description="إجمالي المبالغ المتبقية على فواتيرك"
                Icon={Wallet}
                tone="amber"
              />
            </Link>
          </div>
        )}
      </section>

      {/* ================================== */}
      {/* DIRECT INVOICES */}
      {/* ================================== */}

      <section className="min-w-0">
        <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-gray-900">
              {isAdmin
                ? "آخر فواتير المبيعات"
                : "آخر مبيعاتي المباشرة"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
              {isAdmin
                ? "متابعة الفواتير التي أصدرها المستخدمون والمندوبون"
                : "الفواتير التي أصدرتها من البيع المباشر، بالإضافة إلى فواتير طلباتك المعتمدة"}
            </p>
          </div>

          <Link
            href="/invoices"
            className="shrink-0 text-xs font-bold text-blue-600 hover:underline sm:text-sm"
          >
            عرض صفحة الفواتير
          </Link>
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {invoices.length === 0 ? (
            <div className="px-4 py-10 text-center sm:px-5 sm:py-12">
              <FileText
                className="mx-auto mb-3 h-9 w-9 text-gray-300"
                aria-hidden="true"
              />

              <p className="font-bold text-gray-800">
                لا توجد فواتير مسجلة حتى الآن
              </p>

              {!isAdmin && (
                <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                  بعد تأكيد أول عملية بيع هتظهر الفاتورة هنا.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {invoices.map((invoice) => {
                const remaining = Math.max(
                  0,
                  invoice.total - invoice.paidAmount
                );

                return (
                  <li
                    key={invoice.id}
                    className="flex min-w-0 flex-col gap-3 p-3.5 transition hover:bg-gray-50/70 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-gray-900">
                          فاتورة #{invoice.id}
                        </span>

                        <span className="max-w-full rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700 sm:text-xs">
                          {paymentLabel(invoice.paymentType)}
                        </span>
                      </div>

                      <p className="mt-1.5 break-words text-sm text-gray-700">
                        {invoice.customer ? (
                          <Link
                            href={`/customers/${invoice.customer.id}`}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            {invoice.customer.name}
                          </Link>
                        ) : (
                          "بدون عميل"
                        )}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 sm:gap-x-4 sm:text-xs">
                        <span>{formatDate(invoice.date)}</span>

                        <span>
                          {formatNumber(invoice._count.items)} أصناف
                        </span>

                        {isAdmin && (
                          <span>
                            المستخدم: {invoice.user.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
                      <div className="min-w-0">
                        <p
                          className="break-all text-base font-extrabold text-gray-900 sm:text-sm"
                          dir="ltr"
                        >
                          {formatMoney(invoice.total)}
                        </p>

                        <p className="mt-1 text-[11px] text-emerald-700 sm:text-xs">
                          مدفوع: {formatMoney(invoice.paidAmount)}
                        </p>

                        {remaining > 0 && (
                          <p className="mt-1 text-[11px] text-red-600 sm:text-xs">
                            متبقي: {formatMoney(remaining)}
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        فتح الفاتورة
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ================================== */}
      {/* DAILY REPORT - REP ONLY */}
      {/* ================================== */}

      {!isAdmin && dailySummary && (
        <section
          id="close-shift"
          className="min-w-0 scroll-mt-6"
        >
          <DailyReportForm
            summary={{
              invoiceCount: dailySummary.invoiceCount,
              totalSales: dailySummary.totalSales,
              collected: dailySummary.collected,
              creditToday: dailySummary.creditToday,
              outstanding: dailySummary.outstanding,
            }}
            sentAt={
              sentReport
                ? sentReport.closedAt.toISOString()
                : null
            }
          />
        </section>
      )}

      {/* ================================== */}
      {/* ORDERS */}
      {/* ================================== */}

      <section className="min-w-0">
        <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-gray-900">
              {isAdmin
                ? "طلبات جميع المندوبين"
                : "طلباتي السابقة"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
              {isAdmin
                ? "تابع حالة الطلب واسم المندوب والعميل"
                : "متابعة الطلبات التي سجلتها من مسار الطلبات؛ البيع المباشر يظهر في سجل الفواتير أعلاه"}
            </p>
          </div>

          {shownTotal > ORDERS_LIMIT && (
            <span className="shrink-0 text-[11px] text-gray-500 sm:text-xs">
              آخر {ORDERS_LIMIT} من {formatNumber(shownTotal)} طلب
            </span>
          )}
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {/* Order filters */}
          <nav
            aria-label="تصفية الطلبات"
            className="flex max-w-full overflow-x-auto border-b border-gray-200 px-2"
          >
            {tabs.map((tab) => {
              const active = (filter ?? "ALL") === tab.value;

              return (
                <Link
                  key={tab.value}
                  href={
                    tab.value === "ALL"
                      ? "/rep"
                      : `/rep?status=${tab.value}`
                  }
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-bold transition sm:px-4 sm:text-sm ${
                    active
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}

                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 sm:text-xs">
                    {formatNumber(counts[tab.value] ?? 0)}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Empty orders */}
          {orders.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5 sm:py-14">
              <Inbox
                className="mb-3 h-10 w-10 text-gray-300"
                aria-hidden="true"
              />

              <h3 className="font-bold text-gray-900">
                {filter
                  ? "لا توجد طلبات في هذه الحالة"
                  : "لا توجد طلبات بعد"}
              </h3>

              {!isAdmin && !filter && (
                <>
                  <p className="mt-1 max-w-md text-xs leading-6 text-gray-500 sm:text-sm">
                    ستظهر طلباتك هنا عند استخدام مسار الطلبات. أما البيع المباشر فستجده في سجل الفواتير أعلاه.
                  </p>

                  <Link
                    href="#new-transaction"
                    className="mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    بدء أول عملية بيع
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex min-w-0 flex-col gap-3 p-3.5 transition hover:bg-gray-50/70 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-gray-900">
                        طلب #{order.id}
                      </span>

                      <StatusBadge status={order.status} />
                    </div>

                    <p className="mt-1.5 break-words text-sm text-gray-800">
                      {order.customer ? (
                        <Link
                          href={`/customers/${order.customer.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {order.customer.name}
                        </Link>
                      ) : (
                        "بدون عميل"
                      )}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500 sm:gap-x-4 sm:text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Package
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {formatNumber(order._count.items)} أصناف
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <Clock
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {formatDate(order.createdAt)}
                      </span>

                      {isAdmin && (
                        <span className="inline-flex items-center gap-1">
                          <User
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          المندوب: {order.rep.name}
                        </span>
                      )}
                    </div>

                    {order.note && (
                      <p className="mt-2 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600 sm:text-sm">
                        <span className="font-semibold text-gray-700">
                          ملاحظة:{" "}
                        </span>
                        {order.note}
                      </p>
                    )}
                  </div>

                  {order.invoiceId && (
                    <Link
                      href={`/invoices/${order.invoiceId}`}
                      className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      فتح الفاتورة
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// ==========================================
// REP PAGE
// ==========================================

export default function RepPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <main
      dir="rtl"
      className={`${ui.page} w-full min-w-0 max-w-none space-y-5 sm:space-y-7`}
    >
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
            المبيعات والطلبات
          </h1>

          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            متابعة الطلبات والتحصيلات حسب صلاحية الحساب.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-11 w-full animate-pulse rounded-xl bg-gray-100 sm:w-72" />
          }
        >
          <HeaderActions />
        </Suspense>
      </header>

      <Suspense
        fallback={
          <div className="min-w-0 space-y-5" aria-busy="true">
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            </div>

            <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <RepContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
