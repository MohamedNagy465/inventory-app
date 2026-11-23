
"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveOrder, rejectOrder } from "./actions";
import { ui } from "../../lib/ui";

export default function OrderActions({
  orderId,
}: {
  orderId: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(kind: "approve" | "reject") {
    setError(null);

    startTransition(async () => {
      try {
        const r =
          kind === "approve"
            ? await approveOrder(orderId)
            : await rejectOrder(orderId);

        if (!r.ok) {
          setError(r.error);
        }
      } catch {
        setError("حدث خطأ، حاول مرة أخرى");
      }
    });
  }

  return (
    <div className="w-full min-w-0 sm:w-auto">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={pending}
          aria-busy={pending}
          className={`${ui.btn} flex min-h-11 min-w-0 items-center justify-center gap-2 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:px-4`}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>
            {pending ? "جارٍ التنفيذ..." : "موافقة"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => run("reject")}
          disabled={pending}
          aria-busy={pending}
          className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          <X className="h-4 w-4 shrink-0" />
          <span>رفض</span>
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-600 sm:text-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
}
