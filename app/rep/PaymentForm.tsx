
"use client";

import { useId, useState, useTransition } from "react";
import {
  Wallet,
  ReceiptText,
  CheckCircle2,
  AlertCircle,
  Banknote,
  FileText,
} from "lucide-react";

import { createPayment } from "./payment-actions";

type InvoiceOption = {
  id: number;
  total: number;
  paidAmount: number;
  customerName: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export default function PaymentForm({
  invoices,
}: {
  invoices: InvoiceOption[];
}) {
  const uid = useId();

  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [pending, startTransition] = useTransition();

  const selected = invoices.find(
    (inv) => String(inv.id) === invoiceId
  );

  const remaining = selected
    ? Math.max(
        0,
        round2(selected.total - selected.paidAmount)
      )
    : 0;

  const amountNum = Number(amount);

  const validAmount =
    amount.trim() !== "" &&
    Number.isFinite(amountNum) &&
    amountNum > 0;

  const tooMuch =
    !!selected &&
    validAmount &&
    amountNum > remaining;

  function submit() {
    setMessage(null);

    if (!selected || !validAmount) {
      setMessage({
        ok: false,
        text: "اختر الفاتورة وأدخل مبلغًا صحيحًا",
      });
      return;
    }

    if (tooMuch) {
      setMessage({
        ok: false,
        text: `المبلغ أكبر من المتبقي (${money(remaining)})`,
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await createPayment({
          invoiceId: Number(invoiceId),
          amount: amountNum,
          note,
        });

        if (!result.ok) {
          setMessage({
            ok: false,
            text: result.error,
          });
          return;
        }

        setMessage({
          ok: true,
          text: `تم تسجيل التحصيل بنجاح. المدفوع: ${money(
            result.paidAmount
          )}، المتبقي: ${money(result.remaining)}`,
        });

        setAmount("");
        setNote("");
        setInvoiceId("");
      } catch {
        setMessage({
          ok: false,
          text: "حدث خطأ أثناء تسجيل التحصيل. حاول مرة أخرى.",
        });
      }
    });
  }

  return (
    <section
      dir="rtl"
      className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5"
    >
      {/* Header */}
      <div className="mb-5 flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-11 sm:w-11">
          <Wallet className="h-5 w-5" />
        </span>

        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-gray-900 sm:text-lg">
            تسجيل تحصيل من عميل
          </h3>

          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            اختر فاتورة عليها مبلغ متبقٍ وسجّل المبلغ المستلم.
          </p>
        </div>
      </div>

      {/* No invoices */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-8 text-center sm:py-10">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />

          <p className="mt-3 text-sm font-bold text-emerald-800">
            لا توجد فواتير عليها مبالغ مستحقة حاليًا
          </p>

          <p className="mt-1 text-xs text-emerald-700">
            جميع الفواتير مسددة.
          </p>
        </div>
      ) : (
        <div className="min-w-0 space-y-4">

          {/* Invoice selector */}
          <div className="min-w-0">
            <label
              htmlFor={`${uid}-invoice`}
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              الفاتورة والعميل
            </label>

            <div className="relative">
              <ReceiptText className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <select
                id={`${uid}-invoice`}
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  setAmount("");
                  setMessage(null);
                }}
                className="min-h-12 w-full min-w-0 rounded-xl border border-gray-300 bg-white py-3 pe-10 ps-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">اختر الفاتورة</option>

                {invoices.map((invoice) => (
                  <option
                    key={invoice.id}
                    value={invoice.id}
                  >
                    فاتورة #{invoice.id} - {invoice.customerName} - متبقٍ{" "}
                    {money(
                      round2(
                        invoice.total - invoice.paidAmount
                      )
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected invoice details */}
          {selected && (
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />

                <p className="min-w-0 break-words text-sm font-bold text-gray-800">
                  تفاصيل الفاتورة #{selected.id}
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    إجمالي الفاتورة
                  </p>

                  <p
                    className="mt-2 break-all text-lg font-extrabold text-gray-900"
                    dir="ltr"
                  >
                    {money(selected.total)}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <p className="text-xs text-emerald-700">
                    المدفوع
                  </p>

                  <p
                    className="mt-2 break-all text-lg font-extrabold text-emerald-700"
                    dir="ltr"
                  >
                    {money(selected.paidAmount)}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-red-100 bg-red-50/60 p-3">
                  <p className="text-xs text-red-700">
                    المتبقي
                  </p>

                  <p
                    className="mt-2 break-all text-lg font-extrabold text-red-700"
                    dir="ltr"
                  >
                    {money(remaining)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="min-w-0">
            <label
              htmlFor={`${uid}-amount`}
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              المبلغ المستلم
            </label>

            <div className="relative">
              <Banknote className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

              <input
                id={`${uid}-amount`}
                type="number"
                min="0.01"
                max={remaining || undefined}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setMessage(null);
                }}
                placeholder="أدخل المبلغ"
                aria-invalid={tooMuch}
                aria-describedby={
                  tooMuch ? `${uid}-amount-err` : undefined
                }
                className={`min-h-12 w-full min-w-0 rounded-xl border bg-white py-3 pe-10 ps-3 text-lg font-semibold text-gray-900 outline-none transition focus:ring-2 ${
                  tooMuch
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                }`}
                dir="ltr"
              />
            </div>

            {tooMuch && (
              <p
                id={`${uid}-amount-err`}
                className="mt-2 flex items-center gap-1.5 text-xs text-red-600"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />

                المبلغ أكبر من المتبقي ({money(remaining)})
              </p>
            )}

            {selected && (
              <button
                type="button"
                onClick={() => {
                  setAmount(remaining.toFixed(2));
                  setMessage(null);
                }}
                disabled={remaining <= 0}
                className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                تحصيل كامل المتبقي
              </button>
            )}
          </div>

          {/* Note */}
          <div className="min-w-0">
            <label
              htmlFor={`${uid}-note`}
              className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
            >
              ملاحظة (اختياري)
            </label>

            <input
              id={`${uid}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="مثال: تحصيل نقدي من العميل"
              className="min-h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={submit}
            disabled={
              pending ||
              !selected ||
              !validAmount ||
              tooMuch
            }
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
          >
            <CheckCircle2 className="h-5 w-5" />

            {pending
              ? "جارٍ تسجيل التحصيل..."
              : "تأكيد التحصيل"}
          </button>
        </div>
      )}

      {/* Result message */}
      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          className={`mt-4 flex min-w-0 items-start gap-2 rounded-xl border p-3 text-xs leading-6 sm:text-sm ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.ok ? (
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
          )}

          <span className="min-w-0 break-words">
            {message.text}
          </span>
        </div>
      )}
    </section>
  );
}
