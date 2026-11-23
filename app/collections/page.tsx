
import { Suspense } from "react";
import { connection } from "next/server";
import {
  CheckCircle2,
  FileText,
  Wallet,
} from "lucide-react";

import { prisma } from "../../lib/prisma";
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";

import PaymentForm from "./PaymentForm";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function CollectionsContent() {
  await connection();

  const session = await requireRole(["REP", "ADMIN"]);
  const isAdmin = session.role === "ADMIN";

  const invoices = await prisma.invoice.findMany({
    where: {
      customerId: { not: null },
      paymentType: { not: "CASH" },
      ...(isAdmin
        ? {}
        : {
            OR: [
              { userId: session.userId },
              { order: { is: { repId: session.userId } } },
            ],
          }),
    },
    include: {
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
      user: {
        select: { name: true },
      },
      order: {
        include: {
          rep: {
            select: { name: true },
          },
        },
      },
      items: {
        include: {
          product: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 1000,
  });

  const unpaidInvoices = invoices
    .filter(
      (invoice) =>
        invoice.total - invoice.paidAmount > 0.009
    )
    .map((invoice) => ({
      id: invoice.id,
      date: invoice.date.toLocaleString("en-GB", {
        timeZone: "Asia/Riyadh",
        dateStyle: "medium",
        timeStyle: "short",
      }),
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      customerName: invoice.customer?.name ?? "بدون اسم",
      customerPhone: invoice.customer?.phone ?? "",
      repName: invoice.order?.rep.name ?? invoice.user.name,
      paymentType: invoice.paymentType,
      items: invoice.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
    }));

  const totalOutstanding =
    Math.round(
      unpaidInvoices.reduce(
        (sum, invoice) =>
          sum + (invoice.total - invoice.paidAmount),
        0
      ) * 100
    ) / 100;

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">

      {/* Statistics */}
      <section
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {/* Invoice count */}
        <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 sm:text-sm">
              عدد الفواتير المستحقة
            </p>

            <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl tabular-nums">
              {unpaidInvoices.length.toLocaleString("en-US")}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              فواتير تحتاج إلى تحصيل
            </p>
          </div>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-12 sm:w-12">
            <FileText
              className="h-5 w-5 sm:h-6 sm:w-6"
              aria-hidden="true"
            />
          </span>
        </div>

        {/* Outstanding amount */}
        <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 sm:text-sm">
              إجمالي المبالغ المتبقية
            </p>

            <p
              className={`mt-2 break-all text-2xl font-extrabold tracking-tight sm:text-3xl tabular-nums ${
                totalOutstanding > 0
                  ? "text-amber-700"
                  : "text-gray-900"
              }`}
              dir="ltr"
            >
              {formatMoney(totalOutstanding)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              إجمالي ديون العملاء الحالية
            </p>
          </div>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 sm:h-12 sm:w-12">
            <Wallet
              className="h-5 w-5 sm:h-6 sm:w-6"
              aria-hidden="true"
            />
          </span>
        </div>
      </section>

      {/* Payment form */}
      {unpaidInvoices.length > 0 ? (
        <section className="w-full min-w-0">
          <PaymentForm invoices={unpaidInvoices} />
        </section>
      ) : (
        <section
          className={`${ui.card} flex min-w-0 flex-col items-center px-4 py-10 text-center sm:py-14`}
        >
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2
              className="h-8 w-8 text-emerald-500"
              aria-hidden="true"
            />
          </span>

          <h2 className="text-base font-bold text-gray-800 sm:text-lg">
            لا توجد فواتير عليها مبالغ مستحقة
          </h2>

          <p className="mt-2 max-w-md text-xs leading-6 text-gray-500 sm:text-sm">
            ممتاز! لا توجد مبالغ متبقية على العملاء حاليًا.
            ستظهر هنا الفواتير الآجلة التي تحتاج إلى تحصيل.
          </p>
        </section>
      )}
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <main
      dir="rtl"
      className={`${ui.page} w-full min-w-0 max-w-full space-y-5 sm:space-y-6`}
    >
      {/* Page heading */}
      <header className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            إدارة التحصيلات
          </div>

          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl lg:text-3xl">
            تسجيل تحصيل
          </h1>

          <p className="mt-2 max-w-2xl text-xs leading-6 text-gray-500 sm:text-sm">
            اختر الفاتورة لمراجعة تفاصيلها، ثم سجّل المبلغ
            الذي استلمته من العميل.
          </p>
        </div>
      </header>

      {/* Dynamic content */}
      <Suspense
        fallback={
          <div
            className="w-full min-w-0 space-y-4"
            aria-busy="true"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            </div>

            <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <CollectionsContent />
      </Suspense>
    </main>
  );
}
