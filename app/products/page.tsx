
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/auth";
import RoleGuard from "../../lib/RoleGuard";
import { ui } from "../../lib/ui";

// ==========================================
// ADD PRODUCT
// ==========================================

async function addProduct(formData: FormData) {
  "use server";

  await requireRole(["ADMIN", "EMPLOYEE"]);

  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));

  if (
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    redirect("/products?status=invalid-add");
  }

  try {
    await prisma.product.create({
      data: {
        name,
        price,
        stock,
      },
    });
  } catch (error) {
    console.error("Add product error:", error);
    redirect("/products?status=add-error");
  }

  revalidatePath("/products");
  redirect("/products?status=added");
}

// ==========================================
// UPDATE PRODUCT
// ==========================================

async function updateProduct(formData: FormData) {
  "use server";

  await requireRole(["ADMIN", "EMPLOYEE"]);

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));
  const lowStockAt = Number(formData.get("lowStockAt"));

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    !Number.isInteger(lowStockAt) ||
    lowStockAt < 0
  ) {
    redirect("/products?status=invalid-edit");
  }

  try {
    await prisma.product.update({
      where: { id },
      data: {
        name,
        price,
        stock,
        lowStockAt,
      },
    });
  } catch (error) {
    console.error("Update product error:", error);
    redirect("/products?status=update-error");
  }

  revalidatePath("/products");
  redirect("/products?status=updated");
}

// ==========================================
// DELETE PRODUCT
// ==========================================

async function deleteProduct(formData: FormData) {
  "use server";

  const session = await getSession();

  if (session?.role !== "ADMIN") {
    redirect("/products?status=forbidden");
  }

  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    redirect("/products?status=invalid-id");
  }

  // Check if product is used in previous invoices or orders
  const [invoiceItems, orderItems] = await Promise.all([
    prisma.invoiceItem.count({
      where: { productId: id },
    }),

    prisma.orderItem.count({
      where: { productId: id },
    }),
  ]);

  if (invoiceItems > 0 || orderItems > 0) {
    redirect("/products?status=delete-linked");
  }

  try {
    await prisma.product.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Delete product error:", error);
    redirect("/products?status=delete-error");
  }

  revalidatePath("/products");
  redirect("/products?status=deleted");
}

// ==========================================
// STATUS MESSAGES
// ==========================================

const statusMessages: Record<
  string,
  { text: string; type: "success" | "error" }
> = {
  added: {
    text: "تم إضافة المنتج بنجاح.",
    type: "success",
  },

  updated: {
    text: "تم تعديل بيانات المنتج بنجاح.",
    type: "success",
  },

  deleted: {
    text: "تم حذف المنتج بنجاح.",
    type: "success",
  },

  "delete-linked": {
    text: "لا يمكن حذف هذا المنتج لأنه مرتبط بفواتير أو طلبات سابقة. يمكنك تعديل بياناته بدلًا من حذفه.",
    type: "error",
  },

  "delete-error": {
    text: "حدث خطأ أثناء حذف المنتج. تأكد من وجود المنتج وحاول مرة أخرى.",
    type: "error",
  },

  forbidden: {
    text: "ليس لديك صلاحية حذف المنتجات. الحذف متاح للمدير فقط.",
    type: "error",
  },

  "invalid-id": {
    text: "رقم المنتج غير صحيح.",
    type: "error",
  },

  "invalid-add": {
    text: "تأكد من إدخال اسم صحيح وسعر وكمية صالحين.",
    type: "error",
  },

  "invalid-edit": {
    text: "بيانات التعديل غير صحيحة. راجع الاسم والسعر والكمية وحد التنبيه.",
    type: "error",
  },

  "add-error": {
    text: "حدث خطأ أثناء إضافة المنتج.",
    type: "error",
  },

  "update-error": {
    text: "حدث خطأ أثناء تعديل المنتج.",
    type: "error",
  },
};

// ==========================================
// PRODUCT NOTICE
// ==========================================

