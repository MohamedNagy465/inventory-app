
"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Wallet,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  LogOut,
  FileText,
  X,
} from "lucide-react";

import {
  closeShift,
  getCloseSummary,
  startShift,
} from "./actions";
import { logout } from "../actions/auth";
import { ui } from "../../lib/ui";

type ActiveShift = {
  id: number;
  openingCash: number;
  openedAt: string;
};

type Props = {
  initialShift: ActiveShift | null;

  /** بدء الوردية للبائع فقط. الافتراضي: غير مسموح */
  canStart?: boolean;

  /** يفتح نافذة بدء الوردية تلقائيًا عند عدم وجود وردية */
  autoOpenStart?: boolean;

  /** لم يعد مستخدمًا، أُبقي اختياريًا للتوافق */
  homeHref?: string;
};

type ClosedResult = {
  ok: true;
  reportId: number;
  invoiceCount: number;
  totalSales: number;
  collected: number;
  openingCash: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
};

type ResultMessage =
  | { ok: false; text: string }
  | ClosedResult
  | null;

type Dialog = null | "start" | "close";

type CloseSummary = {
  invoiceCount: number;
  totalSales: number;
  cashSales: number;
  creditAmount: number;
  collected: number;
  openingCash: number;
  expectedCash: number;
};

type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: CloseSummary }
  | { status: "error"; text: string };

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });

function clearCloseHash() {
  if (window.location.hash === "#close-shift") {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }
}

// ==========================================
// MODAL
// ==========================================

function Modal({
  title,
  titleId,
  pending,
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !pending
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mt-auto max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:my-auto sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <h3
            id={titleId}
            className="text-base font-extrabold text-gray-900 sm:text-lg"
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="إغلاق النافذة"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// ==========================================
// SUMMARY ITEM
// ==========================================

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
      <p className="text-[11px] leading-5 text-gray-500 sm:text-xs">
        {label}
      </p>

      <p
        className="mt-1 break-all text-sm font-extrabold text-gray-900 sm:text-base"
        dir="ltr"
      >
        {value}
      </p>
    </div>
  );
}

// ==========================================
// STATUS MESSAGE
// ==========================================

function ErrorMessage({
  text,
}: {
  text: string;
}) {
  return (
    <div
      role="alert"
      className="flex min-w-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 sm:text-sm"
    >
      <AlertCircle className="mt-1 h-4 w-4 shrink-0" />

      <span className="min-w-0 break-words">
        {text}
      </span>
    </div>
  );
}

// ==========================================
// SHIFT CLOSE FORM
// ==========================================

