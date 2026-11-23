
import Link from "next/link";
import { connection } from "next/server";
import { ReceiptText, ArrowUpLeft } from "lucide-react";

import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

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

export default async function ExpenseSummary() {
  await connection();

  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return null;
  }

  const now = new Date();

  const result = await prisma.expense.aggregate({
    where: {
      date: {
        gte: startOfSaudiMonth(now),
        lte: now,
      },
    },
    _sum: { amount: true },
    _count: true,
  });

  return (
    <Link
      href="/expenses"
      aria-label="عرض وإدارة مصروفات الشهر"
      className="
        group block w-full min-w-0
        rounded-xl border border-gray-200
        bg-white p-3.5 shadow-sm
        transition duration-200
        hover:-translate-y-0.5 hover:border-rose-200
        hover:shadow-md
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-rose-500
        focus-visible:ring-offset-2
        sm:rounded-2xl sm:p-5
      "
    >
      <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">

        {/* Expense information */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 sm:text-sm">
              مصروفات الشهر
            </span>

            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 sm:text-xs">
              هذا الشهر
            </span>
          </div>

          <p
            className="
              mt-2 break-all text-xl font-extrabold
              tracking-tight text-gray-900
              tabular-nums
              sm:mt-3 sm:text-2xl
              lg:text-3xl
            "
            dir="ltr"
          >
            {money(result._sum.amount ?? 0)}
          </p>

          <p className="mt-1.5 text-[11px] leading-5 text-gray-400 sm:text-xs">
            {result._count.toLocaleString("en-US")} مصروف
            <span className="mx-1">·</span>
            اضغط لإدارة المصروفات
          </p>
        </div>

        {/* Icon */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span
            className="
              flex h-10 w-10 items-center justify-center
              rounded-xl bg-rose-50 text-rose-700
              transition group-hover:bg-rose-100
              sm:h-12 sm:w-12
            "
          >
            <ReceiptText className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>

          <ArrowUpLeft className="h-4 w-4 text-gray-300 transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-rose-600" />
        </div>
      </div>
    </Link>
  );
}
