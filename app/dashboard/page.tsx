import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  CalendarDays,
  Clock,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import ExpenseSummary from "./ExpenseSummary";
import ProfitCard from "./ProfitCard";
import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/auth";
import ShiftAlerts from "./ShiftAlerts";
import { ui } from "../../lib/ui";

const DAY = 24 * 60 * 60 * 1000;
const OFFSET = 3 * 60 * 60 * 1000; // توقيت السعودية UTC+3

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function dayStart(date: Date) {
  const s = new Date(date.getTime() + OFFSET);
  s.setUTCHours(0, 0, 0, 0);
  return new Date(s.getTime() - OFFSET);
}

function monthStart(date: Date) {
  const s = new Date(date.getTime() + OFFSET);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - OFFSET);
}

const dayKey = (date: Date) =>
  new Date(date.getTime() + OFFSET).toISOString().slice(0, 10);

type Tone = "blue" | "amber" | "green" | "red";

const tones: Record<Tone, { icon: string; value: string }> = {
  blue: { icon: "bg-blue-50 text-blue-700", value: "text-gray-900" },
  green: { icon: "bg-emerald-50 text-emerald-700", value: "text-gray-900" },
  amber: { icon: "bg-amber-50 text-amber-700", value: "text-amber-700" },
  red: { icon: "bg-red-50 text-red-700", value: "text-red-600" },
};

