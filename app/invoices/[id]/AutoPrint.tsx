"use client";

import { useEffect } from "react";

export default function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    // احذف علامة الطباعة من الرابط حتى لا تتكرر عند تحديث الصفحة.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname
    );

    const timer = window.setTimeout(() => {
      window.print();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  return null;
}
