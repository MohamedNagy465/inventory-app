
import { Suspense } from "react";
import { connection } from "next/server";
import {
  CalendarDays,
  ReceiptText,
  Wallet,
  UserRound,
  Tag,
} from "lucide-react";

import { requireRole } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  isExpenseCategory,
} from "../../lib/expenses";

import ExpenseForm, {
  DeleteExpenseButton,
} from "./ExpenseForm";

const DAY = 24 * 60 * 60 * 1000;
const SAUDI_OFFSET = 3 * 60 * 60 * 1000;

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

function startOfSaudiMonth(date: Date) {
  const shifted = new Date(
    date.getTime() + SAUDI_OFFSET
  );

  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      1
    ) - SAUDI_OFFSET
  );
}

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  const check = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(`${value}T00:00:00+03:00`);
}

function dateInputValue(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ar-EG-u-nu-latn", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

type SearchParams = Promise<{
  from?: string;
  to?: string;
  category?: string;
}>;

function SummaryCard({
  title,
  value,
  count,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  count: number;
  icon: typeof Wallet;
  tone: "blue" | "rose";
}) {
  const styles = {
    blue: {
      icon: "bg-blue-50 text-blue-700",
      value: "text-gray-900",
    },
    rose: {
      icon: "bg-rose-50 text-rose-700",
      value: "text-rose-700",
    },
  };

  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 sm:text-sm">
          {title}
        </p>

        <p
          className={`mt-2 break-all text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl lg:text-3xl ${styles[tone].value}`}
          dir="ltr"
        >
          {value}
        </p>

        <p className="mt-1.5 text-[11px] text-gray-400 sm:text-xs">
          {count.toLocaleString("en-US")} مصروف
        </p>
      </div>

      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${styles[tone].icon}`}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
    </div>
  );
}

async function ExpensesContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  await requireRole(["ADMIN"]);

  const params = await searchParams;

  const now = new Date();
  const monthStart = startOfSaudiMonth(now);

  const from = parseDate(params.from) ?? monthStart;
  const requestedTo = parseDate(params.to);

  const toExclusive = requestedTo
    ? new Date(requestedTo.getTime() + DAY)
    : new Date(now.getTime() + 1);

  const category =
    params.category && isExpenseCategory(params.category)
      ? params.category
      : undefined;

  const where = {
    date: {
      gte: from,
      lt: toExclusive,
    },
    ...(category ? { category } : {}),
  };

  const [
    expenses,
    periodTotals,
    monthTotals,
  ] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [
        { date: "desc" },
        { id: "desc" },
      ],
      take: 200,
      include: {
        user: {
          select: { name: true },
        },
      },
    }),

    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),

    prisma.expense.aggregate({
      where: {
        date: {
          gte: monthStart,
          lte: now,
        },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const today = dateInputValue(now);

  const periodTotal = periodTotals._sum.amount ?? 0;
  const monthTotal = monthTotals._sum.amount ?? 0;

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">

      {/* Summary cards */}
      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard
          title="مصروفات الفترة المحددة"
          value={money(periodTotal)}
          count={periodTotals._count}
          icon={Wallet}
          tone="blue"
        />

        <SummaryCard
          title="مصروفات الشهر الحالي"
          value={money(monthTotal)}
          count={monthTotals._count}
          icon={ReceiptText}
          tone="rose"
        />
      </section>

      {/* Create expense */}
      <ExpenseForm today={today} />

      {/* Expenses list */}
      <section className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl">

        {/* Section header and filters */}
        <div className="border-b border-gray-100 p-3.5 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-extrabold text-gray-900 sm:text-base">
                سجل المصروفات
              </h2>

              <p className="mt-1 text-[11px] text-gray-400 sm:text-xs">
                آخر 200 مصروف مطابق للفلاتر.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
              {expenses.length.toLocaleString("en-US")} نتيجة
            </span>
          </div>

          {/* Filters */}
          <form
            method="get"
            className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className="block min-w-0 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                من تاريخ
              </span>

              <input
                className="mt-1.5 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                type="date"
                name="from"
                defaultValue={
                  params.from ?? dateInputValue(monthStart)
                }
              />
            </label>

            <label className="block min-w-0 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                إلى تاريخ
              </span>

              <input
                className="mt-1.5 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                type="date"
                name="to"
                defaultValue={params.to ?? today}
              />
            </label>

            <label className="block min-w-0 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                التصنيف
              </span>

              <select
                className="mt-1.5 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                name="category"
                defaultValue={category ?? ""}
              >
                <option value="">كل التصنيفات</option>

                {EXPENSE_CATEGORIES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex min-w-0 items-end gap-2">
              <button
                type="submit"
                className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-gray-900 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-gray-700"
              >
                تطبيق الفلاتر
              </button>

              <a
                href="/expenses"
                className="flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                مسح
              </a>
            </div>
          </form>
        </div>

        {/* Empty state */}
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center sm:py-14">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <ReceiptText className="h-6 w-6" />
            </span>

            <p className="font-semibold text-gray-800">
              لا توجد مصروفات في الفترة المحددة
            </p>

            <p className="mt-1 text-xs text-gray-400">
              جرّب تغيير التاريخ أو التصنيف.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 md:hidden">
              {expenses.map((expense) => (
                <article
                  key={expense.id}
                  className="min-w-0 p-3.5 transition hover:bg-gray-50/60"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                        <ReceiptText className="h-4 w-4" />
                      </span>

                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-gray-900">
                          {expenseCategoryLabel(expense.category)}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-400">
                          #{expense.id} · {formatDate(expense.date)}
                        </p>
                      </div>
                    </div>

                    <p
                      className="shrink-0 break-all text-sm font-extrabold text-gray-900"
                      dir="ltr"
                    >
                      {money(expense.amount)}
                    </p>
                  </div>

                  {expense.description && (
                    <p className="mt-3 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                      {expense.description}
                    </p>
                  )}

                  <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />

                      <span className="truncate">
                        {expense.user.name}
                      </span>
                    </div>

                    <DeleteExpenseButton id={expense.id} />
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[700px] text-right text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      التاريخ
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      التصنيف
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      البيان
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      المبلغ
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      سجله
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      إجراء
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="transition hover:bg-gray-50/70"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatDate(expense.date)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                        {expenseCategoryLabel(expense.category)}
                      </td>

                      <td className="max-w-xs px-4 py-3 text-gray-600">
                        <span className="block truncate">
                          {expense.description || "—"}
                        </span>
                      </td>

                      <td
                        className="whitespace-nowrap px-4 py-3 font-bold text-gray-900"
                        dir="ltr"
                      >
                        {money(expense.amount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {expense.user.name}
                      </td>

                      <td className="px-4 py-3">
                        <DeleteExpenseButton id={expense.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main
      dir="rtl"
      className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-3 sm:space-y-6 sm:p-5 lg:p-6"
    >
      <header className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 sm:h-12 sm:w-12">
          <ReceiptText className="h-6 w-6" />
        </span>

        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
            إدارة المصروفات
          </h1>

          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            سجّل مصروفات المحل وراجع إجماليها حسب التاريخ والتصنيف.
          </p>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
            </div>

            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <ExpensesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
