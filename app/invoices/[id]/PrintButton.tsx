
"use client";

import { Printer } from "lucide-react";
import { ui } from "../../../lib/ui";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${ui.btn} inline-flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto print:hidden`}
    >
      <Printer className="h-4 w-4" />
      <span>طباعة الفاتورة</span>
    </button>
  );
}
