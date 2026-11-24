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
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";
import RepForm from "./RepForm";

const ORDERS_LIMIT = 20;
const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

const statusStyle: Record<
  Status,
  { label: string; className: string; Icon: LucideIcon }
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

const tabs: { value: Status | "ALL"; label: string }[] = [
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

function StatusBadge({ status }: { status: string }) {
  const { label, className, Icon } =
    statusStyle[status as Status] ?? statusStyle.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

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
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {value}
          </p>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

async function RepContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // Read session and database data only for the active request.
  await connection();

  const session = await requireRole(["REP", "ADMIN"]);
  const { status } = await searchParams;
  const isAdmin = session.role === "ADMIN";

  // اسم المستخدم الحالي لعرضه في نسخة فاتورة المندوب المطبوعة.
  const repName = isAdmin
    ? ""
    : (
        await prisma.user.findUnique({
          where: { id: session.userId },
          select: { name: true },
        })
      )?.name ?? "";

  const filter = STATUSES.find((s) => s === status);
  const orderWhere = isAdmin ? {} : { repId: session.userId };
  const invoiceWhere = isAdmin
    ? {}
    : {
        OR: [
          { userId: session.userId },
          { order: { repId: session.userId } },
        ],
      };

  const [products, customers, orders, grouped, invoices, invoiceTotals] = await Promise.all([
    isAdmin
      ? Promise.resolve([])
      : prisma.product.findMany({
          where: { stock: { gt: 0 } },
          orderBy: { name: "asc" },
        }),
    isAdmin
      ? Promise.resolve([])
      : prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { ...orderWhere, ...(filter ? { status: filter } : {}) },
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
        customer: { select: { id: true, name: true } },
        user: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: { total: true, paidAmount: true },
      _count: { id: true },
    }),
  ]);

  const counts: Record<string, number> = { ALL: 0 };
  for (const group of grouped) {
    counts[group.status] = group._count;
    counts.ALL += group._count;
  }

  const dueAmount = Math.max(
    0,
    (invoiceTotals._sum.total ?? 0) - (invoiceTotals._sum.paidAmount ?? 0)
  );
  const invoiceSalesTotal = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

  const shownTotal = counts[filter ?? "ALL"] ?? 0;

  function paymentLabel(type: string) {
    if (type === "CASH") return "كاش";
    if (type === "HALF_CREDIT") return "نصف كاش / نصف آجل";
    if (type === "CREDIT") return "آجل";
    return type;
  }

  return (
    <div className="w-full min-w-0 space-y-7 sm:space-y-8">
      {/* Rep-only transaction form. Admin cannot create an invoice or sale here. */}
      {!isAdmin ? (
        <section id="new-transaction" className="scroll-mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">عملية جديدة</h2>
              <p className="mt-1 text-sm text-gray-500">
                سجّل عملية بيع مباشرة، وسيتم إصدار الفاتورة وخصم المخزون بعد التأكيد.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <RepForm
              products={products.map(({ id, name, price, stock }) => ({
                id,
                name,
                price,
                stock,
              }))}
              customers={customers.map(({ id, name }) => ({ id, name }))}
              repName={repName}
            />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-gray-900">متابعة نشاط المندوبين</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                  من هنا تقدر تتابع طلبات كل المندوبين وحالاتها. هذه الصفحة للمتابعة فقط، ولا تحتوي على نموذج إنشاء فاتورة أو بيع مباشر للمدير.
                </p>
              </div>
            </div>
            <Link
              href="/orders"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              إدارة الطلبات
            </Link>
          </div>
        </section>
      )}

      {/* Statistics */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            {isAdmin ? "ملخص أداء المندوبين" : "ملخص نشاطي"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin
              ? "نظرة عامة على الطلبات المسجلة من جميع المندوبين"
              : "نظرة عامة على مبيعاتك وفواتيرك والمبالغ المستحقة"}
          </p>
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="فواتيري"
              value={formatNumber(invoiceTotals._count.id)}
              description="إجمالي الفواتير المسجلة باسمك أو المرتبطة بطلباتك"
              Icon={FileText}
              tone="blue"
            />
            <StatCard
              label="إجمالي المبيعات المعروضة"
              value={formatMoney(invoiceSalesTotal)}
              description="إجمالي آخر الفواتير الظاهرة في السجل"
              Icon={Package}
              tone="green"
            />
            <Link href="/collections" className="block rounded-xl transition hover:-translate-y-0.5">
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

      {/* Direct invoices activity */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isAdmin ? "آخر فواتير المبيعات" : "آخر مبيعاتي المباشرة"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin
                ? "متابعة الفواتير التي أصدرها المستخدمون والمندوبون"
                : "الفواتير التي أصدرتها من البيع المباشر، بالإضافة إلى فواتير طلباتك المعتمدة"}
            </p>
          </div>
          <Link
            href="/invoices"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            عرض صفحة الفواتير
          </Link>
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {invoices.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText className="mx-auto mb-3 h-9 w-9 text-gray-300" aria-hidden="true" />
              <p className="font-semibold text-gray-800">لا توجد فواتير مسجلة حتى الآن</p>
              {!isAdmin && (
                <p className="mt-1 text-sm text-gray-500">بعد تأكيد أول عملية بيع هتظهر الفاتورة هنا.</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {invoices.map((invoice) => {
                const remaining = Math.max(0, invoice.total - invoice.paidAmount);
                return (
                  <li key={invoice.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900">فاتورة #{invoice.id}</span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          {paymentLabel(invoice.paymentType)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-gray-700">
                        {invoice.customer ? (
                          <Link href={`/customers/${invoice.customer.id}`} className="font-semibold text-blue-600 hover:underline">
                            {invoice.customer.name}
                          </Link>
                        ) : "بدون عميل"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{formatDate(invoice.date)}</span>
                        <span>{formatNumber(invoice._count.items)} أصناف</span>
                        {isAdmin && <span>المستخدم: {invoice.user.name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
                      <div className="text-sm">
                        <p className="font-extrabold text-gray-900">{formatMoney(invoice.total)}</p>
                        <p className="mt-1 text-xs text-emerald-700">مدفوع: {formatMoney(invoice.paidAmount)}</p>
                        {remaining > 0 && <p className="mt-1 text-xs text-red-600">متبقي: {formatMoney(remaining)}</p>}
                      </div>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
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

      {/* Orders */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isAdmin ? "طلبات جميع المندوبين" : "طلباتي السابقة"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin
                ? "تابع حالة الطلب واسم المندوب والعميل"
                : "متابعة الطلبات التي سجلتها من مسار الطلبات؛ البيع المباشر يظهر في سجل الفواتير أعلاه"}
            </p>
          </div>
          {shownTotal > ORDERS_LIMIT && (
            <span className="text-xs text-gray-500">
              آخر {ORDERS_LIMIT} من {formatNumber(shownTotal)} طلب
            </span>
          )}
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <nav
            aria-label="تصفية الطلبات"
            className="flex max-w-full overflow-x-auto border-b border-gray-200 px-2"
          >
            {tabs.map((tab) => {
              const active = (filter ?? "ALL") === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={tab.value === "ALL" ? "/rep" : `/rep?status=${tab.value}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold sm:px-4 ${
                    active
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  <span className="mr-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {formatNumber(counts[tab.value] ?? 0)}
                  </span>
                </Link>
              );
            })}
          </nav>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <Inbox className="mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
              <h3 className="font-bold text-gray-900">
                {filter ? "لا توجد طلبات في هذه الحالة" : "لا توجد طلبات بعد"}
              </h3>
              {!isAdmin && !filter && (
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    ستظهر طلباتك هنا عند استخدام مسار الطلبات. أما البيع المباشر فستجده في سجل الفواتير أعلاه.
                  </p>
                  <Link
                    href="#new-transaction"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
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
                  className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900">طلب #{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>

                    <p className="mt-1.5 text-sm text-gray-800">
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

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatNumber(order._count.items)} أصناف
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(order.createdAt)}
                      </span>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" aria-hidden="true" />
                          المندوب: {order.rep.name}
                        </span>
                      )}
                    </div>

                    {order.note && (
                      <p className="mt-2 break-words text-sm text-gray-600">
                        <span className="font-semibold text-gray-700">ملاحظة: </span>
                        {order.note}
                      </p>
                    )}
                  </div>

                  {order.invoiceId && (
                    <Link
                      href={`/invoices/${order.invoiceId}`}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
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

export default function RepPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <main dir="rtl" className={`${ui.page} w-full min-w-0 max-w-none`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            المبيعات والطلبات
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            متابعة الطلبات والتحصيلات حسب صلاحية الحساب.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/collections"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            التحصيلات
          </Link>
          <Link
            href={"/orders"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            إدارة الطلبات
          </Link>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="space-y-6" aria-busy="true">
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <RepContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