function StatCard({
  label,
  value,
  sub,
  Icon,
  tone,
  alert = false,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: LucideIcon;
  tone: Tone;
  alert?: boolean;
}) {
  return (
    <div className="h-full min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
          <p
            className={`mt-2 break-words text-xl font-extrabold tracking-tight sm:text-3xl ${
              alert ? tones[tone].value : "text-gray-900"
            }`}
          >
            {value}
          </p>
          {sub && <p className="mt-1 text-[11px] leading-5 text-gray-400 sm:text-xs">{sub}</p>}
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${tones[tone].icon}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function ListCard({
  title,
  empty,
  children,
  hasItems,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
  hasItems: boolean;
}) {
  return (
    <div className={`${ui.tableCard} h-full`}>
      <div className="border-b px-3 py-3 text-sm font-semibold text-gray-800 sm:px-4 sm:text-base">{title}</div>
      {hasItems ? (
        <ul className="divide-y">{children}</ul>
      ) : (
        <p className={ui.empty}>{empty}</p>
      )}
    </div>
  );
}

/* ---------- تقارير الورديات (للأدمن) ---------- */
async function loadShiftReports(month: Date) {
  const mismatch = [
    { difference: { lt: -0.005 } },
    { difference: { gt: 0.005 } },
  ];

  const [recent, monthAgg, mismatches] = await Promise.all([
    prisma.shiftReport.findMany({
      orderBy: { closedAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
    prisma.shiftReport.aggregate({
      where: { closedAt: { gte: month } },
      _sum: { difference: true },
      _count: true,
    }),
    prisma.shiftReport.count({
      where: { closedAt: { gte: month }, OR: mismatch },
    }),
  ]);

  return {
    recent,
    monthCount: monthAgg._count,
    netDifference: Math.round((monthAgg._sum.difference ?? 0) * 100) / 100,
    mismatches,
  };
}

type ShiftData = Awaited<ReturnType<typeof loadShiftReports>>;

const shiftDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function DifferenceBadge({
  counted,
  difference,
}: {
  counted: number | null;
  difference: number | null;
}) {
  if (counted === null || difference === null) {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        بدون عدّ
      </span>
    );
  }
  if (Math.abs(difference) < 0.005) {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
        مطابق
      </span>
    );
  }
  if (difference < 0) {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
        عجز {fmt(Math.abs(difference))}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
      زيادة {fmt(difference)}
    </span>
  );
}

function ShiftReportsCard({ data }: { data: ShiftData }) {
  const netTone =
    data.netDifference < 0
      ? "text-red-600"
      : data.netDifference > 0
      ? "text-amber-700"
      : "text-gray-900";

  return (
    <section className={`${ui.tableCard} min-w-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-semibold text-gray-800">آخر تقارير الورديات</h2>
        <Link
          href="/shift-reports"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          عرض الكل
        </Link>
      </div>

      <dl className="grid grid-cols-3 gap-px border-b bg-gray-200 text-center">
        <div className="min-w-0 bg-white p-2 sm:p-3">
          <dt className="text-[10px] leading-4 text-gray-500 sm:text-xs">ورديات هذا الشهر</dt>
          <dd className="mt-1 break-words text-sm font-bold text-gray-900 sm:text-base">{data.monthCount}</dd>
        </div>
        <div className="min-w-0 bg-white p-2 sm:p-3">
          <dt className="text-[10px] leading-4 text-gray-500 sm:text-xs">ورديات بها فرق</dt>
          <dd
            className={`mt-1 break-words text-sm font-bold sm:text-base ${
              data.mismatches > 0 ? "text-amber-700" : "text-gray-900"
            }`}
          >
            {data.mismatches}
          </dd>
        </div>
        <div className="min-w-0 bg-white p-2 sm:p-3">
          <dt className="text-[10px] leading-4 text-gray-500 sm:text-xs">صافي الفروق</dt>
          <dd className={`mt-1 break-words text-sm font-bold sm:text-base ${netTone}`} dir="ltr">
            {fmt(data.netDifference)}
          </dd>
        </div>
      </dl>

      {data.recent.length === 0 ? (
        <p className={ui.empty}>لا توجد تقارير ورديات بعد</p>
      ) : (
        <ul className="divide-y">
          {data.recent.map((r) => (
            <li
              key={r.id}
              className="flex min-w-0 flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{r.user.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  <span dir="ltr">{shiftDate.format(r.closedAt)}</span>
                  {" · "}
                  {r.invoiceCount} فاتورة
                  {r.creditAmount > 0 && ` · آجل ${fmt(r.creditAmount)}`}
                </p>
                {r.note && (
                  <p className="mt-1 max-w-full truncate text-xs text-gray-400 sm:max-w-xs">
                    {r.note}
                  </p>
                )}
              </div>

              <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
                <div className="text-end">
                  <p className="text-xs text-gray-400">المبيعات</p>
                  <p className="font-semibold text-gray-900">{fmt(r.totalSales)}</p>
                </div>
                <DifferenceBadge
                  counted={r.countedCash}
                  difference={r.difference}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function DashboardContent() {
  await connection();
  const session = await getSession();
  await requireRole(["ADMIN", "EMPLOYEE"]);

  const now = new Date();
  const today = dayStart(now);
  const month = monthStart(now);
  const weekStart = new Date(today.getTime() - 6 * DAY);

  const [
    todayAgg,
    monthAgg,
    pendingOrders,
    products,
    weekInvoices,
    topItems,
    byUser,
    dueInvoices,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { date: { gte: today } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { date: { gte: month } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.findMany({
      select: { id: true, name: true, stock: true, lowStockAt: true },
      orderBy: { stock: "asc" },
    }),
    prisma.invoice.findMany({
      where: { date: { gte: weekStart } },
      select: { date: true, total: true },
    }),
    prisma.invoiceItem.groupBy({
      by: ["productId"],
      where: { invoice: { date: { gte: month } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.invoice.groupBy({
      by: ["userId"],
      where: { date: { gte: month } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { paymentType: { not: "CASH" } },
      select: { customerId: true, total: true, paidAmount: true },
    }),
  ]);

  // تقارير الورديات: للأدمن فقط
  const shiftData =
    session?.role === "ADMIN" ? await loadShiftReports(month) : null;

  // المستحق: بس الفواتير الآجلة ونصف الآجلة، وكل فاتورة بمتبقيها (مش أقل من صفر)
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const dueByCustomer = new Map<number, number>();
  let totalDue = 0;
  for (const inv of dueInvoices) {
    const remaining = round2(Math.max(0, inv.total - inv.paidAmount));
    if (remaining <= 0) continue;
    totalDue += remaining;
    if (inv.customerId !== null) {
      dueByCustomer.set(
        inv.customerId,
        (dueByCustomer.get(inv.customerId) ?? 0) + remaining
      );
    }
  }
  totalDue = round2(totalDue);

  // أكتر العملاء عليهم مستحقات
  const debtors = [...dueByCustomer]
    .map(([customerId, due]) => ({ customerId, due: round2(due) }))
    .sort((a, b) => b.due - a.due)
    .slice(0, 5);

  const [topProducts, users, debtorCustomers] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: topItems.map((t) => t.productId) } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { id: { in: byUser.map((u) => u.userId) } },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { id: { in: debtors.map((d) => d.customerId) } },
      select: { id: true, name: true },
    }),
  ]);
  const productName = new Map(topProducts.map((p) => [p.id, p.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const customerName = new Map(debtorCustomers.map((c) => [c.id, c.name]));

  // آخر 7 أيام
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * DAY);
    return {
      key: dayKey(d),
      label: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Asia/Riyadh",
      }).format(d),
      total: 0,
    };
  });
  for (const inv of weekInvoices) {
    const day = days.find((d) => d.key === dayKey(inv.date));
    if (day) day.total += inv.total;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  const low = products.filter((p) => p.stock <= p.lowStockAt);

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      {session?.role === "ADMIN" && (
        <div className="w-full min-w-0">
          <ShiftAlerts />
        </div>
      )}

      {/* المبيعات والتحصيل */}
      <section className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="مبيعات اليوم"
          value={fmt(todayAgg._sum.total ?? 0)}
          sub={`${todayAgg._count} فاتورة · محصّل ${fmt(todayAgg._sum.paidAmount ?? 0)}`}
          Icon={TrendingUp}
          tone="blue"
        />
        <StatCard
          label="مبيعات الشهر"
          value={fmt(monthAgg._sum.total ?? 0)}
          sub={`${monthAgg._count} فاتورة · محصّل ${fmt(monthAgg._sum.paidAmount ?? 0)}`}
          Icon={CalendarDays}
          tone="green"
        />
        <Link
          href="/collections"
          className="block h-full rounded-xl transition hover:-translate-y-0.5"
        >
          <StatCard
            label="مستحق للتحصيل"
            value={fmt(totalDue)}
            sub={totalDue > 0 ? "إجمالي المتبقي على العملاء" : "لا توجد مبالغ مستحقة"}
            Icon={Wallet}
            tone="amber"
            alert={totalDue > 0}
          />
        </Link>
      </section>

      {/* أرباح الشهر (للأدمن) */}
      {session?.role === "ADMIN" && (
        <Suspense
          fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}
        >
          <ProfitCard />
        </Suspense>
      )}

      {/* تحتاج انتباه */}
      <section className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Link
          href="/orders"
          className="block h-full rounded-xl transition hover:-translate-y-0.5"
        >
          <StatCard
            label="طلبات بانتظار الموافقة"
            value={String(pendingOrders)}
            sub="اضغط للمراجعة"
            Icon={Clock}
            tone="amber"
            alert={pendingOrders > 0}
          />
        </Link>
        <Link
          href="/products"
          className="block h-full rounded-xl transition hover:-translate-y-0.5"
        >
          <StatCard
            label="منتجات قاربت على النفاد"
            value={String(low.length)}
            sub="اضغط لعرض المنتجات"
            Icon={Package}
            tone="red"
            alert={low.length > 0}
          />
        </Link>
      </section>

      {/* تقارير الورديات (للأدمن) */}
      {shiftData && <ShiftReportsCard data={shiftData} />}

      {/* مصروفات الشهر (للأدمن) */}
      {session?.role === "ADMIN" && <ExpenseSummary />}

      {/* مبيعات آخر 7 أيام */}
      <section className={`${ui.card} min-w-0 overflow-hidden p-3 sm:p-5`}>
        <h2 className="mb-4 text-sm font-semibold text-gray-800 sm:text-base">مبيعات آخر 7 أيام</h2>
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="min-w-[520px] sm:min-w-0">
            <div className="flex h-36 items-end gap-2 sm:h-44 sm:gap-3">
              {days.map((d) => (
                <div
                  key={d.key}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="max-w-full truncate text-[10px] text-gray-500">
                    {d.total > 0 ? fmt(d.total) : ""}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-blue-500"
                    style={{
                      height: `${Math.max((d.total / maxDay) * 85, d.total > 0 ? 4 : 1)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {days.map((d) => (
                <span key={d.key} className="min-w-0 flex-1 text-center text-[11px] text-gray-500 sm:text-xs">
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* المنتجات */}
      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <ListCard
          title="أكتر المنتجات مبيعاً هذا الشهر"
          empty="مفيش مبيعات هذا الشهر"
          hasItems={topItems.length > 0}
        >
          {topItems.map((t, i) => (
            <li key={t.productId} className="flex min-w-0 items-start justify-between gap-3 px-3 py-3 text-sm sm:px-4">
              <span className="min-w-0 flex-1 break-words">
                {i + 1}. {productName.get(t.productId) ?? "منتج محذوف"}
              </span>
              <span className="shrink-0 font-semibold">{t._sum.quantity ?? 0}</span>
            </li>
          ))}
        </ListCard>

        <ListCard
          title="تنبيه المخزون"
          empty="كل المنتجات كميتها كويسة"
          hasItems={low.length > 0}
        >
          {low.slice(0, 8).map((p) => (
            <li key={p.id} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 text-sm sm:px-4">
              <span className="min-w-0 flex-1 break-words">{p.name}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  p.stock === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {p.stock === 0 ? "نفد" : `باقي ${p.stock}`}
              </span>
            </li>
          ))}
        </ListCard>
      </section>

      {/* العملاء والموظفين */}
      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <ListCard
          title="عملاء عليهم مستحقات"
          empty="مفيش مستحقات على العملاء"
          hasItems={debtors.length > 0}
        >
          {debtors.map((d) => (
            <li key={d.customerId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm sm:px-4">
              <Link
                href={`/customers/${d.customerId}`}
                className="min-w-0 flex-1 break-words font-medium text-blue-600 hover:underline"
              >
                {customerName.get(d.customerId) ?? "عميل محذوف"}
              </Link>
              <span className="shrink-0 font-semibold text-red-600" dir="ltr">{fmt(d.due)}</span>
            </li>
          ))}
        </ListCard>

        <ListCard
          title="مبيعات كل موظف هذا الشهر"
          empty="مفيش مبيعات هذا الشهر"
          hasItems={byUser.length > 0}
        >
          {byUser.map((u) => (
            <li key={u.userId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm sm:px-4">
              <span className="inline-flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                {userName.get(u.userId) ?? "مستخدم محذوف"}
                <span className="text-xs text-gray-400">({u._count} فاتورة)</span>
              </span>
              <span className="shrink-0 font-semibold" dir="ltr">{fmt(u._sum.total ?? 0)}</span>
            </li>
          ))}
        </ListCard>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main dir="rtl" className={`${ui.page} w-full min-w-0 max-w-full overflow-x-clip`}>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">الرئيسية</h1>
        <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">ملخص المبيعات والتحصيل والمخزون</p>
      </div>

      <Suspense
        fallback={
          <div className="w-full min-w-0 space-y-4 sm:space-y-6" aria-busy="true">
            <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}