async function ProductNotice({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;

  const notice = params.status
    ? statusMessages[params.status]
    : undefined;

  if (!notice) return null;

  return (
    <div
      role={notice.type === "success" ? "status" : "alert"}
      className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-6 ${
        notice.type === "success"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {notice.text}
    </div>
  );
}

// ==========================================
// PRODUCT EDIT FORM
// ==========================================

async function ProductEditor({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;

  if (!params.edit) return null;

  const id = Number(params.edit);

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        رقم المنتج غير صحيح.
      </div>
    );
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        المنتج غير موجود.
      </div>
    );
  }

  return (
    <form
      action={updateProduct}
      className={`${ui.card} mb-6 min-w-0`}
    >
      <input
        type="hidden"
        name="id"
        value={product.id}
      />

      <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-gray-900 sm:text-lg">
            تعديل المنتج
          </h2>

          <p className="mt-1 break-words text-xs text-gray-500 sm:text-sm">
            تعديل بيانات: {product.name}
          </p>
        </div>

        <Link
          href="/products"
          className="flex min-h-9 shrink-0 items-center justify-center rounded-lg px-3 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
        >
          إلغاء ✕
        </Link>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 sm:text-sm">
            اسم المنتج
          </span>

          <input
            name="name"
            defaultValue={product.name}
            required
            className={`${ui.input} w-full min-w-0`}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 sm:text-sm">
            السعر
          </span>

          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product.price}
            required
            className={`${ui.input} w-full min-w-0`}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 sm:text-sm">
            الكمية
          </span>

          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={product.stock}
            required
            className={`${ui.input} w-full min-w-0`}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 sm:text-sm">
            حد التنبيه عند انخفاض المخزون
          </span>

          <input
            name="lowStockAt"
            type="number"
            min="0"
            step="1"
            defaultValue={product.lowStockAt}
            required
            className={`${ui.input} w-full min-w-0`}
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <button
          type="submit"
          className={`${ui.btn} min-h-11 w-full sm:w-auto`}
        >
          حفظ التعديلات
        </button>

        <Link
          href="/products"
          className="flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          إلغاء
        </Link>
      </div>
    </form>
  );
}

// ==========================================
// PRODUCT STATUS
// ==========================================

function ProductStatus({
  stock,
  lowStockAt,
}: {
  stock: number;
  lowStockAt: number;
}) {
  if (stock === 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        نفد
      </span>
    );
  }

  if (stock <= lowStockAt) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        قارب على النفاد
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
      متوفر
    </span>
  );
}

// ==========================================
// PRODUCT ACTIONS
// ==========================================

function ProductActions({
  productId,
  isAdmin,
}: {
  productId: number;
  isAdmin: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <Link
        href={`/products?edit=${productId}`}
        className="flex min-h-10 items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        تعديل
      </Link>

      {isAdmin && (
        <form action={deleteProduct}>
          <input
            type="hidden"
            name="id"
            value={productId}
          />

          <button
            type="submit"
            className={`${ui.btnDanger} min-h-10 w-full`}
          >
            حذف
          </button>
        </form>
      )}
    </div>
  );
}

// ==========================================
// PRODUCTS TABLE AND MOBILE CARDS
// ==========================================

