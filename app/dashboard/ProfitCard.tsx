
import { connection } from "next/server";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  PiggyBank,
} from "lucide-react";
import { prisma } from "../../lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
const OFFSET = 3 * 60 * 60 * 1000; // توقيت السعودية UTC+3

const round2 = (n: number) => Math.round(n * 100) / 100;

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

function monthStart(date: Date) {
  const s = new Date(date.getTime() + OFFSET);

  return new Date(
    Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - OFFSET
  );
}

/**
 * الربح = صافي مبيعات الفواتير بعد الخصم - تكلفة الأصناف المباعة.
 * تكلفة الصنف = الكمية × InvoiceItem.unitCost
 *
 * التكلفة محفوظة وقت إصدار الفاتورة، ولا تتغير بتغير أسعار الشراء لاحقًا.
 */
async function profitBetween(from: Date, to: Date) {
  const [sales, items] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        date: {
          gte: from,
          lt: to,
        },
      },
      _sum: {
        total: true,
      },
    }),

    prisma.invoiceItem.findMany({
      where: {
        invoice: {
          date: {
            gte: from,
            lt: to,
          },
        },
      },
      select: {
        productId: true,
        quantity: true,
        unitCost: true,
      },
    }),
  ]);

  let cost = 0;

  // عدد المنتجات المختلفة التي لا توجد لها تكلفة محفوظة.
  const missingProducts = new Set<number>();

  for (const item of items) {
    if (!Number.isFinite(item.unitCost) || item.unitCost <= 0) {
      missingProducts.add(item.productId);
      continue;
    }

    cost += item.unitCost * item.quantity;
  }

  const revenue = round2(sales._sum.total ?? 0);

  return {
    revenue,
    cost: round2(cost),
    profit: round2(revenue - cost),
    missingCost: missingProducts.size,
  };
}

export default async function ProfitCard() {
  await connection();

  const now = new Date();
  const month = monthStart(now);
  const elapsed = now.getTime() - month.getTime();

  // نفس الفترة من الشهر الماضي.
  const prevStart = monthStart(
    new Date(month.getTime() - DAY)
  );

  const prevEnd = new Date(
    Math.min(
      prevStart.getTime() + elapsed,
      month.getTime()
    )
  );

  const [current, previous] = await Promise.all([
    profitBetween(month, new Date(now.getTime() + 1)),
    profitBetween(prevStart, prevEnd),
  ]);

  // نسبة التغيير.
  const change =
    previous.profit === 0
      ? null
      : round2(
          ((current.profit - previous.profit) /
            Math.abs(previous.profit)) *
            100
        );

  const direction =
    change === null || Math.abs(change) < 0.005
      ? "flat"
      : change > 0
      ? "up"
      : "down";

  const trend = {
    up: {
      Icon: ArrowUpRight,
      badge: "bg-emerald-100 text-emerald-700",
      label: `${fmt(Math.abs(change ?? 0))}%`,
    },
    down: {
      Icon: ArrowDownRight,
      badge: "bg-red-100 text-red-700",
      label: `${fmt(Math.abs(change ?? 0))}%`,
    },
    flat: {
      Icon: Minus,
      badge: "bg-gray-100 text-gray-600",
      label: change === null ? "جديد" : "0%",
    },
  }[direction];

  const profitTone =
    current.profit < 0
      ? "text-red-600"
      : "text-emerald-700";

  const margin =
    current.revenue > 0
      ? round2(
          (current.profit / current.revenue) * 100
        )
      : null;

  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            أرباح هذا الشهر
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p
              className={`break-words text-2xl font-extrabold tracking-tight sm:text-3xl ${profitTone}`}
              dir="ltr"
            >
              {fmt(current.profit)}
            </p>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${trend.badge}`}
              dir="ltr"
            >
              <trend.Icon
                className="h-4 w-4"
                aria-hidden="true"
              />

              {trend.label}
            </span>
          </div>

          <p className="mt-1 text-[11px] leading-5 text-gray-400 sm:text-xs">
            مقارنة بنفس الفترة من الشهر الماضي (
            {fmt(previous.profit)})
          </p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-10 sm:w-10">
          <PiggyBank
            className="h-4 w-4 sm:h-5 sm:w-5"
            aria-hidden="true"
          />
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-gray-200 text-center">
        <div className="min-w-0 bg-white p-2">
          <dt className="text-[10px] text-gray-500 sm:text-xs">
            المبيعات
          </dt>

          <dd
            className="mt-1 break-words text-sm font-bold text-gray-900"
            dir="ltr"
          >
            {fmt(current.revenue)}
          </dd>
        </div>

        <div className="min-w-0 bg-white p-2">
          <dt className="text-[10px] text-gray-500 sm:text-xs">
            التكلفة
          </dt>

          <dd
            className="mt-1 break-words text-sm font-bold text-gray-900"
            dir="ltr"
          >
            {fmt(current.cost)}
          </dd>
        </div>

        <div className="min-w-0 bg-white p-2">
          <dt className="text-[10px] text-gray-500 sm:text-xs">
            هامش الربح
          </dt>

          <dd
            className="mt-1 break-words text-sm font-bold text-gray-900"
            dir="ltr"
          >
            {margin === null ? "—" : `${fmt(margin)}%`}
          </dd>
        </div>
      </dl>

      {current.missingCost > 0 && (
        <div
          role="alert"
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
        >
          {current.missingCost} منتج مباع بدون تكلفة شراء محفوظة
          في الفاتورة. الربح الظاهر قد يكون أعلى من الحقيقي.
          راجع فواتير الشراء والمبيعات القديمة.
          {" "}
          <Link
            href="/purchases"
            className="font-semibold underline"
          >
            مراجعة المشتريات
          </Link>
        </div>
      )}
    </section>
  );
}
