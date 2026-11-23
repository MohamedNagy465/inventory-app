
"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createInvoice } from "./actions";
import { getCustomerBalance } from "./customer-actions";
import { printDraftInvoice } from "./print-draft";
import { ui } from "../../lib/ui";

type Product = { id: number; name: string; price: number; stock: number };
type Customer = { id: number; name: string };
type Line = { key: number; productId: string; quantity: string };
type PayMode = "cash" | "credit" | "partial";

const money = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;

const PAY_OPTIONS: readonly (readonly [PayMode, string])[] = [
  ["cash", "كاش"],
  ["credit", "آجل"],
  ["partial", "نص آجل"],
];

export default function InvoiceForm({
  products,
  customers,
}: {
  products: Product[];
  customers: Customer[];
}) {
  const uid = useId();
  const nextKey = useRef(1);
  const submitting = useRef(false);

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { key: 0, productId: "", quantity: "1" },
  ]);
  const [discount, setDiscount] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [paid, setPaid] = useState("");
  const [balance, setBalance] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; amount: number }
    | { status: "error" }
  >({ status: "idle" });
  const [result, setResult] = useState<{
    ok: boolean;
    text: string;
    invoiceId?: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [String(p.id), p]));
  const chosen = new Set(lines.map((l) => l.productId).filter(Boolean));

  // مستحقات العميل المختار
  useEffect(() => {
    if (!customerId) {
      setBalance({ status: "idle" });
      return;
    }

    let cancelled = false;
    setBalance({ status: "loading" });

    getCustomerBalance(Number(customerId))
      .then((r) => {
        if (cancelled) return;

        setBalance(
          r.ok
            ? { status: "ready", amount: r.balance }
            : { status: "error" }
        );
      })
      .catch(() => {
        if (!cancelled) setBalance({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  function lineError(line: Line): string | null {
    const product = byId.get(line.productId);
    if (!product) return null;

    const qty = Number(line.quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      return "أدخل كمية صحيحة";
    }

    if (qty > product.stock) {
      return `المتاح ${product.stock} فقط`;
    }

    return null;
  }

  const validLines = lines.filter(
    (l) => byId.has(l.productId) && lineError(l) === null
  );

  const hasInvalid = lines.some(
    (l) => l.productId && lineError(l) !== null
  );

  const subtotal = validLines.reduce(
    (sum, l) =>
      sum +
      (byId.get(l.productId)?.price ?? 0) *
        Number(l.quantity),
    0
  );

  const discountNum = round2(Number(discount) || 0);

  const discountError =
    discountNum < 0
      ? "الخصم غير صحيح"
      : discountNum > subtotal
      ? "الخصم أكبر من مجموع الفاتورة"
      : null;

  const appliedDiscount = discountError ? 0 : discountNum;
  const net = Math.max(0, round2(subtotal - appliedDiscount));

  // كاش: يدفع الكل، آجل: لا يدفع شيئًا، نص آجل: مبلغ يحدده المدير
  const paidInput = round2(Number(paid) || 0);

  const paidNum =
    payMode === "cash"
      ? net
      : payMode === "credit"
      ? 0
      : paidInput;

  const remaining = Math.max(0, round2(net - paidNum));

  const payError =
    validLines.length === 0
      ? null
      : payMode !== "cash" && !customerId
      ? "اختر عميلًا للبيع الآجل"
      : payMode === "partial" && !(paidNum > 0 && paidNum < net)
      ? "المبلغ المدفوع يجب أن يكون أكبر من صفر وأقل من الإجمالي"
      : null;

  const payLabel =
    payMode === "cash"
      ? "كاش"
      : payMode === "credit"
      ? "آجل"
      : "نص آجل";

  const canSubmit =
    validLines.length > 0 &&
    !hasInvalid &&
    !discountError &&
    !payError;

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
    setResult(null);
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        productId: "",
        quantity: "1",
      },
    ]);
  }

  function removeLine(key: number) {
    setLines((prev) =>
      prev.length === 1
        ? [
            {
              key: nextKey.current++,
              productId: "",
              quantity: "1",
            },
          ]
        : prev.filter((l) => l.key !== key)
    );
  }

  function resetForm() {
    setCustomerId("");
    setLines([
      {
        key: nextKey.current++,
        productId: "",
        quantity: "1",
      },
    ]);
    setDiscount("");
    setPayMode("cash");
    setPaid("");
  }

  function save() {
    if (submitting.current) return;

    setResult(null);

    if (validLines.length === 0 || hasInvalid) {
      setResult({
        ok: false,
        text: "أضف منتجًا واحدًا على الأقل بكميات صحيحة",
      });
      return;
    }

    if (discountError) {
      setResult({ ok: false, text: discountError });
      return;
    }

    if (payError) {
      setResult({ ok: false, text: payError });
      return;
    }

    submitting.current = true;

    startTransition(async () => {
      try {
        const r = await createInvoice({
          customerId: customerId ? Number(customerId) : null,
          discount: discountNum,
          paymentType:
            payMode === "cash"
              ? "CASH"
              : payMode === "credit"
              ? "CREDIT"
              : "HALF_CREDIT",
          paidAmount: paidNum,
          items: validLines.map((l) => ({
            productId: Number(l.productId),
            quantity: Number(l.quantity),
          })),
        });

        if (!r.ok) {
          setResult({ ok: false, text: r.error });
          return;
        }

        setResult({
          ok: true,
          text: `تم حفظ الفاتورة #${r.invoiceId} · الإجمالي ${money(r.total)}`,
          invoiceId: r.invoiceId,
        });

        resetForm();
      } catch {
        setResult({
          ok: false,
          text: "تعذر حفظ الفاتورة، حاول مرة أخرى",
        });
      } finally {
        submitting.current = false;
      }
    });
  }

  function printDraft() {
    if (validLines.length === 0) return;

    printDraftInvoice({
      customerName:
        customers.find((c) => String(c.id) === customerId)?.name ??
        "بدون عميل",
      payLabel,
      lines: validLines.map((l) => {
        const p = byId.get(l.productId)!;

        return {
          name: p.name,
          quantity: Number(l.quantity),
          price: p.price,
        };
      }),
      subtotal,
      discount: appliedDiscount,
      net,
      paid: paidNum,
      remaining,
    });
  }

  return (
    <div className="grid min-w-0 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

      {/* الأصناف */}
      <section className={`${ui.card} min-w-0 overflow-hidden`}>
        <div className="mb-4">
          <label
            htmlFor={`${uid}-customer`}
            className="mb-1.5 block text-sm font-semibold text-gray-700"
          >
            العميل
          </label>

          <select
            id={`${uid}-customer`}
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setResult(null);
            }}
            className={`${ui.input} w-full sm:max-w-sm`}
          >
            <option value="">بدون عميل</option>

            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {customerId && balance.status === "loading" && (
            <p className="mt-2 text-xs text-gray-400">
              جارٍ التحقق من مستحقات العميل...
            </p>
          )}

          {customerId &&
            balance.status === "ready" &&
            balance.amount > 0 && (
              <p className="mt-2 inline-block max-w-full rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 sm:text-sm">
                على العميل مبلغ مستحق:{" "}
                <strong>{money(balance.amount)}</strong>
              </p>
            )}

          {customerId &&
            balance.status === "ready" &&
            balance.amount <= 0 && (
              <p className="mt-2 text-xs text-green-700">
                لا توجد مستحقات على العميل
              </p>
            )}

          {customerId && balance.status === "error" && (
            <p className="mt-2 text-xs text-red-600">
              تعذر التحقق من مستحقات العميل.
            </p>
          )}
        </div>

        {/* Mobile product cards */}
        <div className="space-y-3 md:hidden">
          {lines.map((line, index) => {
            const product = byId.get(line.productId);
            const error = lineError(line);
            const lineTotal = product
              ? product.price * (Number(line.quantity) || 0)
              : 0;

            return (
              <div
                key={line.key}
                className="min-w-0 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-800">
                    المنتج رقم {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label={`حذف السطر ${index + 1}`}
                    className={`${ui.btnDanger} min-h-9 shrink-0 px-3`}
                  >
                    حذف
                  </button>
                </div>

                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  اختيار المنتج
                </label>

                <select
                  aria-label={`المنتج ${index + 1}`}
                  value={line.productId}
                  onChange={(e) =>
                    updateLine(line.key, {
                      productId: e.target.value,
                    })
                  }
                  className={`${ui.input} w-full min-w-0`}
                >
                  <option value="">اختر المنتج</option>

                  {products.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={
                        p.stock === 0 ||
                        (chosen.has(String(p.id)) &&
                          line.productId !== String(p.id))
                      }
                    >
                      {p.name}
                      {p.stock === 0
                        ? " (نفد)"
                        : ` (متاح ${p.stock})`}
                    </option>
                  ))}
                </select>

                {product && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-gray-50 p-2.5">
                      <p className="text-[11px] text-gray-400">
                        سعر الوحدة
                      </p>
                      <p
                        className="mt-1 text-sm font-bold text-gray-800"
                        dir="ltr"
                      >
                        {money(product.price)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-2.5">
                      <p className="text-[11px] text-gray-400">
                        المتاح بالمخزون
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-800">
                        {product.stock}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 items-start gap-3">
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">
                      الكمية
                    </label>

                    <input
                      aria-label={`الكمية ${index + 1}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={product?.stock}
                      step={1}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity: e.target.value,
                        })
                      }
                      aria-invalid={!!error}
                      className={`${ui.input} w-full text-center ${
                        error ? "border-red-400" : ""
                      }`}
                    />

                    {error && (
                      <p className="mt-1 text-[11px] leading-4 text-red-600">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1.5 text-xs font-medium text-gray-600">
                      إجمالي الصنف
                    </p>

                    <div className="flex min-h-10 items-center justify-end rounded-lg bg-blue-50 px-3">
                      <span
                        className="break-all text-sm font-extrabold text-blue-700"
                        dir="ltr"
                      >
                        {product && !error ? money(lineTotal) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop products table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-right">
            <thead className="bg-gray-50">
              <tr>
                <th className={ui.th}>المنتج</th>
                <th className={ui.th}>السعر</th>
                <th className={ui.th}>الكمية</th>
                <th className={ui.th}>الإجمالي</th>
                <th className={ui.th}>
                  <span className="sr-only">حذف</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {lines.map((line, index) => {
                const product = byId.get(line.productId);
                const error = lineError(line);
                const lineTotal = product
                  ? product.price * (Number(line.quantity) || 0)
                  : 0;

                return (
                  <tr key={line.key} className="align-top">
                    <td className={`${ui.td} w-[42%]`}>
                      <select
                        aria-label={`المنتج ${index + 1}`}
                        value={line.productId}
                        onChange={(e) =>
                          updateLine(line.key, {
                            productId: e.target.value,
                          })
                        }
                        className={`${ui.input} w-full`}
                      >
                        <option value="">اختر المنتج</option>

                        {products.map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={
                              p.stock === 0 ||
                              (chosen.has(String(p.id)) &&
                                line.productId !== String(p.id))
                            }
                          >
                            {p.name}
                            {p.stock === 0
                              ? " (نفد)"
                              : ` (متاح ${p.stock})`}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className={ui.td}>
                      {product ? money(product.price) : "-"}
                    </td>

                    <td className={ui.td}>
                      <input
                        aria-label={`الكمية ${index + 1}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={product?.stock}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: e.target.value,
                          })
                        }
                        aria-invalid={!!error}
                        className={`${ui.input} w-24 text-center ${
                          error ? "border-red-400" : ""
                        }`}
                      />

                      {error && (
                        <p className="mt-1 text-xs text-red-600">
                          {error}
                        </p>
                      )}
                    </td>

                    <td className={`${ui.td} font-semibold`}>
                      {product && !error ? money(lineTotal) : "-"}
                    </td>

                    <td className={ui.td}>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        aria-label={`حذف السطر ${index + 1}`}
                        className={ui.btnDanger}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLine}
          disabled={chosen.size >= products.length}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
        >
          + إضافة منتج
        </button>
      </section>

      {/* الملخص والدفع */}
      <aside className={`${ui.card} min-w-0 lg:sticky lg:top-24`}>
        <h2 className="mb-4 font-bold text-gray-800">
          ملخص الفاتورة
        </h2>

        {result && (
          <div
            role={result.ok ? "status" : "alert"}
            className={`mb-4 rounded-xl px-3 py-3 text-sm leading-6 ${
              result.ok
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <p>{result.text}</p>

            {result.ok && result.invoiceId && (
              <a
                href={`/invoices/${result.invoiceId}`}
                className="mt-1 inline-block font-bold underline"
              >
                فتح الفاتورة
              </a>
            )}
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-3 text-gray-500">
            <span>المجموع</span>
            <span className="font-medium text-gray-800" dir="ltr">
              {money(subtotal)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${uid}-discount`}
              className="text-gray-500"
            >
              الخصم
            </label>

            <input
              id={`${uid}-discount`}
              type="number"
              inputMode="decimal"
              min="0"
              max={subtotal}
              step="0.01"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
                setResult(null);
              }}
              placeholder="0.00"
              aria-invalid={!!discountError}
              className={`${ui.input} w-32 text-center`}
            />
          </div>

          {discountError && discount !== "" && (
            <p className="text-xs text-red-600">
              {discountError}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <span className="font-semibold text-gray-700">
              الإجمالي بعد الخصم
            </span>

            <span
              className="break-all text-xl font-extrabold text-gray-900 sm:text-2xl"
              dir="ltr"
            >
              {money(net)}
            </span>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold text-gray-500">
            طريقة الدفع
          </legend>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {PAY_OPTIONS.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setPayMode(mode);
                  setResult(null);
                }}
                aria-pressed={payMode === mode}
                className={`min-h-11 rounded-xl border px-1.5 py-2 text-xs font-semibold transition sm:px-2 sm:text-sm ${
                  payMode === mode
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {payMode === "partial" && (
            <div className="mt-3 flex min-w-0 gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max={net}
                step="0.01"
                value={paid}
                onChange={(e) => {
                  setPaid(e.target.value);
                  setResult(null);
                }}
                placeholder="المدفوع الآن"
                aria-label="المدفوع الآن"
                className={`${ui.input} min-w-0 flex-1`}
              />

              <button
                type="button"
                onClick={() => setPaid((net / 2).toFixed(2))}
                className="min-h-10 shrink-0 rounded-xl border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                النصف
              </button>
            </div>
          )}

          {validLines.length > 0 && (
            <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3 text-sm">
              <div className="flex justify-between gap-2 text-gray-500">
                <span>المدفوع الآن</span>
                <span className="font-semibold text-gray-900" dir="ltr">
                  {money(paidNum)}
                </span>
              </div>

              <div className="flex justify-between gap-2 text-gray-500">
                <span>المتبقي آجل</span>

                <span
                  className={
                    remaining > 0
                      ? "font-bold text-amber-700"
                      : "font-semibold text-gray-900"
                  }
                  dir="ltr"
                >
                  {money(remaining)}
                </span>
              </div>

              {customerId &&
                balance.status === "ready" &&
                remaining > 0 && (
                  <div className="flex justify-between gap-2 border-t border-gray-200 pt-2 text-gray-500">
                    <span className="min-w-0">
                      مستحق العميل بعد الفاتورة
                    </span>

                    <span
                      className="shrink-0 font-bold text-gray-900"
                      dir="ltr"
                    >
                      {money(balance.amount + remaining)}
                    </span>
                  </div>
                )}
            </div>
          )}

          {payError && (
            <p className="mt-2 text-xs leading-5 text-red-600">
              {payError}
            </p>
          )}
        </fieldset>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={save}
            disabled={pending || !canSubmit}
            className={`${ui.btn} min-h-12 w-full py-3 text-base`}
          >
            {pending ? "جارٍ الحفظ..." : "حفظ الفاتورة"}
          </button>

          <button
            type="button"
            onClick={printDraft}
            disabled={validLines.length === 0}
            className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            طباعة مسودة (DRAFT)
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="min-h-10 w-full text-xs font-medium text-gray-500 transition hover:text-gray-800"
          >
            مسح النموذج
          </button>
        </div>
      </aside>
    </div>
  );
}
