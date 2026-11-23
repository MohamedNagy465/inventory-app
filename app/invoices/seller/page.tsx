
import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth";
import { getOpenShift } from "../../../lib/shift";
import {
  CASH_CUSTOMER_NAME,
  ensureCashCustomer,
} from "../../../lib/customers";
import { ui } from "../../../lib/ui";
import SellerPOS from "./SellerPOS";

async function POSContent() {
  await connection();

  // الأدوار المسموح لها باستخدام شاشة نقطة البيع
  const session = await requireRole([
    "SELLER",
    "EMPLOYEE",
    "ADMIN",
  ]);

  const isSeller = session.role === "SELLER";

  // التأكد من وجود العميل النقدي قبل جلب العملاء
  await ensureCashCustomer();

  const [products, customers, shift] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        barcode: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),

    // الوردية مطلوبة للبائع فقط
    isSeller
      ? getOpenShift(session.userId)
      : Promise.resolve(null),
  ]);

  // العميل النقدي يظهر أول القائمة
  const sortedCustomers = [...customers].sort((a, b) => {
    if (a.name === CASH_CUSTOMER_NAME) return -1;
    if (b.name === CASH_CUSTOMER_NAME) return 1;
    return 0;
  });

  return (
    <div className="w-full min-w-0">
      <SellerPOS
        products={products}
        customers={sortedCustomers}
        shiftRequired={isSeller}
        initialShift={
          shift
            ? {
                id: shift.id,
                openingCash: shift.openingCash,
                openedAt: shift.openedAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}

export default function POSPage() {
  return (
    <main
      dir="rtl"
      className={`${ui.page} min-w-0 space-y-4 sm:space-y-6`}
    >
      {/* Page header */}
      <header className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-12 sm:w-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10M7 12h3m4 0h3m-10 4h10" />
          </svg>
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
            نقطة البيع
          </h1>

          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            امسح الباركود أو اختر المنتجات، ثم أتمم البيع.
          </p>
        </div>
      </header>

      {/* POS content */}
      <Suspense
        fallback={
          <div
            className="min-h-72 w-full animate-pulse rounded-xl bg-gray-100 sm:min-h-96"
            aria-busy="true"
          />
        }
      >
        <POSContent />
      </Suspense>
    </main>
  );
}
