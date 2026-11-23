
"use client";

import {
  useState,
  useTransition,
  type FormEvent,
} from "react";

import {
  createExpense,
  deleteExpense,
} from "./actions";

import { EXPENSE_CATEGORIES } from "../../lib/expenses";

import {
  ReceiptText,
  Wallet,
  CalendarDays,
  Tag,
  FileText,
  CheckCircle2,
  Trash2,
} from "lucide-react";

type Props = {
  today: string;
};

const fieldClass = `
  mt-1.5 w-full min-w-0 rounded-xl
  border border-gray-300 bg-white
  px-3 py-3 text-sm text-gray-900
  outline-none transition
  placeholder:text-gray-400
  focus:border-blue-500 focus:ring-2 focus:ring-blue-100
  disabled:cursor-not-allowed disabled:bg-gray-50
`;

export default function ExpenseForm({ today }: Props) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("OTHER");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSaved(false);

    const parsedAmount = Number(amount);

    if (
      !amount.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError("اكتب مبلغًا صحيحًا أكبر من صفر");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createExpense({
          amount: parsedAmount,
          category,
          description,
          date,
        });

        if (result.ok === false) {
          setError(result.error);
          return;
        }

        setAmount("");
        setDescription("");
        setDate(today);
        setSaved(true);
      } catch {
        setError("حصل خطأ أثناء تسجيل المصروف. حاول مرة أخرى.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="
        w-full min-w-0 space-y-4
        rounded-xl border border-gray-200
        bg-white p-3.5 shadow-sm
        sm:rounded-2xl sm:p-5
      "
    >
      {/* Form header */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 sm:h-11 sm:w-11">
          <ReceiptText className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>

        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-gray-900 sm:text-base">
            تسجيل مصروف جديد
          </h2>

          <p className="mt-1 text-[11px] leading-5 text-gray-500 sm:text-xs">
            سجّل المصروف بالمبلغ والتاريخ والتصنيف الصحيح.
          </p>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

        {/* Amount */}
        <label className="block min-w-0 text-xs font-semibold text-gray-700 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-gray-400" />
            المبلغ
          </span>

          <input
            className={fieldClass}
            type="number"
            min="0.01"
            max="1000000000"
            step="0.01"
            inputMode="decimal"
            required
            disabled={pending}
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value)
            }
            placeholder="مثال: 250.00"
            dir="ltr"
          />
        </label>

        {/* Category */}
        <label className="block min-w-0 text-xs font-semibold text-gray-700 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-gray-400" />
            التصنيف
          </span>

          <select
            className={fieldClass}
            value={category}
            disabled={pending}
            onChange={(event) =>
              setCategory(event.target.value)
            }
          >
            {EXPENSE_CATEGORIES.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {/* Date */}
        <label className="block min-w-0 text-xs font-semibold text-gray-700 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            التاريخ
          </span>

          <input
            className={fieldClass}
            type="date"
            required
            disabled={pending}
            value={date}
            onChange={(event) =>
              setDate(event.target.value)
            }
          />
        </label>

        {/* Description */}
        <label className="block min-w-0 text-xs font-semibold text-gray-700 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-gray-400" />
            البيان / ملاحظة
          </span>

          <input
            className={fieldClass}
            type="text"
            maxLength={250}
            disabled={pending}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="مثال: فاتورة كهرباء المحل"
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="
            break-words rounded-xl border border-red-200
            bg-red-50 p-3 text-xs leading-6 text-red-700
            sm:text-sm
          "
        >
          {error}
        </div>
      )}

      {/* Success */}
      {saved && (
        <div
          role="status"
          className="
            flex items-center gap-2 rounded-xl
            border border-emerald-200 bg-emerald-50
            p-3 text-xs font-medium text-emerald-700
            sm:text-sm
          "
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          تم تسجيل المصروف بنجاح.
        </div>
      )}

      {/* Submit */}
      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="hidden text-xs text-gray-400 sm:block">
          تأكد من صحة المبلغ والتاريخ قبل الحفظ.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="
            inline-flex w-full min-h-11
            items-center justify-center gap-2
            rounded-xl bg-blue-600
            px-5 py-3 text-sm font-bold text-white
            shadow-sm transition
            hover:bg-blue-700 active:scale-[0.99]
            disabled:cursor-not-allowed disabled:opacity-60
            sm:w-auto
          "
        >
          {pending ? (
            "جارٍ الحفظ..."
          ) : (
            <>
              <ReceiptText className="h-4 w-4" />
              حفظ المصروف
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteExpenseButton({
  id,
}: {
  id: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function remove() {
    if (!window.confirm("متأكد إنك عايز تحذف المصروف ده؟")) {
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        const result = await deleteExpense(id);

        if (result.ok === false) {
          setError(result.error);
        }
      } catch {
        setError("حصل خطأ أثناء الحذف. حاول مرة أخرى.");
      }
    });
  }

  return (
    <div className="min-w-0 text-end">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="
          inline-flex min-h-10 min-w-10
          items-center justify-center gap-1.5
          rounded-lg px-3 py-2
          text-xs font-semibold text-red-600
          transition hover:bg-red-50 hover:text-red-800
          disabled:cursor-not-allowed disabled:opacity-50
        "
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "جارٍ الحذف..." : "حذف"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-1 max-w-[180px] break-words text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
