
"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Receipt,
  Wallet,
  TrendingUp,
  Clock,
  Send,
  LogOut,
} from "lucide-react";

import { submitDailyReport } from "./report-actions";
import { logout } from "../actions/auth";
import { ui } from "../../lib/ui";

type Summary = {
  invoiceCount: number;
  totalSales: number;
  collected: number;
  creditToday: number;
  outstanding: number;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar-EG-u-nu-latn", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
  });

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
  dir = "ltr",
}: {
  title: string;
  value: string;
  icon: typeof Receipt;
  tone: "blue" | "green" | "amber" | "gray";
  dir?: "ltr" | "rtl";
}) {
  const styles = {
    blue: {
      icon: "bg-blue-50 text-blue-700",
      value: "text-gray-900",
    },
    green: {
      icon: "bg-green-50 text-green-700",
      value: "text-green-700",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700",
      value: "text-amber-700",
    },
    gray: {
      icon: "bg-gray-100 text-gray-600",
      value: "text-gray-900",
    },
  };

  return (
    <div className="flex min-w-0 items-start justify-between gap-2 bg-white p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-5 text-gray-500 sm:text-xs">
          {title}
        </p>

        <p
          className={`mt-1 break-all text-lg font-extrabold tracking-tight sm:text-xl ${styles[tone].value}`}
          dir={dir}
        >
          {value}
        </p>
      </div>

      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${styles[tone].icon}`}
      >
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </span>
    </div>
  );
}

export default function DailyReportForm({
  summary,
  sentAt,
}: {
  summary: Summary;
  sentAt: string | null;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [pending, startTransition] = useTransition();

  function send() {
    setMessage(null);

    startTransition(async () => {
      try {
        const r = await submitDailyReport({ note });

        if (!r.ok) {
          setMessage({
            ok: false,
            text: r.error,
          });
          return;
        }

        setNote("");

        setMessage({
          ok: true,
          text: r.updated
            ? "تم تحديث تقرير اليوم وإرساله للمدير"
            : "تم إرسال تقرير اليوم للمدير",
        });
      } catch {
        setMessage({
          ok: false,
          text: "حدث خطأ أثناء إرسال التقرير. حاول مرة أخرى.",
        });
      }
    });
  }

  return (
    <section
      dir="rtl"
      className={`${ui.card} min-w-0 space-y-4 sm:space-y-5`}
    >
      {/* Header */}
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-11 sm:w-11">
          <FileText className="h-5 w-5" />
        </span>

        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-gray-900 sm:text-lg">
            تقرير نهاية اليوم
          </h2>

          <p className="mt-1 text-xs leading-6 text-gray-500 sm:text-sm">
            أرسل للمدير ملخص يومك: عدد الفواتير، وما حصّلته، وما لك عند العملاء.
          </p>
        </div>
      </div>

      {/* Daily statistics */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200">
        <div className="grid grid-cols-2 gap-px bg-gray-200 sm:grid-cols-4">
          <SummaryCard
            title="فواتير اليوم"
            value={summary.invoiceCount.toLocaleString("en-US")}
            icon={Receipt}
            tone="blue"
            dir="ltr"
          />

          <SummaryCard
            title="مبيعات اليوم"
            value={money(summary.totalSales)}
            icon={TrendingUp}
            tone="gray"
          />

          <SummaryCard
            title="المحصّل"
            value={money(summary.collected)}
            icon={Wallet}
            tone="green"
          />

          <SummaryCard
            title="آجل اليوم"
            value={money(summary.creditToday)}
            icon={Clock}
            tone="amber"
          />
        </div>
      </div>

      {/* Outstanding balance */}
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Wallet className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <p className="text-sm font-bold leading-6 text-amber-900">
              له بره (إجمالي المستحق على العملاء)
            </p>

            <p className="mt-0.5 text-[11px] leading-5 text-amber-700 sm:text-xs">
              المتبقي على كل فواتيرك، مش اليوم بس
            </p>
          </div>
        </div>

        <p
          className="break-all text-2xl font-extrabold text-amber-800 sm:text-3xl sm:text-left"
          dir="ltr"
        >
          {money(summary.outstanding)}
        </p>
      </div>

      {/* Report note */}
      <div className="min-w-0">
        <label
          htmlFor="daily-report-note"
          className="mb-1.5 block text-xs font-semibold text-gray-700 sm:text-sm"
        >
          ملاحظة للمدير (اختياري)
        </label>

        <textarea
          id="daily-report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="مثال: عميل وعد بالدفع غدًا"
          className={`${ui.input} min-h-24 w-full resize-y`}
        />

        <p className="mt-1 text-left text-[10px] text-gray-400" dir="ltr">
          {note.length}/300
        </p>
      </div>

      {/* Previous submission */}
      {sentAt && (
        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

          <p className="text-xs leading-5 text-gray-500">
            أُرسل تقرير اليوم الساعة{" "}
            <strong className="text-gray-700">
              {timeOf(sentAt)}
            </strong>
            . إرسال التقرير مرة أخرى بيحدّث أرقامه.
          </p>
        </div>
      )}

      {/* Result message */}
      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          className={`rounded-xl border px-3 py-3 text-xs leading-6 sm:text-sm ${
            message.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:flex sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className={`${ui.btn} flex min-h-12 w-full items-center justify-center gap-2 sm:w-auto`}
        >
          <Send className="h-4 w-4" />

          <span>
            {pending
              ? "جارٍ الإرسال..."
              : sentAt
              ? "تحديث التقرير وإرساله"
              : "إرسال التقرير للمدير"}
          </span>
        </button>

        <form action={logout} className="w-full sm:w-auto">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </form>
      </div>
    </section>
  );
}
