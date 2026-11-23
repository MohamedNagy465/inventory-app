
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Wallet,
  CreditCard,
  ShoppingBag,
  UserRound,
  Phone,
  CalendarDays,
  ClipboardList,
} from "lucide-react";

import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth";
import { ui } from "../../../lib/ui";

type PageProps = {
  params: Promise<{ id: string }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date) {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getPaymentStatus(total: number, paid: number) {
  const remaining = Math.round((total - paid) * 100) / 100;

  if (remaining <= 0.009) {
    return {
      label: "مدفوعة",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (paid > 0) {
    return {
      label: "مدفوعة جزئيًا",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "آجل",
    className: "bg-red-50 text-red-700",
  };
}

function paymentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CASH: "نقدي",
    CREDIT: "آجل",
    HALF_CREDIT: "نصف آجل",
  };

  return labels[type] ?? type;
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "بانتظار الموافقة",
    APPROVED: "مقبول",
    REJECTED: "مرفوض",
  };

  return labels[status] ?? status;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  color: "blue" | "green" | "red" | "amber";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };

  const valueColors = {
    blue: "text-gray-900",
    green: "text-emerald-700",
    red: "text-red-600",
    amber: "text-amber-700",
  };

  return (
    <div className="flex min-w-0 items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 lg:p-5">
      <div className="min-w-0">
        <p className="text-xs leading-5 text-gray-500 sm:text-sm">
          {label}
        </p>

        <p className={`mt-2 break-words text-lg font-extrabold tracking-tight sm:text-2xl ${valueColors[color]}`}>
          {value}
        </p>
      </div>

      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl ${colors[color]}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      </span>
    </div>
  );
}

