
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Volume2,
  VolumeX,
  ClipboardList,
  CalendarDays,
  FileText,
  Wallet,
} from "lucide-react";

type ShiftReport = {
  id: number;
  closedAt: string;
  invoiceCount: number;
  totalSales: number;
  collected: number;
  creditAmount: number;
  note: string | null;
  user: { id: number; name: string | null };
};

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateTime = (value: string) =>
  new Date(value).toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });

function playNotificationSound() {
  try {
    const audio = new window.AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    oscillator.frequency.setValueAtTime(
      660,
      audio.currentTime + 0.18
    );

    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.18,
      audio.currentTime + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audio.currentTime + 0.55
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.56);

    oscillator.onended = () => {
      void audio.close();
    };
  } catch {
    // يظل التنبيه المرئي يعمل حتى لو الصوت غير مدعوم.
  }
}

function ReportMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: "blue" | "green" | "amber";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="min-w-0 rounded-lg bg-white p-2.5 sm:p-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${tones[tone].split(" ")[1]}`} />

        <p className="truncate text-[10px] font-medium text-gray-500 sm:text-xs">
          {label}
        </p>
      </div>

      <p
        className="mt-1.5 break-all text-xs font-extrabold text-gray-900 sm:text-sm"
        dir="ltr"
      >
        {value}
      </p>
    </div>
  );
}

export default function ShiftAlerts() {
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const initialized = useRef(false);
  const lastSeenId = useRef(0);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    let stopped = false;

    async function loadReports() {
      try {
        const response = await fetch(
          "/api/shift-reports/recent",
          { cache: "no-store" }
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          reports: ShiftReport[];
        };

        if (stopped) return;

        const list = Array.isArray(data.reports)
          ? data.reports
          : [];

        setReports(list);

        const newestId = list.reduce(
          (max, report) => Math.max(max, report.id),
          0
        );

        // أول تحميل لا يصدر صوتًا للتقارير القديمة.
        if (!initialized.current) {
          initialized.current = true;
          lastSeenId.current = newestId;
          return;
        }

        if (newestId > lastSeenId.current) {
          const freshCount = list.filter(
            (report) => report.id > lastSeenId.current
          ).length;

          lastSeenId.current = newestId;

          setNewCount(
            (current) => current + Math.max(freshCount, 1)
          );

          if (soundEnabledRef.current) {
            playNotificationSound();
          }
        }
      } catch {
        // فشل طلب واحد لا يوقف التحديث الدوري.
      }
    }

    void loadReports();

    const interval = window.setInterval(() => {
      void loadReports();
    }, 15_000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  function toggleSound() {
    const next = !soundEnabledRef.current;

    soundEnabledRef.current = next;
    setSoundEnabled(next);

    // الصوت التجريبي يبدأ نتيجة ضغطة المستخدم.
    if (next) {
      playNotificationSound();
    }
  }

  return (
    <section
      dir="rtl"
      className="w-full min-w-0 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm sm:rounded-2xl"
    >
      {/* Header */}
      <div className="border-b border-amber-100 bg-amber-50/70 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          {/* Title */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 sm:h-11 sm:w-11">
              <BellRing className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-gray-900 sm:text-base">
                  تنبيهات إغلاق الورديات
                </h2>

                {newCount > 0 && (
                  <span
                    aria-live="polite"
                    className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white sm:text-xs"
                  >
                    {newCount} جديد
                  </span>
                )}
              </div>

              <p className="mt-1 text-[10px] leading-5 text-gray-500 sm:text-xs">
                تحديث تلقائي كل 15 ثانية
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                soundEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 shrink-0" />
              ) : (
                <VolumeX className="h-4 w-4 shrink-0" />
              )}

              <span className="truncate">
                {soundEnabled ? "الصوت مفعّل" : "تفعيل الصوت"}
              </span>
            </button>

            <Link
              href="/shift-reports"
              onClick={() => setNewCount(0)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-700 sm:text-sm"
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              كل التقارير
            </Link>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-9 text-center sm:py-12">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <BellRing className="h-6 w-6" />
          </span>

          <p className="text-sm font-semibold text-gray-700">
            لا توجد ورديات مغلقة حتى الآن
          </p>

          <p className="mt-1 text-xs text-gray-400">
            ستظهر تقارير المندوبين والبائعين هنا تلقائيًا.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {reports.slice(0, 5).map((report) => (
            <li
              key={report.id}
              className="min-w-0 p-3 transition hover:bg-gray-50/60 sm:p-4"
            >
              {/* Report information */}
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <FileText className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-gray-900">
                      {report.user?.name || "مندوب غير معروف"}
                    </p>

                    <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                      وردية #{report.id}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 sm:text-xs">
                  {report.invoiceCount} فاتورة
                </span>
              </div>

              {/* Date */}
              <div className="mt-3 flex min-w-0 items-center gap-1.5 text-[10px] text-gray-400 sm:text-xs">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />

                <span className="break-words">
                  {dateTime(report.closedAt)}
                </span>
              </div>

              {/* Metrics */}
              <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 rounded-xl bg-gray-50 p-2">
                <ReportMetric
                  label="المبيعات"
                  value={money(report.totalSales)}
                  icon={Wallet}
                  tone="blue"
                />

                <ReportMetric
                  label="المحصّل"
                  value={money(report.collected)}
                  icon={CheckCircle2}
                  tone="green"
                />

                <ReportMetric
                  label="المتبقي"
                  value={money(report.creditAmount)}
                  icon={FileText}
                  tone="amber"
                />
              </div>

              {/* Note */}
              {report.note && (
                <p className="mt-2 break-words rounded-lg bg-amber-50/70 px-3 py-2 text-xs leading-5 text-gray-600">
                  <span className="font-semibold text-gray-700">
                    ملاحظة:
                  </span>{" "}
                  {report.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      {reports.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-3 text-center sm:px-4">
          <Link
            href="/shift-reports"
            onClick={() => setNewCount(0)}
            className="text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline sm:text-sm"
          >
            عرض سجل جميع الورديات
          </Link>
        </div>
      )}
    </section>
  );
}
