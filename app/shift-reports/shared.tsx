
export const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

const dateFormatter = new Intl.DateTimeFormat(
  "ar-EG-u-nu-latn",
  {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }
);

export const formatDateTime = (date: Date) =>
  dateFormatter.format(date);

export function paymentLabel(type: string) {
  if (type === "CASH") return "كاش";
  if (type === "HALF_CREDIT") return "نصف كاش / نصف آجل";
  if (type === "CREDIT") return "آجل";

  return type;
}

export function DifferenceBadge({
  counted,
  difference,
}: {
  counted: number | null;
  difference: number | null;
}) {
  const baseClass =
    "inline-flex max-w-full items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold leading-5";

  if (counted === null || difference === null) {
    return (
      <span
        className={`${baseClass} bg-gray-100 text-gray-600`}
        role="status"
      >
        بدون عدّ
      </span>
    );
  }

  if (Math.abs(difference) < 0.005) {
    return (
      <span
        className={`${baseClass} bg-emerald-100 text-emerald-700`}
        role="status"
      >
        مطابق
      </span>
    );
  }

  if (difference < 0) {
    return (
      <span
        className={`${baseClass} bg-red-100 text-red-700`}
        role="status"
      >
        عجز{" "}
        <bdi dir="ltr" className="tabular-nums">
          {fmt(Math.abs(difference))}
        </bdi>
      </span>
    );
  }

  return (
    <span
      className={`${baseClass} bg-amber-100 text-amber-700`}
      role="status"
    >
      زيادة{" "}
      <bdi dir="ltr" className="tabular-nums">
        {fmt(difference)}
      </bdi>
    </span>
  );
}
