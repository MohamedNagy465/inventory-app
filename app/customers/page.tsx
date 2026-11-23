
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import {
  Users,
  Phone,
  FileText,
  UserPlus,
  Trash2,
  Contact,
} from "lucide-react";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";
import { ui } from "../../lib/ui";
import { createCustomer } from "./actions";

async function addCustomer(formData: FormData) {
  "use server";

  await createCustomer({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });

  revalidatePath("/customers");
}

async function deleteCustomer(formData: FormData) {
  "use server";

  const session = await getSession();
  if (session?.role !== "ADMIN") return;

  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) return;

  await prisma.customer.delete({
    where: { id },
  });

  revalidatePath("/customers");
}

async function CustomersTable() {
  await connection();

  const customers = await prisma.customer.findMany({
    orderBy: { id: "desc" },
    include: {
      _count: {
        select: { invoices: true },
      },
    },
  });

  return (
    <section className="w-full min-w-0 space-y-3">

      {/* Customers count */}
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="font-bold text-gray-800">
          سجل العملاء
        </h2>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {customers.length.toLocaleString("en-US")} عميل
        </span>
      </div>

      {customers.length === 0 ? (
        <div className={`${ui.card} flex flex-col items-center px-4 py-10 text-center sm:py-14`}>
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <Users className="h-7 w-7 text-blue-600" />
          </span>

          <h3 className="font-bold text-gray-800">
            لا يوجد عملاء حتى الآن
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            أضف أول عميل من النموذج الموجود بالأعلى.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile customer cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {customers.map((customer) => (
              <article
                key={customer.id}
                className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Contact className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="block break-words font-bold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {customer.name}
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr" className="break-all">
                          {customer.phone || "غير مسجل"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4 text-gray-400" />

                    <span>
                      عدد الفواتير
                    </span>

                    <strong className="text-gray-900">
                      {customer._count.invoices}
                    </strong>
                  </div>

                  {/*
                    الحذف يظهر للأدمن فقط من خلال Server Action
                    */}
                  <form action={deleteCustomer}>
                    <input
                      type="hidden"
                      name="id"
                      value={customer.id}
                    />

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <div className={`${ui.tableCard} hidden overflow-hidden sm:block`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-right">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={ui.th}>الاسم</th>
                    <th className={ui.th}>الموبايل</th>
                    <th className={ui.th}>عدد الفواتير</th>
                    <th className={ui.th}>إجراء</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className={`${ui.td} font-medium`}>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-semibold text-blue-600 transition hover:text-blue-800 hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </td>

                      <td className={ui.td}>
                        <span dir="ltr">
                          {customer.phone || "-"}
                        </span>
                      </td>

                      <td className={ui.td}>
                        {customer._count.invoices}
                      </td>

                      <td className={`${ui.td} text-left`}>
                        <form action={deleteCustomer}>
                          <input
                            type="hidden"
                            name="id"
                            value={customer.id}
                          />

                          <button
                            type="submit"
                            className={ui.btnDanger}
                          >
                            حذف
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function CustomersPage() {
  return (
    <main
      dir="rtl"
      className={`${ui.page} w-full min-w-0 max-w-full space-y-5 sm:space-y-6`}
    >
      {/* Header */}
      <header className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-12 sm:w-12">
          <Users className="h-6 w-6" />
        </span>

        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
            العملاء
          </h1>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            إدارة بيانات العملاء ومتابعة فواتيرهم.
          </p>
        </div>
      </header>

      {/* Add Customer */}
      <section className={`${ui.card} min-w-0`}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <UserPlus className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="font-bold text-gray-800">
              إضافة عميل جديد
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              أدخل اسم العميل ورقم هاتفه.
            </p>
          </div>
        </div>

        <form
          action={addCustomer}
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
        >
          <label className="block min-w-0 text-sm font-medium text-gray-700">
            اسم العميل

            <input
              name="name"
              placeholder="مثال: أحمد محمد"
              required
              maxLength={100}
              className={`${ui.input} mt-1 w-full min-w-0`}
            />
          </label>

          <label className="block min-w-0 text-sm font-medium text-gray-700">
            رقم الموبايل
            <span className="mr-1 text-xs font-normal text-gray-400">
              (اختياري)
            </span>

            <input
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="01xxxxxxxxx"
              maxLength={30}
              className={`${ui.input} mt-1 w-full min-w-0`}
              dir="ltr"
            />
          </label>

          <button
            type="submit"
            className={`${ui.btn} flex w-full items-center justify-center gap-2 sm:col-span-2 lg:col-span-1 lg:w-auto`}
          >
            <UserPlus className="h-4 w-4" />
            إضافة العميل
          </button>
        </form>
      </section>

      {/* Customers list */}
      <Suspense
        fallback={
          <div
            className="space-y-3"
            aria-busy="true"
          >
            <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
          </div>
        }
      >
        <CustomersTable />
      </Suspense>
    </main>
  );
}