async function ProductsTable() {
  const [products, session] = await Promise.all([
    prisma.product.findMany({
      orderBy: { id: "desc" },
    }),

    getSession(),
  ]);

  const isAdmin = session?.role === "ADMIN";

  return (
    <section className={`${ui.tableCard} min-w-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-3 sm:px-4">
        <h2 className="font-bold text-gray-800">
          قائمة المنتجات
        </h2>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {products.length} منتج
        </span>
      </div>

      {products.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-3xl">📦</p>

          <p className="mt-3 text-sm font-semibold text-gray-700">
            مفيش منتجات لسه
          </p>

          <p className="mt-1 text-xs text-gray-400">
            ضيف أول منتج من النموذج الموجود فوق.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {products.map((p) => (
              <article
                key={p.id}
                className="min-w-0 space-y-3 p-3.5"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold leading-6 text-gray-900">
                      {p.name}
                    </p>

                    <p className="mt-1 text-[11px] text-gray-400">
                      رقم المنتج: #{p.id}
                    </p>
                  </div>

                  <ProductStatus
                    stock={p.stock}
                    lowStockAt={p.lowStockAt}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-400">
                      السعر
                    </p>

                    <p
                      className="mt-1 break-all text-base font-extrabold text-gray-900"
                      dir="ltr"
                    >
                      {p.price.toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-400">
                      الكمية المتاحة
                    </p>

                    <p className="mt-1 text-base font-extrabold text-gray-900">
                      {p.stock}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <p className="text-[11px] text-gray-400">
                    حد التنبيه: {p.lowStockAt}
                  </p>

                  <div className="w-full sm:w-auto">
                    <ProductActions
                      productId={p.id}
                      isAdmin={isAdmin}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className={ui.th}>الاسم</th>
                  <th className={ui.th}>السعر</th>
                  <th className={ui.th}>الكمية</th>
                  <th className={ui.th}>حد التنبيه</th>
                  <th className={ui.th}>الحالة</th>
                  <th className={ui.th}>الإجراءات</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className={`${ui.td} max-w-xs font-semibold`}>
                      <span className="block truncate">
                        {p.name}
                      </span>
                    </td>

                    <td className={ui.td}>
                      <span dir="ltr">
                        {p.price.toFixed(2)}
                      </span>
                    </td>

                    <td className={`${ui.td} font-semibold`}>
                      {p.stock}
                    </td>

                    <td className={ui.td}>
                      {p.lowStockAt}
                    </td>

                    <td className={ui.td}>
                      <ProductStatus
                        stock={p.stock}
                        lowStockAt={p.lowStockAt}
                      />
                    </td>

                    <td className={ui.td}>
                      <ProductActions
                        productId={p.id}
                        isAdmin={isAdmin}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// ==========================================
// PRODUCTS PAGE
// ==========================================

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    edit?: string;
  }>;
}) {
  return (
    <Suspense fallback={null}>
      <RoleGuard allow={["ADMIN", "EMPLOYEE"]}>
        <main
          dir="rtl"
          className={`${ui.page} min-w-0 space-y-5 sm:space-y-6`}
        >
          {/* Page Header */}
          <header className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
              المنتجات
            </h1>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
              إدارة المنتجات والمخزون ومتابعة الكميات المتاحة.
            </p>
          </header>

          {/* Operation Messages */}
          <Suspense fallback={null}>
            <ProductNotice searchParams={searchParams} />
          </Suspense>

          {/* Edit Product Form */}
          <Suspense
            fallback={
              <div
                className="h-40 animate-pulse rounded-xl bg-gray-100"
                aria-busy="true"
              />
            }
          >
            <ProductEditor searchParams={searchParams} />
          </Suspense>

          {/* Add Product Form */}
          <form
            action={addProduct}
            className={`${ui.card} min-w-0`}
          >
            <div className="mb-4">
              <h2 className="font-bold text-gray-900 sm:text-lg">
                إضافة منتج جديد
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                أدخل بيانات المنتج لإضافته إلى المخزون.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_140px_auto] sm:gap-4">
              <input
                name="name"
                placeholder="اسم المنتج"
                required
                aria-label="اسم المنتج"
                className={`${ui.input} w-full min-w-0`}
              />

              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="السعر"
                required
                aria-label="السعر"
                className={`${ui.input} w-full min-w-0`}
              />

              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                placeholder="الكمية"
                required
                aria-label="الكمية"
                className={`${ui.input} w-full min-w-0`}
              />

              <button
                type="submit"
                className={`${ui.btn} min-h-11 w-full sm:col-span-2 xl:col-span-1`}
              >
                + إضافة المنتج
              </button>
            </div>
          </form>

          {/* Products */}
          <Suspense
            fallback={
              <div className="space-y-3" aria-busy="true">
                <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-36 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-36 animate-pulse rounded-xl bg-gray-100" />
              </div>
            }
          >
            <ProductsTable />
          </Suspense>
        </main>
      </RoleGuard>
    </Suspense>
  );
}
