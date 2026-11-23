
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  UserRound,
  CreditCard,
  Wallet,
  CheckCircle2,
  Printer,
  RotateCcw,
  Package,
} from "lucide-react";

import { createInvoice } from "../invoices/actions";
import { ui } from "../../lib/ui";

type ProductOption = {
  id: number;
  name: string;
  price: number;
  stock: number;
};

type CustomerOption = {
  id: number;
  name: string;
};

type CartItem = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

type PaymentType = "CASH" | "CREDIT" | "HALF_CREDIT";
type PaymentMethod = "CASH" | "WALLET" | "TRANSFER";

type Receipt = {
  invoiceId: number;
  customer: string;
  note: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  date: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod | null;
  paidAmount: number;
  remaining: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function paymentTypeLabel(type: PaymentType) {
  const labels: Record<PaymentType, string> = {
    CASH: "كاش كامل",
    HALF_CREDIT: "نصف كاش / نصف آجل",
    CREDIT: "آجل كامل",
  };

  return labels[type];
}

function paymentMethodLabel(method: PaymentMethod | null) {
  if (!method) return "لم يتم التحصيل بعد";

  const labels: Record<PaymentMethod, string> = {
    CASH: "كاش",
    WALLET: "محفظة إلكترونية",
    TRANSFER: "تحويل بنكي",
  };

  return labels[method];
}

type RepFormProps = {
  products?: ProductOption[];
  customers?: CustomerOption[];
};

export default function RepForm({
  products: productsProp = [],
  customers: customersProp = [],
}: RepFormProps) {
  // حماية من عدم تمرير القوائم من الصفحة الأم
  const products = Array.isArray(productsProp) ? productsProp : [];
  const customers = Array.isArray(customersProp) ? customersProp : [];

  const [quantities, setQuantities] = useState<
    Record<number, number>
  >({});

  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");

  const [stage, setStage] = useState<
    "SELECT" | "REVIEW" | "DONE"
  >("SELECT");

  const [paymentType, setPaymentType] =
    useState<PaymentType>("CASH");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("CASH");

  const [discountInput, setDiscountInput] = useState("0");
  const [paidAmountInput, setPaidAmountInput] = useState("0");
  const [paidAmountEdited, setPaidAmountEdited] = useState(false);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [error, setError] = useState("");

  const [pending, startTransition] = useTransition();

  const productById = useMemo(
    () =>
      new Map(
        products.map((product) => [product.id, product])
      ),
    [products]
  );

  const items = useMemo<CartItem[]>(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .flatMap(([id, quantity]) => {
          const product = productById.get(Number(id));

          return product
            ? [
                {
                  productId: product.id,
                  name: product.name,
                  quantity,
                  unitPrice: product.price,
                },
              ]
            : [];
        }),
    [quantities, productById]
  );

  // حسابات بالسنت لتجنب فروق الكسور العشرية.
  const subtotalCents = items.reduce(
    (sum, item) =>
      sum + Math.round(item.unitPrice * 100) * item.quantity,
    0
  );

  const subtotal = subtotalCents / 100;
  const parsedDiscount = Number(discountInput);
  const discountCents = Number.isFinite(parsedDiscount)
    ? Math.round(parsedDiscount * 100)
    : 0;
  const roundedDiscount = discountCents / 100;

  const hasInvalidDiscount =
    discountInput.trim() === "" ||
    !Number.isFinite(parsedDiscount) ||
    parsedDiscount < 0 ||
    discountCents > subtotalCents;

  const totalCents = hasInvalidDiscount
    ? subtotalCents
    : subtotalCents - discountCents;
  const total = totalCents / 100;

  const itemCount = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const parsedPaidAmount =
    paymentType === "CASH"
      ? total
      : Number(paidAmountInput);

  const roundedPaidAmount =
    Math.round(parsedPaidAmount * 100) / 100;

  const remaining = Math.max(
    0,
    Math.round((total - roundedPaidAmount) * 100) / 100
  );

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === customerId
  );

  const visibleProducts = products.filter((product) =>
    product.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const hasInvalidPayment =
    hasInvalidDiscount ||
    !Number.isFinite(parsedPaidAmount) ||
    parsedPaidAmount < 0 ||
    parsedPaidAmount > total ||
    (paymentType !== "CASH" &&
      paidAmountInput.trim() === "") ||
    (paymentType === "HALF_CREDIT" &&
      !(parsedPaidAmount > 0 && parsedPaidAmount < total)) ||
    (paymentType !== "CASH" && !selectedCustomer);

  useEffect(() => {
    if (!autoPrint || !receipt) return;

    const timer = window.setTimeout(() => {
      window.print();
      setAutoPrint(false);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [autoPrint, receipt]);

  // ==========================================
  // CART
  // ==========================================

  function changeQuantity(
    product: ProductOption,
    delta: number
  ) {
    setError("");

    setQuantities((current) => ({
      ...current,
      [product.id]: Math.min(
        product.stock,
        Math.max(
          0,
          (current[product.id] ?? 0) + delta
        )
      ),
    }));
  }

  function resetSale() {
    setQuantities({});
    setSearch("");
    setCustomerId("");
    setNote("");
    setPaymentType("CASH");
    setPaymentMethod("CASH");
    setDiscountInput("0");
    setPaidAmountInput("0");
    setPaidAmountEdited(false);
  }

  // ==========================================
  // REVIEW
  // ==========================================

  function startReview() {
    if (items.length === 0) {
      setError("اختار منتج واحد على الأقل");
      return;
    }

    const hasInvalidStock = items.some((item) => {
      const product = productById.get(item.productId);

      return !product || item.quantity > product.stock;
    });

    if (hasInvalidStock) {
      setError(
        "بعض الكميات لم تعد متاحة. راجع المخزون قبل إتمام البيع."
      );
      return;
    }

    setError("");
    setStage("REVIEW");
  }

  // ==========================================
  // SUBMIT SALE
  // ==========================================

  function submitSale(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (pending || items.length === 0) return;

    setError("");

    if (hasInvalidDiscount) {
      setError(
        "قيمة الخصم غير صحيحة أو أكبر من إجمالي المنتجات"
      );
      return;
    }

    if (
      paymentType !== "CASH" &&
      !selectedCustomer
    ) {
      setError("اختر عميلًا للبيع الآجل أو الجزئي");
      return;
    }

    if (
      !Number.isFinite(parsedPaidAmount) ||
      parsedPaidAmount < 0 ||
      parsedPaidAmount > total
    ) {
      setError(
        "المبلغ المدفوع يجب أن يكون من صفر إلى صافي الفاتورة بعد الخصم"
      );
      return;
    }

    if (
      paymentType !== "CASH" &&
      paidAmountInput.trim() === ""
    ) {
      setError("اكتب المبلغ المدفوع فعليًا");
      return;
    }

    if (
      paymentType === "HALF_CREDIT" &&
      !(parsedPaidAmount > 0 && parsedPaidAmount < total)
    ) {
      setError(
        "في حالة نصف آجل، يجب أن يكون المدفوع أكبر من صفر وأقل من صافي الفاتورة"
      );
      return;
    }

    const receiptItems = items.map((item) => ({
      ...item,
    }));

    const customerName =
      selectedCustomer?.name ?? "بدون عميل";

    startTransition(async () => {
      try {
        const result = await createInvoice({
          customerId: customerId
            ? Number(customerId)
            : null,
          paymentType,
          paymentMethod: roundedPaidAmount > 0 ? paymentMethod : null,
          discount: roundedDiscount,
          paidAmount: roundedPaidAmount,
          items: receiptItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setReceipt({
          invoiceId: result.invoiceId,
          customer: customerName,
          note,
          items: receiptItems,
          subtotal: result.total + result.discount,
          discount: result.discount,
          total: result.total,
          date: new Date().toLocaleString("en-GB"),
          paymentType,
          paymentMethod: result.paymentMethod,
          paidAmount: result.paidAmount,
          remaining: result.remaining,
        });

        resetSale();
        setStage("DONE");
        setAutoPrint(true);
      } catch {
        setError(
          "حدث خطأ أثناء تسجيل البيع. حاول مرة أخرى."
        );
      }
    });
  }

  // ==========================================
  // PRINT
  // ==========================================

  function printDocument() {
    window.print();
  }

  function newSale() {
    setReceipt(null);
    setStage("SELECT");
    setError("");
  }

  const printable: Receipt | null =
    receipt ??
    (stage === "REVIEW"
      ? {
          invoiceId: 0,
          customer: selectedCustomer?.name ?? "بدون عميل",
          note,
          items,
          subtotal,
          discount: roundedDiscount,
          total,
          date: new Date().toLocaleString("en-GB"),
          paymentType,
          paymentMethod: roundedPaidAmount > 0 ? paymentMethod : null,
          paidAmount: roundedPaidAmount,
          remaining,
        }
      : null);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="w-full min-w-0">

      {/* Operational interface */}
      <div className="min-w-0 space-y-4 pb-28 sm:space-y-5 sm:pb-0 print:hidden">

        {/* ================================== */}
        {/* PRODUCT SELECTION */}
        {/* ================================== */}

        {stage === "SELECT" && (
          <>
            <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
              <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Package className="h-5 w-5" />
                  </span>

                  <div className="min-w-0">
                    <h3 className="font-extrabold text-gray-900">
                      اختيار المنتجات
                    </h3>

                    <p className="mt-1 text-[11px] leading-5 text-gray-500 sm:text-xs">
                      اضغط على المنتج لإضافته إلى سلة البيع
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 sm:px-3 sm:text-xs">
                  بيع مباشر
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="ابحث عن منتج بالاسم..."
                  aria-label="البحث عن منتج"
                  className={`${ui.input} min-h-12 w-full pe-10`}
                />
              </div>

              {/* Products grid */}
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 xl:grid-cols-3 sm:gap-3">
                {visibleProducts.map((product) => {
                  const quantity =
                    quantities[product.id] ?? 0;

                  const outOfStock = product.stock <= 0;
                  const maxed = quantity >= product.stock;

                  return (
                    <article
                      key={product.id}
                      className={`flex min-w-0 flex-col justify-between rounded-xl border p-3 transition ${
                        quantity > 0
                          ? "border-blue-400 bg-blue-50/60 ring-1 ring-blue-100"
                          : "border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={outOfStock || maxed}
                        onClick={() =>
                          changeQuantity(product, 1)
                        }
                        className="w-full min-w-0 text-right disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <p className="min-w-0 break-words text-sm font-bold leading-5 text-gray-900">
                            {product.name}
                          </p>

                          {quantity > 0 && (
                            <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-bold text-white">
                              {quantity}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="break-all text-base font-extrabold text-blue-700 sm:text-lg">
                            {formatMoney(product.price)}
                          </p>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                              outOfStock
                                ? "bg-red-100 text-red-700"
                                : product.stock <= 5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {outOfStock
                              ? "نفد المخزون"
                              : `متاح ${product.stock}`}
                          </span>
                        </div>
                      </button>

                      {quantity > 0 && (
                        <div className="mt-3 flex min-h-10 items-center justify-between gap-2 border-t border-gray-200 pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(product, -1)
                            }
                            aria-label={`تقليل كمية ${product.name}`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-100"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <span className="text-sm font-extrabold text-gray-900">
                            {quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(product, 1)
                            }
                            disabled={maxed}
                            aria-label={`زيادة كمية ${product.name}`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {maxed && quantity > 0 && (
                        <p className="mt-2 text-center text-[10px] font-medium text-amber-700">
                          وصلت للكمية المتاحة
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>

              {visibleProducts.length === 0 && (
                <div className="py-10 text-center">
                  <Package className="mx-auto h-9 w-9 text-gray-300" />

                  <p className="mt-3 text-sm font-semibold text-gray-600">
                    {products.length === 0
                      ? "لا توجد منتجات متاحة للبيع حاليًا"
                      : "لا توجد منتجات مطابقة للبحث"}
                  </p>
                </div>
              )}
            </section>

            {/* Customer details */}
            <section className={`${ui.card} min-w-0 space-y-3`}>
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-gray-500" />

                <div>
                  <h3 className="font-bold text-gray-900">
                    بيانات العميل
                  </h3>

                  <p className="mt-1 text-[11px] leading-5 text-gray-500 sm:text-xs">
                    اختيار العميل اختياري، لكنه مطلوب لمتابعة المديونية والتحصيلات.
                  </p>
                </div>
              </div>

              <select
                value={customerId}
                onChange={(event) =>
                  setCustomerId(event.target.value)
                }
                aria-label="اختيار العميل"
                className={`${ui.input} min-h-12 w-full`}
              >
                <option value="">بدون عميل</option>

                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                ))}
              </select>

              <textarea
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                maxLength={300}
                rows={2}
                placeholder="ملاحظة على عملية البيع (اختياري)"
                aria-label="ملاحظة على عملية البيع"
                className={`${ui.input} min-h-20 w-full resize-y`}
              />
            </section>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 sm:text-sm"
              >
                {error}
              </p>
            )}

            {/* Mobile checkout bar */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl sm:hidden">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">
                    {itemCount} قطعة · {items.length} صنف
                  </p>

                  <p className="break-all text-xl font-extrabold text-gray-900">
                    {formatMoney(total)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={startReview}
                  className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  متابعة البيع
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Desktop checkout summary */}
            <div className="hidden items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex">
              <div>
                <p className="text-sm text-gray-500">
                  {itemCount} قطعة · {items.length} صنف
                </p>

                <p className="mt-1 text-2xl font-extrabold text-gray-900">
                  {formatMoney(total)}
                </p>
              </div>

              <button
                type="button"
                disabled={items.length === 0}
                onClick={startReview}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                متابعة البيع
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ================================== */}
        {/* INVOICE REVIEW */}
        {/* ================================== */}

        {stage === "REVIEW" && (
          <form
            onSubmit={submitSale}
            className="min-w-0 space-y-4"
          >
            <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
              {/* Review header */}
              <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 sm:mb-5">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 sm:text-xl">
                    مراجعة البيع
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                    راجع الأصناف والدفع قبل إصدار الفاتورة
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700 sm:text-xs">
                  قبل التأكيد
                </span>
              </div>

              {/* Customer */}
              <div className="mb-4 flex min-w-0 items-start gap-3 rounded-xl bg-gray-50 p-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">
                    العميل
                  </p>

                  <p className="mt-1 break-words text-sm font-bold text-gray-900">
                    {selectedCustomer?.name ?? "بدون عميل"}
                  </p>
                </div>
              </div>

              {/* Mobile review cards */}
              <div className="mb-5 space-y-2 md:hidden">
                <h3 className="text-xs font-bold text-gray-600">
                  أصناف الفاتورة ({items.length})
                </h3>

                {items.map((item, index) => (
                  <div
                    key={item.productId}
                    className="min-w-0 rounded-xl border border-gray-200 p-3"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                        {index + 1}
                      </span>

                      <p className="min-w-0 flex-1 break-words text-sm font-bold leading-6 text-gray-900">
                        {item.name}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="min-w-0 rounded-lg bg-gray-50 p-2">
                        <p className="text-[10px] text-gray-400">
                          الكمية
                        </p>

                        <p className="mt-1 text-sm font-bold text-gray-800">
                          {item.quantity}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-lg bg-gray-50 p-2">
                        <p className="text-[10px] text-gray-400">
                          سعر الوحدة
                        </p>

                        <p className="mt-1 break-all text-xs font-bold text-gray-800" dir="ltr">
                          {formatMoney(item.unitPrice)}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-lg bg-blue-50 p-2">
                        <p className="text-[10px] text-blue-500">
                          الإجمالي
                        </p>

                        <p className="mt-1 break-all text-xs font-extrabold text-blue-700" dir="ltr">
                          {formatMoney(
                            item.quantity * item.unitPrice
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop review table */}
              <div className="mb-6 hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
                <table className="w-full min-w-[500px] text-right text-sm">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="px-3 py-3 font-semibold">
                        المنتج
                      </th>

                      <th className="px-3 py-3 font-semibold">
                        الكمية
                      </th>

                      <th className="px-3 py-3 font-semibold">
                        سعر الوحدة
                      </th>

                      <th className="px-3 py-3 font-semibold">
                        الإجمالي
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr key={item.productId}>
                        <td className="px-3 py-3 font-medium text-gray-900">
                          {item.name}
                        </td>

                        <td className="px-3 py-3">
                          {item.quantity}
                        </td>

                        <td className="px-3 py-3">
                          {formatMoney(item.unitPrice)}
                        </td>

                        <td className="px-3 py-3 font-semibold">
                          {formatMoney(
                            item.quantity * item.unitPrice
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Discount section */}
              <div className="mb-4 min-w-0 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-amber-700" />
                  <label
                    htmlFor="rep-discount"
                    className="text-sm font-bold text-gray-800"
                  >
                    الخصم على الفاتورة
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="rep-discount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    value={discountInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDiscountInput(nextValue);

                      // حدّث اقتراح الدفعة تلقائيًا ما دام المستخدم لم يخصصها بنفسه.
                      const nextDiscount = Number(nextValue);
                      const nextDiscountCents = Math.round(nextDiscount * 100);
                      if (
                        !paidAmountEdited &&
                        paymentType !== "CASH" &&
                        nextValue.trim() !== "" &&
                        Number.isFinite(nextDiscount) &&
                        nextDiscount >= 0 &&
                        nextDiscountCents <= subtotalCents
                      ) {
                        const nextTotal =
                          (subtotalCents - nextDiscountCents) / 100;
                        setPaidAmountInput(
                          paymentType === "CREDIT"
                            ? "0"
                            : (nextTotal / 2).toFixed(2)
                        );
                      }
                    }}
                    placeholder="0.00"
                    aria-invalid={hasInvalidDiscount}
                    className={`${ui.input} min-h-12 w-full bg-white text-lg font-bold`}
                    dir="ltr"
                  />
                </div>

                <p className="mt-2 text-[11px] leading-5 text-gray-500 sm:text-xs">
                  اكتب قيمة الخصم، ولا يمكن أن تتجاوز إجمالي المنتجات.
                </p>

                {hasInvalidDiscount && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
                    أدخل خصمًا صحيحًا من صفر وحتى {formatMoney(subtotal)}.
                  </p>
                )}
              </div>

              {/* Payment section */}
              <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-700" />

                  <label
                    htmlFor="rep-payment-type"
                    className="text-sm font-bold text-gray-800"
                  >
                    نوع السداد
                  </label>
                </div>

                <select
                  id="rep-payment-type"
                  value={paymentType}
                  onChange={(event) => {
                    const nextType =
                      event.target.value as PaymentType;

                    setPaymentType(nextType);
                    setPaidAmountEdited(false);

                    if (nextType === "CASH") {
                      setPaidAmountInput(total.toFixed(2));
                    } else if (nextType === "CREDIT") {
                      setPaidAmountInput("0");
                    } else {
                      setPaidAmountInput(
                        (total / 2).toFixed(2)
                      );
                    }
                  }}
                  className={`${ui.input} min-h-12 w-full bg-white`}
                >
                  <option value="CASH">كاش كامل</option>
                  <option value="HALF_CREDIT">
                    نصف كاش والباقي آجل
                  </option>
                  <option value="CREDIT">
                    آجل كامل أو دفعة مقدمة
                  </option>
                </select>

                {paymentType !== "CASH" && (
                  <div className="mt-4 min-w-0">
                    <label
                      htmlFor="rep-paid-amount"
                      className="mb-1.5 block text-xs font-bold text-gray-800 sm:text-sm"
                    >
                      المبلغ المدفوع فعليًا
                    </label>

                    <input
                      id="rep-paid-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={total}
                      step="0.01"
                      value={paidAmountInput}
                      onChange={(event) => {
                        setPaidAmountEdited(true);
                        setPaidAmountInput(event.target.value);
                      }}
                      placeholder="اكتب المبلغ المستلم"
                      className={`${ui.input} min-h-12 w-full bg-white text-lg font-bold`}
                      dir="ltr"
                    />

                    <p className="mt-2 text-[11px] leading-5 text-gray-500 sm:text-xs">
                      {paymentType === "HALF_CREDIT"
                        ? "يُقترح نصف الإجمالي تلقائيًا، ويمكنك تغييره حسب المبلغ الذي استلمته."
                        : "سجل أي دفعة مقدمة استلمتها، أو اترك المبلغ صفرًا إذا لم تستلم شيئًا."}
                    </p>
                  </div>
                )}

                {/* Collection method: how the received amount was paid */}
                {Number.isFinite(parsedPaidAmount) && parsedPaidAmount > 0 && parsedPaidAmount <= total && (
                  <div className="mt-4 min-w-0">
                    <label
                      htmlFor="rep-payment-method"
                      className="mb-1.5 block text-xs font-bold text-gray-800 sm:text-sm"
                    >
                      وسيلة التحصيل
                    </label>

                    <select
                      id="rep-payment-method"
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as PaymentMethod)
                      }
                      className={`${ui.input} min-h-12 w-full bg-white`}
                    >
                      <option value="CASH">كاش</option>
                      <option value="WALLET">محفظة إلكترونية</option>
                      <option value="TRANSFER">تحويل بنكي</option>
                    </select>

                    <p className="mt-2 text-[11px] leading-5 text-gray-500 sm:text-xs">
                      اختر الوسيلة التي استلمت بها المبلغ المدفوع الآن.
                    </p>
                  </div>
                )}

                {/* Payment summary */}
                <div className="mt-4 space-y-3 border-t border-emerald-100 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">
                      إجمالي المنتجات
                    </span>

                    <strong className="break-all text-gray-900" dir="ltr">
                      {formatMoney(subtotal)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">
                      الخصم
                    </span>

                    <strong className="break-all text-amber-700" dir="ltr">
                      -{formatMoney(roundedDiscount)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-emerald-100 pt-3">
                    <span className="font-bold text-gray-800">
                      صافي الفاتورة بعد الخصم
                    </span>

                    <strong className="break-all text-lg text-gray-900" dir="ltr">
                      {formatMoney(total)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">
                      المدفوع الآن
                    </span>

                    <strong className="break-all text-emerald-700" dir="ltr">
                      {Number.isFinite(parsedPaidAmount)
                        ? formatMoney(roundedPaidAmount)
                        : "0.00"}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-emerald-100 pt-3">
                    <span className="font-bold text-gray-800">
                      المتبقي على العميل
                    </span>

                    <strong className="break-all text-lg text-red-600" dir="ltr">
                      {Number.isFinite(parsedPaidAmount)
                        ? formatMoney(remaining)
                        : "0.00"}
                    </strong>
                  </div>
                </div>
              </div>

              {note && (
                <p className="mt-4 break-words rounded-xl bg-gray-50 p-3 text-xs leading-6 text-gray-600 sm:text-sm">
                  <strong>ملاحظة: </strong>
                  {note}
                </p>
              )}
            </section>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 sm:text-sm"
              >
                {error}
              </p>
            )}

            <p className="text-center text-[11px] leading-5 text-gray-500 sm:text-xs">
              طباعة المسودة لا تحفظ الفاتورة ولا تخصم المخزون. البيع يتم فعليًا بعد تأكيد الإصدار.
            </p>

            {/* Review actions */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError("");
                  setStage("SELECT");
                }}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2 py-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                رجوع للتعديل
              </button>

              <button
                type="button"
                onClick={printDocument}
                disabled={hasInvalidDiscount}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2 py-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                <Printer className="h-4 w-4" />
                طباعة Draft
              </button>
            </div>

            <button
              type="submit"
              disabled={pending || hasInvalidPayment}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              <CheckCircle2 className="h-5 w-5" />

              {pending
                ? "جاري تسجيل البيع..."
                : "تأكيد البيع وإصدار الفاتورة"}
            </button>
          </form>
        )}

        {/* ================================== */}
        {/* SALE COMPLETE */}
        {/* ================================== */}

        {stage === "DONE" && receipt && (
          <section className="min-w-0 rounded-2xl border border-emerald-200 bg-white p-4 text-center shadow-sm sm:p-7">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 sm:h-16 sm:w-16">
              <CheckCircle2 className="h-8 w-8 sm:h-9 sm:w-9" />
            </div>

            <h2 className="mt-4 text-lg font-extrabold text-gray-900 sm:text-xl">
              تم البيع وإصدار الفاتورة بنجاح
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              رقم الفاتورة #{receipt.invoiceId}
            </p>

            <p className="mt-3 break-all text-3xl font-extrabold text-gray-900 sm:text-4xl">
              {formatMoney(receipt.total)}
            </p>

            <div className="mx-auto mt-5 max-w-sm space-y-3 rounded-xl bg-gray-50 p-3 text-xs sm:p-4 sm:text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">
                  إجمالي المنتجات
                </span>
                <strong className="break-all text-gray-800" dir="ltr">
                  {formatMoney(receipt.subtotal)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-gray-500">
                  الخصم
                </span>
                <strong className="break-all text-amber-700" dir="ltr">
                  -{formatMoney(receipt.discount)}
                </strong>
              </div>

              <div className="flex justify-between gap-3 border-t border-gray-200 pt-3">
                <span className="font-semibold text-gray-700">
                  الصافي بعد الخصم
                </span>
                <strong className="break-all text-gray-900" dir="ltr">
                  {formatMoney(receipt.total)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-gray-500">
                  نوع السداد
                </span>

                <strong className="text-left text-gray-800">
                  {paymentTypeLabel(receipt.paymentType)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-gray-500">
                  وسيلة التحصيل
                </span>

                <strong className="text-left text-gray-800">
                  {paymentMethodLabel(receipt.paymentMethod)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-gray-500">
                  المدفوع
                </span>

                <strong className="break-all text-emerald-700" dir="ltr">
                  {formatMoney(receipt.paidAmount)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-gray-500">
                  المتبقي
                </span>

                <strong className="break-all text-red-600" dir="ltr">
                  {formatMoney(receipt.remaining)}
                </strong>
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={printDocument}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                طباعة الفاتورة
              </button>

              <button
                type="button"
                onClick={newSale}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <ShoppingCart className="h-4 w-4" />
                بيع جديد
              </button>
            </div>
          </section>
        )}
      </div>

      {/* ================================== */}
      {/* PRINTABLE DRAFT / FINAL INVOICE */}
      {/* ================================== */}

      {printable && (
        <div
          className="hidden bg-white p-6 text-black print:block"
          dir="rtl"
        >
          <div className="mx-auto max-w-2xl">
            <header className="border-b-2 border-black pb-4 text-center">
              <h1 className="text-2xl font-bold">
                نظام إدارة المخزون والمبيعات
              </h1>

              <h2 className="mt-3 text-xl font-bold">
                {receipt ? "فاتورة بيع" : "مسودة فاتورة بيع"}
              </h2>

              {!receipt && (
                <p className="mt-2 inline-block border border-dashed border-gray-600 px-4 py-2 text-sm font-bold">
                  مسودة فقط - غير نهائية
                </p>
              )}
            </header>

            <div className="my-5 space-y-2 text-sm">
              <p>
                <strong>رقم الفاتورة:</strong>{" "}
                {printable.invoiceId > 0
                  ? `#${printable.invoiceId}`
                  : "لم تصدر بعد"}
              </p>

              <p>
                <strong>العميل:</strong>{" "}
                {printable.customer}
              </p>

              <p>
                <strong>التاريخ:</strong>{" "}
                {printable.date}
              </p>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y-2 border-black">
                  <th className="py-3 text-right">
                    المنتج
                  </th>

                  <th className="py-3 text-center">
                    الكمية
                  </th>

                  <th className="py-3 text-center">
                    السعر
                  </th>

                  <th className="py-3 text-left">
                    الإجمالي
                  </th>
                </tr>
              </thead>

              <tbody>
                {printable.items.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-b border-gray-300"
                  >
                    <td className="py-3">
                      {item.name}
                    </td>

                    <td className="py-3 text-center">
                      {item.quantity}
                    </td>

                    <td className="py-3 text-center">
                      {formatMoney(item.unitPrice)}
                    </td>

                    <td className="py-3 text-left">
                      {formatMoney(
                        item.quantity * item.unitPrice
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 space-y-3 border-t-2 border-black pt-4 text-sm">
              <p>
                <strong>إجمالي المنتجات:</strong>{" "}
                {formatMoney(printable.subtotal)}
              </p>

              <p>
                <strong>الخصم:</strong>{" "}
                -{formatMoney(printable.discount)}
              </p>

              <p className="text-lg font-extrabold">
                صافي الفاتورة بعد الخصم: {formatMoney(printable.total)}
              </p>

              <p>
                <strong>نوع السداد:</strong>{" "}
                {paymentTypeLabel(printable.paymentType)}
              </p>

              <p>
                <strong>وسيلة التحصيل:</strong>{" "}
                {paymentMethodLabel(printable.paymentMethod)}
              </p>

              <p>
                <strong>المدفوع:</strong>{" "}
                {formatMoney(printable.paidAmount)}
              </p>

              <p>
                <strong>المتبقي:</strong>{" "}
                {formatMoney(printable.remaining)}
              </p>
            </div>

            {printable.note && (
              <p className="mt-5 text-sm">
                <strong>ملاحظات:</strong>{" "}
                {printable.note}
              </p>
            )}

            <p className="mt-12 border-t pt-4 text-center text-xs">
              شكراً لتعاملكم معنا
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
