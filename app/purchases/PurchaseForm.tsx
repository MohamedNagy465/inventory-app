
"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  PackagePlus,
  Trash2,
  ReceiptText,
  Wallet,
  Truck,
} from "lucide-react";
import { createPurchase } from "./actions";
import { ui } from "../../lib/ui";

type Product = {
  id: number;
  name: string;
  stock: number;
};

type PurchaseItem = {
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PurchaseForm({
  products,
}: {
  products: Product[];
}) {
  const router = useRouter();

  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [note, setNote] = useState("");

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");

  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  function addItem() {
    setError("");
    setSuccess("");

    const product = products.find(
      (p) => String(p.id) === selectedProduct
    );

    const qty = Number(quantity);
    const cost = Number(unitCost);

    if (!product) {
      setError("اختر المنتج أولاً");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setError("أدخل كمية صحيحة");
      return;
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      setError("أدخل سعر شراء صحيح للوحدة");
      return;
    }

    if (items.some((item) => item.productId === product.id)) {
      setError("المنتج موجود بالفعل. عدّل الكمية في القائمة.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        quantity: qty,
        unitCost: Math.round(cost * 100) / 100,
      },
    ]);

    setSelectedProduct("");
    setQuantity("1");
    setUnitCost("");
  }

  function updateItem(
    productId: number,
    field: "quantity" | "unitCost",
    value: string
  ) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) return;

    setItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item;

        return {
          ...item,
          [field]:
            field === "quantity"
              ? Math.floor(number)
              : Math.round(number * 100) / 100,
        };
      })
    );

    setError("");
    setSuccess("");
  }

  function removeItem(productId: number) {
    setItems((current) =>
      current.filter((item) => item.productId !== productId)
    );

    setError("");
    setSuccess("");
  }

  function submitPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (items.length === 0) {
      setError("أضف منتجًا واحدًا على الأقل");
      return;
    }

    if (
      items.some(
        (item) =>
          item.quantity <= 0 ||
          item.unitCost <= 0 ||
          !Number.isInteger(item.quantity)
      )
    ) {
      setError("راجع كميات وأسعار شراء المنتجات");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createPurchase({
          supplierName,
          supplierInvoiceNo,
          note,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setSuccess(
          `تم تسجيل فاتورة الشراء رقم #${result.purchaseId} بنجاح`
        );

        setSupplierName("");
        setSupplierInvoiceNo("");
        setNote("");
        setItems([]);
        setSelectedProduct("");
        setQuantity("1");
        setUnitCost("");

        router.refresh();
      } catch {
        setError("حدث خطأ أثناء تسجيل فاتورة الشراء، حاول مرة أخرى.");
      }
    });
  }

  return (
    <form
      onSubmit={submitPurchase}
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      {/* Supplier Information */}
      <section className={`${ui.card} min-w-0 space-y-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Truck className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="font-extrabold text-gray-900 sm:text-lg">
              بيانات المورد
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              بيانات الجهة التي اشتريت منها البضاعة
            </p>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="min-w-0">
            <label
              htmlFor="purchase-supplier"
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              اسم المورد
            </label>

            <input
              id="purchase-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              maxLength={150}
              placeholder="اكتب اسم المورد"
              className={`${ui.input} min-h-11 w-full min-w-0`}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="purchase-supplier-invoice"
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              رقم فاتورة المورد
            </label>

            <input
              id="purchase-supplier-invoice"
              value={supplierInvoiceNo}
              onChange={(e) => setSupplierInvoiceNo(e.target.value)}
              maxLength={100}
              placeholder="رقم الفاتورة (اختياري)"
              className={`${ui.input} min-h-11 w-full min-w-0`}
            />
          </div>
        </div>
      </section>

      {/* Add Product */}
      <section className={`${ui.card} min-w-0 space-y-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <PackagePlus className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="font-extrabold text-gray-900 sm:text-lg">
              إضافة المنتجات
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              اختر المنتج وأدخل الكمية وتكلفة شراء الوحدة
            </p>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <label
              htmlFor="purchase-product"
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              المنتج
            </label>

            <select
              id="purchase-product"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className={`${ui.input} min-h-11 w-full min-w-0`}
            >
              <option value="">اختر المنتج</option>

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - المخزون الحالي: {product.stock}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="purchase-quantity"
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              الكمية
            </label>

            <input
              id="purchase-quantity"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`${ui.input} min-h-11 w-full min-w-0`}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="purchase-unit-cost"
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              سعر شراء الوحدة
            </label>

            <input
              id="purchase-unit-cost"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
              className={`${ui.input} min-h-11 w-full min-w-0`}
            />
          </div>

          <button
            type="button"
            onClick={addItem}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 sm:col-span-2 xl:col-span-1"
          >
            <PackagePlus className="h-4 w-4" />
            إضافة المنتج
          </button>
        </div>
      </section>

      {/* Purchase Items */}
      <section className={`${ui.card} min-w-0 space-y-4`}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ReceiptText className="h-5 w-5" />
            </span>

            <div className="min-w-0">
              <h2 className="font-extrabold text-gray-900 sm:text-lg">
                تفاصيل فاتورة الشراء
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {items.length} صنف داخل الفاتورة
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {items.reduce((sum, item) => sum + item.quantity, 0)} قطعة
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-3 py-10 text-center sm:py-12">
            <PackagePlus className="mx-auto h-9 w-9 text-gray-300" />

            <p className="mt-3 text-sm font-semibold text-gray-700">
              لم يتم إضافة منتجات بعد
            </p>

            <p className="mt-1 text-xs text-gray-400">
              اختر المنتجات من القسم السابق
            </p>
          </div>
        ) : (
          <>
            {/* Mobile product cards */}
            <div className="space-y-3 md:hidden">
              {items.map((item, index) => (
                <article
                  key={item.productId}
                  className="min-w-0 rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold leading-6 text-gray-900">
                          {item.name}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-400">
                          رقم المنتج: {item.productId}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`حذف ${item.name}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label
                        htmlFor={`mobile-quantity-${item.productId}`}
                        className="mb-1.5 block text-xs font-semibold text-gray-600"
                      >
                        الكمية
                      </label>

                      <input
                        id={`mobile-quantity-${item.productId}`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            item.productId,
                            "quantity",
                            e.target.value
                          )
                        }
                        className="min-h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-center text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor={`mobile-cost-${item.productId}`}
                        className="mb-1.5 block text-xs font-semibold text-gray-600"
                      >
                        تكلفة الوحدة
                      </label>

                      <input
                        id={`mobile-cost-${item.productId}`}
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) =>
                          updateItem(
                            item.productId,
                            "unitCost",
                            e.target.value
                          )
                        }
                        className="min-h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-center text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
                    <span className="text-xs font-semibold text-blue-700">
                      إجمالي الصنف
                    </span>

                    <strong className="break-all text-sm text-blue-800" dir="ltr">
                      {money(item.quantity * item.unitCost)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
              <table className="w-full min-w-[650px] text-right text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="px-3 py-3 font-semibold">
                      المنتج
                    </th>

                    <th className="px-3 py-3 font-semibold">
                      الكمية
                    </th>

                    <th className="px-3 py-3 font-semibold">
                      سعر الشراء
                    </th>

                    <th className="px-3 py-3 font-semibold">
                      الإجمالي
                    </th>

                    <th className="px-3 py-3 font-semibold">
                      حذف
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.productId}>
                      <td className="max-w-xs px-3 py-3 font-semibold text-gray-800">
                        <span className="block break-words">
                          {item.name}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.productId,
                              "quantity",
                              e.target.value
                            )
                          }
                          aria-label={`كمية ${item.name}`}
                          className="min-h-10 w-20 rounded-lg border border-gray-300 px-2 text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) =>
                            updateItem(
                              item.productId,
                              "unitCost",
                              e.target.value
                            )
                          }
                          aria-label={`تكلفة ${item.name}`}
                          className="min-h-10 w-28 rounded-lg border border-gray-300 px-2 text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3 font-bold text-gray-900">
                        <span dir="ltr">
                          {money(item.quantity * item.unitCost)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          aria-label={`حذف ${item.name}`}
                          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Purchase total and notes */}
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-green-50 p-3.5 sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Wallet className="h-5 w-5 shrink-0 text-green-700" />

              <span className="text-xs font-bold text-green-800 sm:text-sm">
                إجمالي فاتورة الشراء
              </span>
            </div>

            <span
              className="break-all text-xl font-extrabold text-green-700 sm:text-2xl"
              dir="ltr"
            >
              {money(total)}
            </span>
          </div>

          <div>
            <label
              htmlFor="purchase-note"
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              ملاحظات
            </label>

            <textarea
              id="purchase-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="أي ملاحظات عن عملية الشراء..."
              className={`${ui.input} min-h-24 w-full resize-y`}
            />

            <p className="mt-1 text-left text-[10px] text-gray-400" dir="ltr">
              {note.length}/500
            </p>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 sm:text-sm"
        >
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs leading-6 text-green-700 sm:text-sm"
        >
          {success}
        </div>
      )}

      {/* Submit */}
      <div className="space-y-3">
        <button
          type="submit"
          disabled={pending || items.length === 0}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
        >
          {pending ? (
            "جاري تسجيل فاتورة الشراء..."
          ) : (
            <>
              <ReceiptText className="h-5 w-5" />
              تأكيد الشراء وإضافة المخزون
            </>
          )}
        </button>

        <p className="text-center text-[11px] leading-5 text-gray-400 sm:text-xs">
          سيتم إضافة الكميات للمخزون بعد نجاح حفظ الفاتورة فقط.
        </p>
      </div>
    </form>
  );
}
