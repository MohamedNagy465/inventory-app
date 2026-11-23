
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createPayment,
} from "../rep/payment-actions";

import {
  FileText,
  User,
  Phone,
  CalendarDays,
  Wallet,
  CheckCircle2,
  Receipt,
} from "lucide-react";

type InvoiceOption = {
  id: number;
  date: string;
  total: number;
  paidAmount: number;
  customerName: string;
  customerPhone: string;
  repName: string;
  paymentType: string;
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPaymentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CASH: "نقدي",
    CREDIT: "آجل",
    HALF_CREDIT: "نصف آجل",
  };

  return labels[type] ?? type;
}

export default function PaymentForm({
  invoices,
}: {
  invoices: InvoiceOption[];
}) {
  const router = useRouter();

  const [invoiceList, setInvoiceList] = useState(invoices);

  const [selectedInvoiceId, setSelectedInvoiceId] =
    useState<number | null>(invoices[0]?.id ?? null);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedInvoice = invoiceList.find(
    (invoice) => invoice.id === selectedInvoiceId
  );

  const remaining = selectedInvoice
    ? Math.max(
        0,
        selectedInvoice.total - selectedInvoice.paidAmount
      )
    : 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedInvoice) {
      setError("اختار الفاتورة الأول");
      return;
    }

    const paymentAmount = Number(amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      setError("اكتب مبلغ تحصيل صحيح");
      return;
    }

    if (paymentAmount > remaining + 0.001) {
      setError(
        `المبلغ أكبر من المتبقي. المتبقي ${formatMoney(remaining)}`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createPayment({
        invoiceId: selectedInvoice.id,
        amount: paymentAmount,
        note,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const updatedInvoice = {
        ...selectedInvoice,
        paidAmount: result.paidAmount,
      };

      const nextInvoices =
        result.remaining <= 0.009
          ? invoiceList.filter(
              (invoice) => invoice.id !== selectedInvoice.id
            )
          : invoiceList.map((invoice) =>
              invoice.id === selectedInvoice.id
                ? updatedInvoice
                : invoice
            );

      setInvoiceList(nextInvoices);

      if (result.remaining <= 0.009) {
        setSelectedInvoiceId(nextInvoices[0]?.id ?? null);

        setSuccess(
          "تم تحصيل الفاتورة بالكامل بنجاح"
        );
      } else {
        setSuccess(
          `تم تسجيل التحصيل بنجاح. المتبقي ${formatMoney(result.remaining)}`
        );
      }

      setAmount("");
      setNote("");

      router.refresh();
    } catch {
      setError(
        "حصل خطأ أثناء تسجيل التحصيل. حاول مرة أخرى."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">

      {/* Invoice selector */}
      <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <FileText className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="font-bold text-gray-900">
              اختيار الفاتورة
            </h2>

            <p className="text-xs text-gray-500">
              {invoiceList.length} فاتورة مستحقة
            </p>
          </div>
        </div>

        <label
          htmlFor="invoice-select"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          اختر الفاتورة المطلوب تحصيلها
        </label>

        <select
          id="invoice-select"
          value={selectedInvoiceId ?? ""}
          onChange={(event) => {
            setSelectedInvoiceId(
              event.target.value
                ? Number(event.target.value)
                : null
            );

            setAmount("");
            setNote("");
            setError("");
            setSuccess("");
          }}
          className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:px-4"
        >
          {invoiceList.length === 0 ? (
            <option value="">
              لا توجد فواتير مستحقة
            </option>
          ) : (
            invoiceList.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                فاتورة #{invoice.id} - {invoice.customerName} - المتبقي{" "}
                {formatMoney(
                  invoice.total - invoice.paidAmount
                )}
              </option>
            ))
          )}
        </select>
      </section>

      {/* Feedback */}
      {success && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:p-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="break-words">{success}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
        >
          {error}
        </div>
      )}

      {/* All invoices paid */}
      {invoiceList.length === 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center sm:rounded-2xl sm:py-14">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </span>

          <h2 className="font-bold text-gray-900">
            لا توجد فواتير مستحقة للتحصيل
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            تم تحصيل كل الفواتير المعروضة بالكامل.
          </p>
        </section>
      ) : selectedInvoice ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-5">

          {/* Invoice preview */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl">

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Receipt className="h-5 w-5" />
                </span>

                <div className="min-w-0">
                  <p className="text-xs text-gray-500">
                    معاينة الفاتورة
                  </p>

                  <h2 className="mt-1 text-lg font-extrabold text-gray-900 sm:text-xl">
                    فاتورة رقم #{selectedInvoice.id}
                  </h2>
                </div>
              </div>

              <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {getPaymentTypeLabel(
                  selectedInvoice.paymentType
                )}
              </span>
            </div>

            <div className="min-w-0 space-y-5 p-4 sm:p-5">

              {/* Customer information */}
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">

                <div className="flex min-w-0 items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      اسم العميل
                    </p>

                    <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                      {selectedInvoice.customerName}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      رقم الهاتف
                    </p>

                    <p
                      className="mt-1 break-all text-sm font-semibold text-gray-900"
                      dir="ltr"
                    >
                      {selectedInvoice.customerPhone || "غير مسجل"}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      المندوب
                    </p>

                    <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                      {selectedInvoice.repName}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      تاريخ الفاتورة
                    </p>

                    <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                      {selectedInvoice.date}
                    </p>
                  </div>
                </div>

              </div>

              {/* Products - Mobile cards */}
              <div className="border-t border-gray-100 pt-4 sm:hidden">
                <h3 className="mb-3 font-bold text-gray-900">
                  تفاصيل المنتجات
                </h3>

                <div className="space-y-2">
                  {selectedInvoice.items.map((item) => (
                    <div
                      key={item.id}
                      className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3"
                    >
                      <p className="break-words text-sm font-semibold text-gray-900">
                        {item.productName}
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400">
                            الكمية
                          </p>
                          <p className="mt-1 font-semibold text-gray-800">
                            {item.quantity}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">
                            السعر
                          </p>
                          <p className="mt-1 font-semibold text-gray-800">
                            {formatMoney(item.unitPrice)}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">
                            الإجمالي
                          </p>
                          <p
                            className="mt-1 font-bold text-gray-900"
                            dir="ltr"
                          >
                            {formatMoney(item.lineTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products - Desktop table */}
              <div className="hidden border-t border-gray-100 pt-4 sm:block">
                <h3 className="mb-3 font-bold text-gray-900">
                  تفاصيل المنتجات
                </h3>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[440px] text-right text-sm">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="px-3 py-3 font-semibold">
                          المنتج
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          الكمية
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          السعر
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          الإجمالي
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedInvoice.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="max-w-[180px] break-words px-3 py-3 font-medium text-gray-800">
                            {item.productName}
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {item.quantity}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                            {formatMoney(item.unitPrice)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">
                            {formatMoney(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invoice summary */}
              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-500">
                    إجمالي الفاتورة
                  </span>

                  <span className="font-bold text-gray-900">
                    {formatMoney(selectedInvoice.total)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-500">
                    المدفوع سابقًا
                  </span>

                  <span className="font-semibold text-emerald-700">
                    {formatMoney(selectedInvoice.paidAmount)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
                  <span className="text-sm font-bold text-gray-800">
                    المتبقي للتحصيل
                  </span>

                  <span className="text-lg font-extrabold text-red-600 sm:text-xl">
                    {formatMoney(remaining)}
                  </span>
                </div>
              </div>

            </div>
          </section>

          {/* Payment form */}
          <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">

            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </span>

              <div className="min-w-0">
                <h2 className="font-bold text-gray-900 sm:text-lg">
                  تسجيل مبلغ التحصيل
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  الفاتورة رقم #{selectedInvoice.id}
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* Amount */}
              <div>
                <label
                  htmlFor="collection-amount"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  المبلغ المستلم
                </label>

                <input
                  id="collection-amount"
                  type="number"
                  min="0.01"
                  max={remaining}
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="اكتب المبلغ"
                  className="w-full min-w-0 rounded-xl border border-gray-300 px-4 py-3.5 text-lg font-bold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  dir="ltr"
                />

                <button
                  type="button"
                  onClick={() =>
                    setAmount(remaining.toFixed(2))
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"
                >
                  تحصيل كامل المتبقي
                  <span dir="ltr">
                    ({formatMoney(remaining)})
                  </span>
                </button>
              </div>

              {/* Note */}
              <div>
                <label
                  htmlFor="collection-note"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  ملاحظة (اختياري)
                </label>

                <textarea
                  id="collection-note"
                  rows={3}
                  maxLength={300}
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder="اكتب أي ملاحظات عن عملية التحصيل..."
                  className="w-full min-w-0 resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Errors */}
              {error && (
                <div
                  role="alert"
                  className="break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div
                  role="status"
                  className="break-words rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {success}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || remaining <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              >
                {isSubmitting ? (
                  "جارٍ تسجيل التحصيل..."
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    تأكيد التحصيل
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-6 text-gray-400">
                سيتم تسجيل المبلغ على الفاتورة وربطه بالعميل
                والمندوب، وسيظهر ضمن سجل التحصيلات.
              </p>

            </form>
          </section>
        </div>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="font-semibold text-gray-700">
            اختار فاتورة من القائمة بالأعلى.
          </p>
        </section>
      )}

    </div>
  );
}