async function CustomerContent({ params }: PageProps) {
  await connection();

  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    notFound();
  }

  await requireRole(["ADMIN", "EMPLOYEE", "SELLER"]);

  const [customer, invoiceSummary] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        invoices: {
          orderBy: { date: "desc" },
          take: 50,
          include: {
            user: { select: { name: true } },
            _count: { select: { items: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            rep: { select: { name: true } },
            invoice: { select: { id: true, total: true } },
          },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            rep: { select: { name: true } },
            invoice: { select: { id: true } },
            _count: { select: { items: true } },
          },
        },
      },
    }),

    prisma.invoice.aggregate({
      where: { customerId },
      _count: { _all: true },
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  if (!customer) notFound();

  const totalSales = invoiceSummary._sum.total ?? 0;
  const totalPaid = invoiceSummary._sum.paidAmount ?? 0;
  const totalRemaining = Math.max(0, totalSales - totalPaid);

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">

      {/* Customer header */}
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 sm:text-sm">
            <Link
              href="/customers"
              className="font-medium text-blue-600 hover:underline"
            >
              العملاء
            </Link>

            <span>/</span>
            <span>تفاصيل العميل</span>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-14 sm:w-14">
              <UserRound className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>

            <div className="min-w-0">
              <h1 className="break-words text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl lg:text-3xl">
                {customer.name}
              </h1>

              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-gray-500 sm:text-sm">
                <Phone className="h-3.5 w-3.5 shrink-0" />

                <span dir="ltr" className="break-all">
                  {customer.phone || "لا يوجد رقم هاتف مسجل"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/customers"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للعملاء
        </Link>
      </header>

      {/* Financial Summary */}
      <section className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        <SummaryCard
          label="عدد الفواتير"
          value={invoiceSummary._count._all.toLocaleString("en-US")}
          icon={FileText}
          color="blue"
        />

        <SummaryCard
          label="إجمالي المبيعات"
          value={money(totalSales)}
          icon={ShoppingBag}
          color="blue"
        />

        <SummaryCard
          label="إجمالي المدفوع"
          value={money(totalPaid)}
          icon={Wallet}
          color="green"
        />

        <SummaryCard
          label="المتبقي على العميل"
          value={money(totalRemaining)}
          icon={CreditCard}
          color="red"
        />
      </section>

      {/* Invoices */}
      <section className="min-w-0 space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
            <FileText className="h-5 w-5 text-blue-600" />
            فواتير العميل
          </h2>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            آخر 50 فاتورة مسجلة للعميل.
          </p>
        </div>

        <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
          {customer.invoices.length === 0 ? (
            <p className={ui.empty}>
              لا توجد فواتير لهذا العميل.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {customer.invoices.map((invoice) => {
                const status = getPaymentStatus(
                  invoice.total,
                  invoice.paidAmount
                );

                const remaining = Math.max(
                  0,
                  invoice.total - invoice.paidAmount
                );

                return (
                  <article
                    key={invoice.id}
                    className="min-w-0 p-3.5 transition hover:bg-gray-50/60 sm:p-5"
                  >
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-bold text-blue-700 hover:underline"
                      >
                        فاتورة #{invoice.id}
                      </Link>

                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-400 sm:text-xs">
                          التاريخ
                        </p>
                        <p className="mt-1 break-words text-xs text-gray-700 sm:text-sm">
                          {formatDate(invoice.date)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-400 sm:text-xs">
                          الإجمالي
                        </p>
                        <p className="mt-1 break-all text-sm font-semibold text-gray-900 sm:text-base">
                          {money(invoice.total)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-400 sm:text-xs">
                          المدفوع
                        </p>
                        <p className="mt-1 break-all text-sm font-semibold text-emerald-700 sm:text-base">
                          {money(invoice.paidAmount)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-400 sm:text-xs">
                          المتبقي
                        </p>
                        <p className="mt-1 break-all text-sm font-semibold text-red-600 sm:text-base">
                          {money(remaining)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-gray-100 pt-3 text-[11px] text-gray-500 sm:text-xs">
                      <span>
                        {invoice._count.items} أصناف
                      </span>

                      <span className="max-w-full break-words">
                        المسجل: {invoice.user.name}
                      </span>

                      <span>
                        {paymentTypeLabel(invoice.paymentType)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Payments */}
      <section className="min-w-0 space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
            <Wallet className="h-5 w-5 text-emerald-600" />
            سجل التحصيلات
          </h2>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            آخر 50 عملية تحصيل مسجلة على العميل.
          </p>
        </div>

        <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
          {customer.payments.length === 0 ? (
            <p className={ui.empty}>
              لا توجد تحصيلات مسجلة لهذا العميل.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {customer.payments.map((payment) => (
                <article
                  key={payment.id}
                  className="flex min-w-0 flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/invoices/${payment.invoice.id}`}
                      className="break-words text-sm font-bold text-blue-700 hover:underline"
                    >
                      تحصيل على فاتورة #{payment.invoice.id}
                    </Link>

                    <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 sm:text-xs">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(payment.createdAt)}
                      </span>

                      <span className="break-words">
                        المندوب: {payment.rep.name}
                      </span>
                    </div>

                    {payment.note && (
                      <p className="mt-2 break-words text-xs leading-5 text-gray-500">
                        {payment.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                    <span className="text-xs text-gray-400 sm:hidden">
                      مبلغ التحصيل
                    </span>

                    <p className="text-base font-extrabold text-emerald-700 sm:text-lg">
                      {money(payment.amount)}
                    </p>

                    <Link
                      href={`/invoices/${payment.invoice.id}`}
                      className="text-xs font-semibold text-blue-600 hover:underline sm:hidden"
                    >
                      فتح الفاتورة
                    </Link>
                  </div>

                  <Link
                    href={`/invoices/${payment.invoice.id}`}
                    className="hidden shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:inline-flex"
                  >
                    فتح الفاتورة
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Orders */}
      <section className="min-w-0 space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
            <ClipboardList className="h-5 w-5 text-violet-600" />
            طلبات العميل
          </h2>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            آخر 30 طلبًا مسجلًا لهذا العميل.
          </p>
        </div>

        <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
          {customer.orders.length === 0 ? (
            <p className={ui.empty}>
              لا توجد طلبات لهذا العميل.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {customer.orders.map((order) => (
                <article
                  key={order.id}
                  className="flex min-w-0 flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">
                      طلب #{order.id}
                    </p>

                    <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 sm:text-xs">
                      <span>
                        {formatDate(order.createdAt)}
                      </span>

                      <span>
                        {order._count.items} أصناف
                      </span>

                      <span className="break-words">
                        المندوب: {order.rep.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:shrink-0 sm:border-0 sm:pt-0">
                    <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      {orderStatusLabel(order.status)}
                    </span>

                    {order.invoice && (
                      <Link
                        href={`/invoices/${order.invoice.id}`}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        عرض الفاتورة
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

export default function CustomerDetailsPage({
  params,
}: PageProps) {
  return (
    <main
      dir="rtl"
      className={`${ui.page} w-full min-w-0 max-w-full space-y-5 sm:space-y-6`}
    >
      <Suspense
        fallback={
          <div className="min-w-0 space-y-4" aria-busy="true">
            <div className="h-24 animate-pulse rounded-xl bg-gray-100" />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
            </div>

            <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <CustomerContent params={params} />
      </Suspense>
    </main>
  );
}