export default function ShiftCloseForm({
  initialShift,
  canStart = false,
  autoOpenStart = false,
}: Props) {
  const router = useRouter();

  const [shift, setShift] =
    useState<ActiveShift | null>(initialShift);

  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");

  const [message, setMessage] =
    useState<ResultMessage>(null);

  const [dialog, setDialog] = useState<Dialog>(null);

  const [summary, setSummary] = useState<SummaryState>({
    status: "idle",
  });

  const [pending, startTransition] = useTransition();

  const closed = message?.ok ? message : null;

  // الفرق اللحظي: النقدية الفعلية ناقص المفروض في الدرج
  const expected =
    summary.status === "ready"
      ? summary.data.expectedCash
      : null;

  const countedNum =
    countedCash.trim() === ""
      ? null
      : Number(countedCash);

  const liveDiff =
    expected !== null &&
    countedNum !== null &&
    Number.isFinite(countedNum)
      ? Math.round((countedNum - expected) * 100) / 100
      : null;

  // ==========================================
  // EFFECTS
  // ==========================================

  // الصفحة بعد router.refresh() ممكن تبعت وردية جديدة
  useEffect(() => {
    setShift(initialShift);
  }, [initialShift]);

  // زر الخروج في الهيدر يفتح نافذة إنهاء الوردية
  useEffect(() => {
    if (!shift) return;

    const openFromHash = () => {
      if (window.location.hash === "#close-shift") {
        setDialog("close");
      }
    };

    openFromHash();

    window.addEventListener("hashchange", openFromHash);

    return () =>
      window.removeEventListener(
        "hashchange",
        openFromHash
      );
  }, [shift]);

  // شاشة البيع تطلب فتح نافذة بدء الوردية
  useEffect(() => {
    if (!canStart || shift) return;

    const openStart = () => setDialog("start");

    window.addEventListener("shift:start", openStart);

    return () =>
      window.removeEventListener(
        "shift:start",
        openStart
      );
  }, [canStart, shift]);

  // فتح نافذة بدء الوردية تلقائيًا للبائع
  useEffect(() => {
    if (
      autoOpenStart &&
      canStart &&
      !initialShift
    ) {
      setDialog("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تحميل ملخص الوردية عند فتح نافذة الإنهاء
  useEffect(() => {
    if (dialog !== "close" || !shift) return;

    let cancelled = false;

    setSummary({ status: "loading" });

    getCloseSummary()
      .then((r) => {
        if (cancelled) return;

        setSummary(
          r.ok
            ? { status: "ready", data: r.summary }
            : { status: "error", text: r.error }
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSummary({
            status: "error",
            text: "تعذر حساب ملخص الوردية",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dialog, shift]);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    if (!dialog) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        setDialog(null);
        setMessage(null);
        clearCloseHash();
      }
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener("keydown", onKey);
  }, [dialog, pending]);

  // ==========================================
  // DIALOG CONTROL
  // ==========================================

  function dismiss() {
    if (pending) return;

    setDialog(null);
    setMessage(null);
    clearCloseHash();
  }

  // ==========================================
  // START SHIFT
  // ==========================================

  function submitStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const amount = Number(openingCash);

    if (
      openingCash.trim() === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setMessage({
        ok: false,
        text: "اكتب رصيد بداية الدرج بشكل صحيح",
      });
      return;
    }

    startTransition(async () => {
      const result = await startShift({
        openingCash: amount,
      });

      if (!result.ok) {
        setMessage({
          ok: false,
          text: result.error,
        });
        return;
      }

      setShift(result.shift);
      setOpeningCash("");
      setDialog(null);

      // تحديث الصفحة بعد فتح الوردية
      router.refresh();
    });
  }

  // ==========================================
  // CLOSE SHIFT
  // ==========================================

  function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const actual = Number(countedCash);

    if (
      countedCash.trim() === "" ||
      !Number.isFinite(actual) ||
      actual < 0
    ) {
      setMessage({
        ok: false,
        text: "اكتب المبلغ الفعلي الموجود في الدرج",
      });
      return;
    }

    startTransition(async () => {
      const result = await closeShift({
        countedCash: actual,
        note,
      });

      if (!result.ok) {
        setMessage({
          ok: false,
          text: result.error,
        });
        return;
      }

      setDialog(null);
      clearCloseHash();

      setMessage(result);
      setShift(null);
      setCountedCash("");
      setNote("");
      setSummary({ status: "idle" });

      router.refresh();
    });
  }

  const errorText =
    message && !message.ok ? message.text : null;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section
      dir="rtl"
      className={`${ui.card} min-w-0 space-y-4`}
    >
      {/* ================================== */}
      {/* HEADER */}
      {/* ================================== */}

      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-11 sm:w-11">
            <Wallet className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-gray-900 sm:text-lg">
              إدارة الوردية
            </h2>

            <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500 sm:text-sm sm:leading-6">
              {canStart
                ? "ابدأ الوردية وسجّل رصيد الدرج، وعند الانتهاء أنهِ الوردية وأدخل النقدية الفعلية."
                : "أنهِ الوردية وأدخل النقدية الفعلية عند الانتهاء من العمل."}
            </p>
          </div>
        </div>

        <Link
          href="/shift-reports"
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-blue-600 transition hover:bg-blue-50 sm:text-sm"
        >
          <FileText className="h-4 w-4" />
          سجل الورديات
        </Link>
      </div>

      {/* ================================== */}
      {/* NO ACTIVE SHIFT */}
      {/* ================================== */}

      {!shift && !closed && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-6 text-gray-600 sm:text-sm">
            <Clock className="mt-1 h-4 w-4 shrink-0 text-gray-400" />

            <p>
              لا توجد وردية مفتوحة حاليًا.
              {canStart &&
                " ابدأ الوردية وسجّل رصيد الدرج قبل البيع."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
            {canStart && (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setDialog("start");
                }}
                className={`${ui.btn} flex min-h-12 w-full items-center justify-center gap-2 sm:w-auto`}
              >
                <Wallet className="h-4 w-4" />
                بدء الوردية
              </button>
            )}

            <form action={logout} className="w-full sm:w-auto">
              <button
                type="submit"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 sm:w-auto"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================== */}
      {/* ACTIVE SHIFT */}
      {/* ================================== */}

      {shift && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 border-b border-emerald-100 px-3 py-3 sm:px-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />

                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>

              <p className="text-sm font-extrabold text-emerald-900">
                الوردية مفتوحة
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-px bg-emerald-100 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0 bg-emerald-50 p-3.5 sm:p-4">
                <p className="text-xs text-emerald-700">
                  بدأت في
                </p>

                <p className="mt-1 break-words text-sm font-bold leading-6 text-emerald-900">
                  {dateTime(shift.openedAt)}
                </p>
              </div>

              <div className="min-w-0 bg-emerald-50 p-3.5 sm:p-4">
                <p className="text-xs text-emerald-700">
                  رصيد بداية الدرج
                </p>

                <p
                  className="mt-1 break-all text-xl font-extrabold text-emerald-900"
                  dir="ltr"
                >
                  {money(shift.openingCash)}
                </p>
              </div>

              <div className="min-w-0 bg-emerald-50 p-3.5 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:bg-emerald-50 lg:col-span-1 lg:block">
                <div>
                  <p className="text-xs text-emerald-700">
                    الحالة
                  </p>

                  <p className="mt-1 text-sm font-bold text-emerald-900">
                    نشطة
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setDialog("close");
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.99] sm:w-auto sm:px-6"
          >
            <LogOut className="h-4 w-4" />
            إنهاء الوردية
          </button>
        </div>
      )}

      {/* General error */}
      {errorText && !dialog && (
        <ErrorMessage text={errorText} />
      )}

      {/* ================================== */}
      {/* CLOSED SHIFT RESULT */}
      {/* ================================== */}

      {closed && (
        <div
          role="status"
          className="min-w-0 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:p-5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </span>

            <div className="min-w-0">
              <p className="break-words font-extrabold text-emerald-800">
                تم إغلاق الوردية بنجاح
              </p>

              <p className="mt-1 text-xs text-emerald-700">
                تقرير رقم #{closed.reportId}
              </p>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryItem
              label="رصيد بداية الدرج"
              value={money(closed.openingCash)}
            />

            <SummaryItem
              label="التحصيل خلال الوردية"
              value={money(closed.collected)}
            />

            <SummaryItem
              label="المفروض في الدرج"
              value={money(closed.expectedCash)}
            />

            <SummaryItem
              label="النقدية الفعلية"
              value={money(closed.countedCash)}
            />

            <SummaryItem
              label="إجمالي المبيعات"
              value={money(closed.totalSales)}
            />

            <SummaryItem
              label="عدد الفواتير"
              value={String(closed.invoiceCount)}
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white p-3">
            <span className="text-xs font-bold text-emerald-800 sm:text-sm">
              الفرق (الفعلي ناقص المفروض)
            </span>

            <strong
              className={`break-all text-lg font-extrabold ${
                closed.difference < -0.005
                  ? "text-red-600"
                  : closed.difference > 0.005
                  ? "text-amber-700"
                  : "text-emerald-700"
              }`}
              dir="ltr"
            >
              {money(closed.difference)}
            </strong>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-emerald-200 pt-4 sm:flex sm:flex-wrap">
            <form action={logout} className="w-full sm:w-auto">
              <button
                type="submit"
                className={`${ui.btn} flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto`}
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </form>

            {canStart && (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setDialog("start");
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              >
                <Wallet className="h-4 w-4" />
                بدء وردية جديدة
              </button>
            )}

            <Link
              href="/shift-reports"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-emerald-800 underline"
            >
              <FileText className="h-4 w-4" />
              سجل الورديات
            </Link>
          </div>
        </div>
      )}

      {/* ================================== */}
      {/* START SHIFT MODAL */}
      {/* ================================== */}

      {dialog === "start" && canStart && (
        <Modal
          title="بدء الوردية"
          titleId="start-shift-title"
          pending={pending}
          onClose={dismiss}
        >
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

            <p className="text-xs leading-6 text-blue-800 sm:text-sm">
              اكتب المبلغ الموجود بالفعل في درج الكاش قبل بدء البيع.
            </p>
          </div>

          <form
            onSubmit={submitStart}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="shift-opening-cash"
                className="mb-1.5 block text-xs font-bold text-gray-700 sm:text-sm"
              >
                رصيد بداية الدرج
              </label>

              <input
                id="shift-opening-cash"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                autoFocus
                value={openingCash}
                onChange={(event) =>
                  setOpeningCash(event.target.value)
                }
                placeholder="مثال: 500.00"
                className={`${ui.input} min-h-12 w-full text-lg font-semibold`}
                dir="ltr"
              />
            </div>

            {errorText && (
              <ErrorMessage text={errorText} />
            )}

            {message?.ok === false && (
              <ErrorMessage text={message.text} />
            )}

            <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-[1fr_auto]">
              <button
                type="submit"
                disabled={pending}
                className={`${ui.btn} flex min-h-12 w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <CheckCircle2 className="h-4 w-4" />

                {pending
                  ? "جارٍ بدء الوردية..."
                  : "تأكيد بدء الوردية"}
              </button>

              <button
                type="button"
                onClick={dismiss}
                disabled={pending}
                className="min-h-12 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================== */}
      {/* CLOSE SHIFT MODAL */}
      {/* ================================== */}

      {dialog === "close" && shift && (
        <Modal
          title="إنهاء الوردية"
          titleId="close-shift-title"
          pending={pending}
          onClose={dismiss}
        >
          <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

            <p className="text-xs leading-6 text-gray-600 sm:text-sm">
              بدأت الوردية في{" "}
              <strong className="text-gray-800">
                {dateTime(shift.openedAt)}
              </strong>
            </p>
          </div>

          {/* Shift summary */}
          <div className="mt-4 min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />

              <p className="text-xs font-extrabold text-gray-700 sm:text-sm">
                ملخص الوردية (محسوب تلقائيًا)
              </p>
            </div>

            {summary.status === "loading" && (
              <div
                className="space-y-2"
                aria-busy="true"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
                  <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
                  <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
                  <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
                </div>

                <p className="py-2 text-center text-xs text-gray-400">
                  جارٍ تجميع الفواتير والتحصيلات...
                </p>
              </div>
            )}

            {summary.status === "error" && (
              <ErrorMessage text={summary.text} />
            )}

            {summary.status === "ready" && (
              <>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                  <SummaryItem
                    label="عدد الفواتير"
                    value={String(summary.data.invoiceCount)}
                  />

                  <SummaryItem
                    label="إجمالي المبيعات"
                    value={money(summary.data.totalSales)}
                  />

                  <SummaryItem
                    label="مبيعات كاش"
                    value={money(summary.data.cashSales)}
                  />

                  <SummaryItem
                    label="المبيعات الآجلة"
                    value={money(summary.data.creditAmount)}
                  />

                  <SummaryItem
                    label="التحصيل خلال الوردية"
                    value={money(summary.data.collected)}
                  />

                  <SummaryItem
                    label="رصيد بداية الدرج"
                    value={money(summary.data.openingCash)}
                  />
                </div>

                <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Wallet className="h-5 w-5 shrink-0 text-blue-700" />

                    <span className="text-xs font-extrabold text-blue-800 sm:text-sm">
                      المفروض في الدرج
                    </span>
                  </div>

                  <span
                    className="break-all text-xl font-extrabold text-blue-900 sm:text-2xl"
                    dir="ltr"
                  >
                    {money(summary.data.expectedCash)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Close form */}
          <form
            onSubmit={submitClose}
            className="mt-4 space-y-4"
          >
            <div>
              <label
                htmlFor="shift-counted-cash"
                className="mb-1.5 block text-xs font-bold text-gray-700 sm:text-sm"
              >
                النقدية الفعلية الموجودة في الدرج عند الإغلاق
              </label>

              <div className="relative">
                <Banknote className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                <input
                  id="shift-counted-cash"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                  autoFocus
                  value={countedCash}
                  onChange={(event) =>
                    setCountedCash(event.target.value)
                  }
                  placeholder="مثال: 1750.00"
                  className={`${ui.input} min-h-12 w-full pe-10 text-lg font-bold`}
                  dir="ltr"
                />
              </div>

              <p className="mt-2 text-[11px] leading-5 text-gray-500 sm:text-xs">
                المفروض في الدرج = رصيد البداية + التحصيل خلال الوردية.
              </p>

              {liveDiff !== null && (
                <div
                  role="status"
                  className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-xs font-bold leading-5 sm:text-sm ${
                    Math.abs(liveDiff) < 0.005
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : liveDiff < 0
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {Math.abs(liveDiff) < 0.005 ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  )}

                  <span>
                    {Math.abs(liveDiff) < 0.005
                      ? "مطابق، لا يوجد فرق"
                      : liveDiff < 0
                      ? `عجز ${money(Math.abs(liveDiff))}`
                      : `زيادة ${money(liveDiff)}`}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="shift-note"
                className="mb-1.5 block text-xs font-bold text-gray-700 sm:text-sm"
              >
                ملاحظة (اختياري)
              </label>

              <textarea
                id="shift-note"
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                maxLength={300}
                rows={3}
                placeholder="أي ملاحظات على الوردية أو فرق النقدية"
                className={`${ui.input} min-h-20 w-full resize-y`}
              />

              <p className="mt-1 text-left text-[10px] text-gray-400" dir="ltr">
                {note.length}/300
              </p>
            </div>

            {errorText && (
              <ErrorMessage text={errorText} />
            )}

            {message?.ok === false && (
              <ErrorMessage text={message.text} />
            )}

            <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-[1fr_auto]">
              <button
                type="submit"
                disabled={
                  pending || summary.status !== "ready"
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />

                {pending
                  ? "جارٍ إغلاق الوردية..."
                  : "تأكيد إغلاق الوردية"}
              </button>

              <button
                type="button"
                onClick={dismiss}
                disabled={pending}
                className="min-h-12 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
