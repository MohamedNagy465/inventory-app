
"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { UserPlus, X, UserRound, Phone } from "lucide-react";
import { createCustomer } from "../customers/actions";
import { ui } from "../../lib/ui";

export default function NewCustomerButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        setOpen(false);
        setError(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAdded(null);

    if (name.trim().length < 2) {
      setError("اسم العميل يجب أن يكون حرفين على الأقل");
      return;
    }

    startTransition(async () => {
      try {
        const r = await createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          reuseExistingByName: true,
        });

        if (!r.ok) {
          setError(r.error);
          return;
        }

        // يسمح لأي نموذج في الصفحة باختيار العميل الجديد
        window.dispatchEvent(
          new CustomEvent("customer:created", {
            detail: r.customer,
          })
        );

        setAdded(
          r.existed
            ? `العميل "${r.customer.name}" موجود بالفعل في القائمة`
            : `تمت إضافة العميل "${r.customer.name}". اختره من قائمة العملاء.`
        );

        setName("");
        setPhone("");
        setOpen(false);
      } catch {
        setError("حدث خطأ أثناء إضافة العميل. حاول مرة أخرى.");
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2">
      {/* Open button */}
      <button
        type="button"
        onClick={() => {
          setAdded(null);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
      >
        <UserPlus className="h-4 w-4" />
        عميل جديد
      </button>

      {/* Success message */}
      {added && (
        <p
          role="status"
          className="max-w-full break-words text-right text-xs leading-5 text-emerald-700 sm:max-w-xs"
        >
          {added}
        </p>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/50 px-3 pb-3 pt-3 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-customer-title"
            className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-right shadow-2xl sm:p-6"
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <UserRound className="h-5 w-5" />
                </span>

                <div className="min-w-0">
                  <h3
                    id="new-customer-title"
                    className="text-base font-extrabold text-gray-900 sm:text-lg"
                  >
                    إضافة عميل جديد
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    أدخل بيانات العميل لإضافته للقائمة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={pending}
                aria-label="إغلاق"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="mt-4 space-y-4">
              {/* Customer name */}
              <div className="min-w-0">
                <label
                  htmlFor="new-customer-name"
                  className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
                >
                  اسم العميل
                  <span className="me-1 text-red-500">*</span>
                </label>

                <input
                  id="new-customer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="مثال: بقالة الراشد"
                  className={`${ui.input} min-h-12 w-full min-w-0 text-base`}
                />
              </div>

              {/* Customer phone */}
              <div className="min-w-0">
                <label
                  htmlFor="new-customer-phone"
                  className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
                >
                  رقم الموبايل (اختياري)
                </label>

                <div className="relative">
                  <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <input
                    id="new-customer-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={20}
                    dir="ltr"
                    placeholder="05xxxxxxxx"
                    className={`${ui.input} min-h-12 w-full min-w-0 pr-10 text-base text-left`}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 sm:text-sm"
                >
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-[1fr_auto]">
                <button
                  type="submit"
                  disabled={pending || name.trim().length < 2}
                  className={`${ui.btn} flex min-h-12 w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <UserPlus className="h-4 w-4" />
                  {pending ? "جارٍ الإضافة..." : "إضافة العميل"}
                </button>

                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="min-h-12 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
