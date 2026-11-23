// طباعة مسودة فاتورة: لا تُحفظ في قاعدة البيانات ولا تؤثر على المخزون.
// تُستخدم من مكوّنات العميل فقط (تعتمد على document).

export type DraftLine = { name: string; quantity: number; price: number };

export type DraftData = {
  customerName: string;
  payLabel: string;
  lines: DraftLine[];
  subtotal: number;
  discount: number;
  net: number;
  paid: number;
  remaining: number;
};

const money = (n: number) => n.toFixed(2);

const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function printDraftInvoice(d: DraftData) {
  if (d.lines.length === 0) return;

  const when = new Date().toLocaleString("ar-EG-u-nu-latn", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = d.lines
    .map(
      (l) =>
        `<tr><td>${esc(l.name)}</td><td>${l.quantity}</td><td>${money(l.price)}</td><td>${money(l.price * l.quantity)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>مسودة فاتورة</title>
<style>
  body { font-family: system-ui, "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 13px; color: #555; margin-bottom: 16px; line-height: 1.8; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: right; }
  th { background: #f5f5f5; }
  .tot { margin-top: 16px; width: 55%; margin-inline-start: auto; font-size: 14px; }
  .tot div { display: flex; justify-content: space-between; padding: 4px 0; }
  .tot .net { font-weight: 700; font-size: 18px; border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; }
  .wm { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 120px; font-weight: 700; color: rgba(0,0,0,0.08); transform: rotate(-25deg); pointer-events: none; }
  .note { margin-top: 28px; font-size: 12px; color: #777; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
<div class="wm">DRAFT</div>
<h1>مسودة فاتورة</h1>
<div class="meta">
  التاريخ: ${esc(when)}<br>
  العميل: ${esc(d.customerName)}<br>
  طريقة الدفع: ${esc(d.payLabel)}
</div>
<table>
  <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="tot">
  <div><span>المجموع</span><span>${money(d.subtotal)}</span></div>
  ${d.discount > 0 ? `<div><span>الخصم</span><span>${money(d.discount)}</span></div>` : ""}
  <div class="net"><span>الإجمالي</span><span>${money(d.net)}</span></div>
  <div><span>المدفوع</span><span>${money(d.paid)}</span></div>
  <div><span>المتبقي آجل</span><span>${money(d.remaining)}</span></div>
</div>
<p class="note">هذه مسودة غير معتمدة، ولا تُعد فاتورة نهائية ولا تؤثر على المخزون.</p>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  win.addEventListener("afterprint", () => iframe.remove());
  setTimeout(() => {
    win.focus();
    win.print();
  }, 200);
}