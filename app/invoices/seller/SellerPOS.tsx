"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Banknote,
  Clock,
  Coins,
  CreditCard,
  Landmark,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { createInvoice } from "../actions";
import { ui } from "../../../lib/ui";
import { collectFromCustomer, getCustomerBalance } from "../customer-actions";
import { printDraftInvoice } from "../print-draft";
import ShiftCloseForm from "../../shift-reports/ShiftCloseForm";

type P = {
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
};
type C = { id: number; name: string };
type PayMode = "cash" | "credit" | "partial";
type PayMethod = "CASH" | "WALLET" | "TRANSFER";
type Held = {
  id: number;
  qty: Record<number, number>;
  customerId: string;
  discount: string;
  payMode: PayMode;
  method: PayMethod;
  paid: string;
  count: number;
  total: number;
  at: Date;
};

const money = (n: number) => n.toFixed(2);

const PAY_MODES: { value: PayMode; label: string; Icon: LucideIcon }[] = [
  { value: "cash", label: "كاش", Icon: Banknote },
  { value: "credit", label: "آجل", Icon: Clock },
  { value: "partial", label: "نص آجل", Icon: Wallet },
];

const PAY_METHODS: {
  value: PayMethod;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: "CASH", label: "كاش", Icon: Coins },
  { value: "WALLET", label: "محفظة إلكترونية", Icon: Wallet },
  { value: "TRANSFER", label: "تحويل بنكي", Icon: Landmark },
];

const sectionTitle = "mb-2 block text-xs font-semibold text-gray-500";

/* ---------- صوت المسح ---------- */
function useBeep(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback(
    (ok: boolean) => {
      if (!enabled) return;
      try {
        ctx.current ??= new window.AudioContext();
        const c = ctx.current;
        if (c.state === "suspended") void c.resume();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.value = ok ? 880 : 220;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + (ok ? 0.08 : 0.25));
      } catch {
        // الصوت اختياري
      }
    },
    [enabled]
  );
}

/* ---------- المسح بالكاميرا ---------- */
type Detector = {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type DetectorCtor = new (opts?: { formats: string[] }) => Detector;

function getDetectorCtor(): DetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: DetectorCtor })
    .BarcodeDetector;
}

function CameraScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const last = { code: "", at: 0 };

    async function start() {
      try {
        const Ctor = getDetectorCtor();
        if (!Ctor) {
          setError("المتصفح لا يدعم المسح بالكاميرا");
          return;
        }
        const detector = new Ctor({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        timer = setInterval(async () => {
          if (video.readyState < 2) return;
          try {
            const found = await detector.detect(video);
            const code = found[0]?.rawValue?.trim();
            if (!code) return;
            const now = Date.now();
            // تجاهل نفس الكود لو اتقرأ للتو
            if (code === last.code && now - last.at < 1500) return;
            last.code = code;
            last.at = now;
            onCodeRef.current(code);
          } catch {
            // إطار غير قابل للقراءة
          }
        }, 300);
      } catch {
        setError(
          "تعذر تشغيل الكاميرا. تأكد من السماح بالوصول للكاميرا ومن أن الموقع يعمل عبر HTTPS"
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="المسح بالكاميرا"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-3 sm:p-4"
    >
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">المسح بالكاميرا</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            إغلاق
          </button>
        </div>
        {error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-video w-full bg-black object-cover"
            />
            <p className="px-4 py-3 text-xs text-gray-500">
              وجّه الكاميرا نحو الباركود. يمكنك مسح أكثر من منتج متتالٍ.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- زر اختيار (طريقة / وسيلة الدفع) ---------- */
function ChoiceButton({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 text-xs font-semibold transition active:scale-[0.98] sm:px-2 sm:text-sm ${
        active
          ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}

/* ---------- الشاشة الرئيسية ---------- */
export default function SellerPOS({
  products,
  customers,
  initialShift,
  shiftRequired,
}: {
  products: P[];
  customers: C[];
  initialShift: { id: number; openingCash: number; openedAt: string } | null;
  /** الوردية مطلوبة للبائع فقط */
  shiftRequired: boolean;
}) {
  const barcodeRef = useRef<HTMLInputElement>(null);
  const nextHeldId = useRef(1);
  const handleCodeRef = useRef<(code: string) => void>(() => {});

  const [qty, setQty] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scan, setScan] = useState<{ ok: boolean; text: string } | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    text: string;
    invoiceId?: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const [sound, setSound] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [held, setHeld] = useState<Held[]>([]);
  const [sold, setSold] = useState({ count: 0, total: 0 });

  const [shiftAlert, setShiftAlert] = useState(false);
  const [discount, setDiscount] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [paid, setPaid] = useState("");
  const [balance, setBalance] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; amount: number }
    | { status: "error"; text: string }
  >({ status: "idle" });
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMsg, setCollectMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [collecting, startCollect] = useTransition();

  const beep = useBeep(sound);
  const needsShift = shiftRequired && !initialShift;

  useEffect(() => {
    setCameraSupported(
      !!getDetectorCtor() && !!navigator.mediaDevices?.getUserMedia
    );
  }, []);

  useEffect(() => {
    if (!shiftAlert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShiftAlert(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shiftAlert]);

  // مستحقات العميل المختار
  useEffect(() => {
    setCollectAmount("");
    setCollectMsg(null);
    if (!customerId) {
      setBalance({ status: "idle" });
      return;
    }
    let cancelled = false;
    setBalance({ status: "loading" });
    getCustomerBalance(Number(customerId))
      .then((r) => {
        if (cancelled) return;
        setBalance(
          r.ok
            ? { status: "ready", amount: r.balance }
            : { status: "error", text: r.error }
        );
      })
      .catch(() => {
        if (!cancelled) setBalance({ status: "error", text: "تعذر جلب مستحقات العميل" });
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const byBarcode = useMemo(() => {
    const map = new Map<string, P>();
    for (const p of products) {
      const code = p.barcode?.trim();
      if (code) map.set(code, p);
    }
    return map;
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const lines = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ product: byId.get(Number(id)), quantity: q }))
    .filter((l): l is { product: P; quantity: number } => !!l.product);

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  const discountNum = Math.round((Number(discount) || 0) * 100) / 100;
  const discountError =
    discountNum < 0
      ? "الخصم غير صحيح"
      : discountNum > total
      ? "الخصم أكبر من مجموع الفاتورة"
      : null;
  const net = Math.max(0, total - (discountError ? 0 : discountNum));

  // كاش: يدفع الكل، آجل: لا يدفع شيئًا، نص آجل: مبلغ يحدده البائع
  const paidInput = Math.round((Number(paid) || 0) * 100) / 100;
  const paidNum =
    payMode === "cash" ? net : payMode === "credit" ? 0 : paidInput;
  const remaining = Math.max(0, Math.round((net - paidNum) * 100) / 100);
  const payError =
    lines.length === 0
      ? null
      : payMode !== "cash" && !customerId
      ? "اختر عميلًا للبيع الآجل"
      : payMode === "partial" && !(paidNum > 0 && paidNum < net)
      ? "المبلغ المدفوع يجب أن يكون أكبر من صفر وأقل من الإجمالي"
      : null;

  function setQuantity(p: P, next: number) {
    setResult(null);
    const clean = Math.min(p.stock, Math.max(0, Math.floor(next) || 0));
    setQty((q) => ({ ...q, [p.id]: clean }));
  }

  /* --- إضافة منتج من باركود (قارئ أو كاميرا) --- */
  function handleCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setResult(null);

    const p = byBarcode.get(code);
    if (!p) {
      beep(false);
      setScan({ ok: false, text: `الباركود غير مسجّل: ${code}` });
      return;
    }
    if (p.stock === 0) {
      beep(false);
      setScan({ ok: false, text: `${p.name}: نفد من المخزون` });
      return;
    }

    const current = qty[p.id] ?? 0;
    if (current >= p.stock) {
      beep(false);
      setScan({
        ok: false,
        text: `وصلت للحد الأقصى المتاح من ${p.name} (${p.stock})`,
      });
      return;
    }

    beep(true);
    setQuantity(p, current + 1);
    setScan({ ok: true, text: `${p.name} × ${current + 1}` });
  }
  handleCodeRef.current = handleCode;

  function scanFromInput() {
    const code = barcode;
    setBarcode("");
    handleCode(code);
  }

  /* --- الفواتير المعلّقة --- */
  function snapshot(): Held {
    return {
      id: nextHeldId.current++,
      qty,
      customerId,
      discount,
      payMode,
      method,
      paid,
      count,
      total: net,
      at: new Date(),
    };
  }

  function clearCart() {
    setQty({});
    setCustomerId("");
    setDiscount("");
    setPayMode("cash");
    setMethod("cash");
    setPaid("");
    setResult(null);
  }

  function holdCurrent() {
    if (lines.length === 0) return;
    const h = snapshot();
    setHeld((prev) => [...prev, h]);
    clearCart();
    barcodeRef.current?.focus();
  }

  function restore(target: Held) {
    const swapped = lines.length > 0 ? snapshot() : null;
    setHeld((prev) => {
      const rest = prev.filter((x) => x.id !== target.id);
      return swapped ? [...rest, swapped] : rest;
    });

    // المخزون ممكن يكون اتغيّر، فنقصّ الكميات على المتاح
    const clamped: Record<number, number> = {};
    for (const [id, q] of Object.entries(target.qty)) {
      const p = byId.get(Number(id));
      if (!p) continue;
      const c = Math.min(p.stock, q);
      if (c > 0) clamped[p.id] = c;
    }
    setQty(clamped);
    setCustomerId(target.customerId);
    setDiscount(target.discount);
    setPayMode(target.payMode);
    setMethod(target.method);
    setPaid(target.paid);
    setResult(null);
  }

  function discardHeld(id: number) {
    setHeld((prev) => prev.filter((x) => x.id !== id));
  }

  function goStartShift() {
    setShiftAlert(false);
    // يفتح نافذة بدء الوردية في ShiftCloseForm
    window.dispatchEvent(new Event("shift:start"));
  }

  /* --- طباعة مسودة (لا تُحفظ ولا تؤثر على المخزون) --- */
  function printDraft() {
    if (lines.length === 0) return;
    const modeLabel = PAY_MODES.find((m) => m.value === payMode)?.label ?? "";
    const methodLabel = PAY_METHODS.find((m) => m.value === method)?.label ?? "";
    printDraftInvoice({
      customerName:
        customers.find((c) => String(c.id) === customerId)?.name ?? "بدون عميل",
      payLabel: paidNum > 0 ? `${modeLabel} · ${methodLabel}` : modeLabel,
      lines: lines.map(({ product: p, quantity }) => ({
        name: p.name,
        quantity,
        price: p.price,
      })),
      subtotal: total,
      discount: discountError ? 0 : discountNum,
      net,
      paid: paidNum,
      remaining,
    });
  }

  /* --- تحصيل من مستحقات العميل --- */
  function collect() {
    setCollectMsg(null);
    const owed = balance.status === "ready" ? balance.amount : 0;
    const amount = Math.round(Number(collectAmount) * 100) / 100;

    if (!customerId || !(amount > 0)) {
      setCollectMsg({ ok: false, text: "أدخل مبلغًا صحيحًا" });
      return;
    }
    if (amount > owed) {
      setCollectMsg({ ok: false, text: `المبلغ أكبر من المستحق (${money(owed)})` });
      return;
    }

    startCollect(async () => {
      const r = await collectFromCustomer({
        customerId: Number(customerId),
        amount,
      });
      if (r.ok) {
        beep(true);
        setBalance({ status: "ready", amount: r.balance });
        setCollectAmount("");
        setCollectMsg({
          ok: true,
          text: `تم تحصيل ${money(r.collected)}. المتبقي على العميل ${money(r.balance)}`,
        });
      } else {
        beep(false);
        setCollectMsg({ ok: false, text: r.error });
      }
    });
  }

  /* --- إتمام البيع --- */
  function checkout() {
    setResult(null);
    if (needsShift) {
      beep(false);
      setShiftAlert(true);
      return;
    }
    if (discountError) {
      setResult({ ok: false, text: discountError });
      return;
    }
    if (payError) {
      setResult({ ok: false, text: payError });
      return;
    }
    startTransition(async () => {
      const r = await createInvoice({
        customerId: customerId ? Number(customerId) : null,
        discount: discountNum,
        paidAmount: paidNum,
        // وسيلة الدفع للمبلغ المدفوع الآن (null لو البيع آجل بالكامل)
        paymentMethod: paidNum > 0 ? method : null,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
        })),
      });
      if (r.ok) {
        beep(true);
        setResult({
          ok: true,
          text: `تم البيع بنجاح · فاتورة #${r.invoiceId} · الإجمالي ${money(r.total)}`,
          invoiceId: r.invoiceId,
        });
        setSold((s) => ({ count: s.count + 1, total: s.total + r.total }));
        setQty({});
        setCustomerId("");
        setDiscount("");
        setPayMode("cash");
        setMethod("cash");
        setPaid("");
        setSearch("");
        setBarcode("");
        setScan(null);
        barcodeRef.current?.focus();
      } else {
        beep(false);
        setResult({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
      {/* الوردية: فوق الصفحة */}
      {shiftRequired && (
        <div id="close-shift" className="scroll-mt-24 lg:col-span-2">
          <ShiftCloseForm initialShift={initialShift} canStart autoOpenStart />
        </div>
      )}

      {/* المنتجات */}
      <section className="min-w-0">
        {needsShift && (
          <div className="mb-3 flex flex-col items-stretch justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800 sm:flex-row sm:items-center sm:px-4 sm:text-sm">
            <span>
              لا توجد وردية مفتوحة. ابدأ الوردية وسجّل رصيد الدرج قبل إتمام البيع.
            </span>
            <button
              type="button"
              onClick={goStartShift}
              className="min-h-10 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition hover:bg-amber-700 sm:self-auto"
            >
              بدء الوردية
            </button>
          </div>
        )}

        {sold.count > 0 && (
          <p className="mb-3 rounded-xl bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-700 sm:px-4 sm:text-sm">
            مبيعاتك في هذه الجلسة: <strong>{sold.count}</strong> فاتورة ·{" "}
            <strong>{money(sold.total)}</strong>
          </p>
        )}

        {/* الباركود والبحث */}
        <div className="mb-4 min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="pos-barcode" className="text-xs font-semibold text-gray-500">
              الباركود
            </label>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setSound((s) => !s)}
                aria-pressed={sound}
                className="min-h-9 rounded-lg border px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50"
              >
                الصوت: {sound ? "يعمل" : "مكتوم"}
              </button>
              {cameraSupported && (
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="min-h-9 rounded-lg border px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50"
                >
                  مسح بالكاميرا
                </button>
              )}
            </div>
          </div>
          <input
            id="pos-barcode"
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                scanFromInput();
              }
            }}
            placeholder="امسح الباركود أو اكتبه ثم اضغط Enter"
            autoComplete="off"
            autoFocus
            dir="ltr"
            className={`${ui.input} min-h-12 w-full py-3 text-base`}
          />
          <p
            role="status"
            aria-live="polite"
            className={`mt-2 min-h-5 text-sm ${
              scan ? (scan.ok ? "text-green-700" : "text-red-600") : ""
            }`}
          >
            {scan?.text}
          </p>

          <div className="relative mt-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج بالاسم أو الباركود..."
              aria-label="بحث"
              className={`${ui.input} min-h-12 w-full py-3 pe-10 text-base`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="مسح البحث"
                className="absolute inset-y-0 end-3 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:gap-3 xl:grid-cols-3">
          {visible.map((p) => {
            const q = qty[p.id] ?? 0;
            const out = p.stock === 0;
            const maxed = q >= p.stock;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setQuantity(p, q + 1)}
                disabled={out || maxed}
                className={`flex min-h-[108px] min-w-0 flex-col justify-between rounded-xl border bg-white p-3 text-right shadow-sm transition active:scale-[0.99] sm:min-h-[116px] sm:p-4 ${
                  q > 0
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-semibold text-gray-900">{p.name}</p>
                    {p.barcode && (
                      <p
                        dir="ltr"
                        className="mt-0.5 truncate text-right text-xs text-gray-400"
                      >
                        {p.barcode}
                      </p>
                    )}
                  </div>
                  {q > 0 && (
                    <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                      × {q}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex min-w-0 items-end justify-between gap-2">
                  <span className="break-all text-base font-extrabold text-blue-700 sm:text-lg">
                    {money(p.price)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-xs ${
                      out
                        ? "bg-red-100 text-red-700"
                        : p.stock <= 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {out ? "نفد" : `متاح ${p.stock}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">
            مفيش منتجات مطابقة للبحث
          </p>
        )}
      </section>

      {/* الفاتورة */}
      <aside
        id="cart"
        className={`${ui.card} min-w-0 space-y-4 p-3 sm:p-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">الفاتورة</h2>
          {lines.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={holdCurrent}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                تعليق
              </button>
              <button
                type="button"
                onClick={() => setQty({})}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                تفريغ
              </button>
            </div>
          )}
        </div>

        {result && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            <p>{result.text}</p>
            {result.ok && result.invoiceId && (
              <a
                href={`/invoices/${result.invoiceId}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-semibold underline"
              >
                فتح الفاتورة للطباعة
              </a>
            )}
          </div>
        )}

        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400">
            <p className="mb-1 text-3xl">🛒</p>
            امسح الباركود أو اضغط على منتج لإضافته للفاتورة
          </div>
        ) : (
          <ul className="max-h-[42vh] divide-y overflow-y-auto overscroll-contain rounded-lg border border-gray-200 px-2 sm:px-3">
            {lines.map(({ product: p, quantity }) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium leading-5 text-gray-900">{p.name}</p>
                  <button
                    type="button"
                    onClick={() => setQuantity(p, 0)}
                    aria-label="حذف"
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(p, quantity - 1)}
                      className="h-9 w-9 shrink-0 rounded-lg border text-gray-700 transition hover:bg-gray-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={p.stock}
                      value={quantity}
                      onChange={(e) => setQuantity(p, Number(e.target.value))}
                      className="h-9 w-14 shrink-0 rounded-lg border bg-white text-center text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(p, quantity + 1)}
                      disabled={quantity >= p.stock}
                      className="h-9 w-9 shrink-0 rounded-lg border text-gray-700 transition hover:bg-gray-50 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {money(p.price * quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {held.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-semibold text-amber-800">
              فواتير معلّقة ({held.length})
            </p>
            <ul className="space-y-2">
              {held.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 text-gray-700">
                    {h.count} قطعة · {money(h.total)}
                    <span className="me-1 text-xs text-gray-400">
                      (
                      {h.at.toLocaleTimeString("ar-EG-u-nu-latn", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      )
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => restore(h)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      استرجاع
                    </button>
                    <button
                      type="button"
                      onClick={() => discardHeld(h.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      حذف
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-amber-700">
              المعلّقة تُفقد عند تحديث الصفحة.
            </p>
          </div>
        )}

        {/* العميل */}
        <div>
          <label htmlFor="pos-customer" className={sectionTitle}>
            العميل (اختياري)
          </label>
          <select
            id="pos-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={`${ui.input} w-full`}
          >
            <option value="">بدون عميل</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {customerId && (
            <div className="mt-3 space-y-2">
              {balance.status === "loading" && (
                <p className="text-xs text-gray-400">جارٍ التحقق من مستحقات العميل...</p>
              )}
              {balance.status === "error" && (
                <p className="text-xs text-red-600">{balance.text}</p>
              )}
              {balance.status === "ready" && balance.amount <= 0 && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  لا توجد مستحقات على العميل
                </p>
              )}
              {balance.status === "ready" && balance.amount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-800">على العميل مبلغ مستحق</span>
                    <span className="text-lg font-bold text-amber-800">
                      {money(balance.amount)}
                    </span>
                  </div>
                  <div className="mt-3 flex min-w-0 gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max={balance.amount}
                      step="0.01"
                      value={collectAmount}
                      onChange={(e) => {
                        setCollectAmount(e.target.value);
                        setCollectMsg(null);
                      }}
                      placeholder="مبلغ التحصيل"
                      aria-label="مبلغ التحصيل"
                      className={`${ui.input} min-w-0 w-full`}
                    />
                    <button
                      type="button"
                      onClick={() => setCollectAmount(balance.amount.toFixed(2))}
                      className="min-h-10 shrink-0 rounded-lg border bg-white px-3 text-xs text-gray-700 transition hover:bg-gray-50"
                    >
                      الكل
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={collect}
                    disabled={collecting || !(Number(collectAmount) > 0)}
                    className="mt-2 min-h-11 w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {collecting ? "جارٍ التحصيل..." : "تسجيل التحصيل"}
                  </button>
                </div>
              )}
              {collectMsg && (
                <p
                  role={collectMsg.ok ? "status" : "alert"}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    collectMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {collectMsg.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* الحساب */}
        <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>عدد القطع</span>
            <span>{count}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>المجموع</span>
            <span>{money(total)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pos-discount" className="text-gray-500">
              الخصم
            </label>
            <input
              id="pos-discount"
              type="number"
              inputMode="decimal"
              min="0"
              max={total}
              step="0.01"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
                setResult(null);
              }}
              placeholder="0.00"
              aria-invalid={!!discountError}
              className={`${ui.input} w-28 shrink-0 text-center ${
                discountError && discount !== "" ? "border-red-400" : ""
              }`}
            />
          </div>
          {discountError && discount !== "" && (
            <p className="text-xs text-red-600">{discountError}</p>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="font-semibold text-gray-700">الإجمالي بعد الخصم</span>
            <span className="text-2xl font-extrabold text-gray-900">
              {money(net)}
            </span>
          </div>
        </div>

        {/* طريقة الدفع */}
        <fieldset>
          <legend className={sectionTitle}>طريقة الدفع</legend>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {PAY_MODES.map(({ value, label, Icon }) => (
              <ChoiceButton
                key={value}
                active={payMode === value}
                label={label}
                Icon={Icon}
                onClick={() => {
                  setPayMode(value);
                  setResult(null);
                }}
              />
            ))}
          </div>

          {payMode === "partial" && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max={net}
                step="0.01"
                value={paid}
                onChange={(e) => {
                  setPaid(e.target.value);
                  setResult(null);
                }}
                placeholder="المدفوع الآن"
                aria-label="المدفوع الآن"
                className={`${ui.input} min-w-0 w-full`}
              />
              <button
                type="button"
                onClick={() => setPaid((net / 2).toFixed(2))}
                className="min-h-10 shrink-0 rounded-lg border px-3 text-xs text-gray-700 transition hover:bg-gray-50"
              >
                النصف
              </button>
            </div>
          )}

          {lines.length > 0 && paidNum > 0 && (
            <div className="mt-4">
              <span className={sectionTitle}>وسيلة الدفع</span>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {PAY_METHODS.map(({ value, label, Icon }) => (
                  <ChoiceButton
                    key={value}
                    active={method === value}
                    label={label}
                    Icon={Icon}
                    onClick={() => {
                      setMethod(value);
                      setResult(null);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {lines.length > 0 && (
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>المدفوع الآن</span>
                <span className="text-gray-900">{money(paidNum)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>المتبقي آجل</span>
                <span
                  className={
                    remaining > 0 ? "font-semibold text-amber-700" : "text-gray-900"
                  }
                >
                  {money(remaining)}
                </span>
              </div>
              {customerId && balance.status === "ready" && remaining > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>مستحق العميل بعد الفاتورة</span>
                  <span className="font-semibold text-gray-900">
                    {money(balance.amount + remaining)}
                  </span>
                </div>
              )}
            </div>
          )}

          {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
        </fieldset>

        <div>
          <button
            type="button"
            onClick={checkout}
            disabled={pending || lines.length === 0 || !!discountError || !!payError}
            className={`${ui.btn} w-full py-3 text-base`}
          >
            {pending ? "جارٍ الحفظ..." : "إتمام البيع"}
          </button>

          <button
            type="button"
            onClick={printDraft}
            disabled={lines.length === 0}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            طباعة مسودة (DRAFT)
          </button>
        </div>
      </aside>

      {/* شريط الموبايل */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_18px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
          <div>
            <p className="text-xs text-gray-500">{count} قطعة</p>
            <p className="text-lg font-extrabold text-gray-900" dir="ltr">{money(net)}</p>
          </div>
          <a href="#cart" className={ui.btn}>
            عرض الفاتورة
          </a>
        </div>
      )}

      {cameraOpen && (
        <CameraScanner
          onCode={(code) => handleCodeRef.current(code)}
          onClose={() => {
            setCameraOpen(false);
            barcodeRef.current?.focus();
          }}
        />
      )}

      {shiftAlert && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShiftAlert(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="shift-alert-title"
            aria-describedby="shift-alert-desc"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-5"
          >
            <h3 id="shift-alert-title" className="text-lg font-bold text-gray-900">
              يجب بدء الوردية أولًا
            </h3>
            <p id="shift-alert-desc" className="mt-2 text-sm leading-6 text-gray-600">
              لا يمكن إتمام البيع قبل بدء الوردية وتسجيل رصيد الدرج.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={goStartShift}
                className={ui.btn}
              >
                بدء الوردية
              </button>
              <button
                type="button"
                onClick={() => setShiftAlert(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}