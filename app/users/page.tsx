
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { requireRole } from "../../lib/auth";
import { ui } from "../../lib/ui";

async function addUser(formData: FormData) {
  "use server";

  await requireRole(["ADMIN"]);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  if (role !== "SELLER" && role !== "REP") return;
  if (!name || !email.includes("@") || password.length < 8) return;

  const exists = await prisma.user.findUnique({
    where: { email },
  });

  if (exists) return;

  await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
    },
  });

  revalidatePath("/users");
}

const roleLabel: Record<string, string> = {
  ADMIN: "مدير",
  EMPLOYEE: "موظف",
  SELLER: "بائع",
  REP: "مندوب",
};

const roleStyle: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  EMPLOYEE: "bg-gray-100 text-gray-700",
  SELLER: "bg-blue-100 text-blue-700",
  REP: "bg-amber-100 text-amber-700",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        roleStyle[role] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {roleLabel[role] ?? role}
    </span>
  );
}

async function UsersContent() {
  await requireRole(["ADMIN"]);

  const users = await prisma.user.findMany({
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* ================================== */}
      {/* ADD USER FORM */}
      {/* ================================== */}

      <form action={addUser} className={`${ui.card} min-w-0`}>
        <div className="mb-4">
          <h2 className="font-bold text-gray-800">
            إضافة مستخدم جديد
          </h2>

          <p className="mt-1 text-xs leading-6 text-gray-500 sm:text-sm">
            البائع يبيع من صفحة الفواتير بس. المندوب يشوف المنتجات
            ويبيع أو يرسل طلبات من صفحته.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="min-w-0">
            <label
              htmlFor="user-name"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              الاسم
            </label>

            <input
              id="user-name"
              name="name"
              type="text"
              placeholder="اسم المستخدم"
              required
              autoComplete="name"
              className={`${ui.input} min-h-11 w-full`}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="user-email"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              الإيميل
            </label>

            <input
              id="user-email"
              name="email"
              type="email"
              placeholder="example@email.com"
              required
              autoComplete="email"
              className={`${ui.input} min-h-11 w-full`}
              dir="ltr"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="user-password"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              كلمة السر
            </label>

            <input
              id="user-password"
              name="password"
              type="password"
              minLength={8}
              placeholder="8 حروف على الأقل"
              required
              autoComplete="new-password"
              className={`${ui.input} min-h-11 w-full`}
              dir="ltr"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="user-role"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              الدور
            </label>

            <select
              id="user-role"
              name="role"
              defaultValue="REP"
              className={`${ui.input} min-h-11 w-full`}
            >
              <option value="REP">مندوب</option>
              <option value="SELLER">بائع</option>
            </select>
          </div>

          <div className="flex min-w-0 items-end">
            <button
              type="submit"
              className={`${ui.btn} flex min-h-11 w-full items-center justify-center`}
            >
              إضافة المستخدم
            </button>
          </div>
        </div>
      </form>

      {/* ================================== */}
      {/* USERS LIST HEADER */}
      {/* ================================== */}

      <div className={`${ui.tableCard} min-w-0 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-3 sm:px-4">
          <div>
            <h2 className="font-bold text-gray-800">
              قائمة المستخدمين
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              مراجعة حسابات البائعين والمندوبين
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {users.length} مستخدم
          </span>
        </div>

        {/* ================================== */}
        {/* MOBILE CARDS */}
        {/* ================================== */}

        <div className="space-y-3 p-3 md:hidden">
          {users.map((user) => (
            <article
              key={user.id}
              className="min-w-0 rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">
                    الاسم
                  </p>

                  <h3 className="mt-1 break-words text-sm font-bold text-gray-900">
                    {user.name}
                  </h3>
                </div>

                <div className="shrink-0">
                  <RoleBadge role={user.role} />
                </div>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-[11px] text-gray-500">
                  البريد الإلكتروني
                </p>

                <p
                  className="mt-1 break-all text-sm font-medium text-gray-700"
                  dir="ltr"
                >
                  {user.email}
                </p>
              </div>
            </article>
          ))}

          {users.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-gray-600">
                لا يوجد مستخدمون حتى الآن.
              </p>

              <p className="mt-1 text-xs text-gray-400">
                أضف أول بائع أو مندوب من النموذج بالأعلى.
              </p>
            </div>
          )}
        </div>

        {/* ================================== */}
        {/* DESKTOP TABLE */}
        {/* ================================== */}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-right">
            <thead className="bg-gray-50">
              <tr>
                <th className={ui.th}>الاسم</th>
                <th className={ui.th}>الإيميل</th>
                <th className={ui.th}>الدور</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="transition hover:bg-gray-50"
                >
                  <td className={`${ui.td} font-semibold`}>
                    {user.name}
                  </td>

                  <td className={ui.td}>
                    <span dir="ltr">{user.email}</span>
                  </td>

                  <td className={ui.td}>
                    <RoleBadge role={user.role} />
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className={ui.empty}>
                    لا يوجد مستخدمون حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PAGE
// ==========================================

export default function UsersPage() {
  return (
    <main dir="rtl" className={`${ui.page} min-w-0`}>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
          المستخدمين
        </h1>

        <p className="mt-1 text-xs leading-6 text-gray-500 sm:text-sm">
          إضافة البائعين والمندوبين ومراجعة الحسابات
        </p>
      </div>

      <Suspense
        fallback={
          <p className="py-6 text-center text-sm text-gray-400">
            جارٍ تحميل المستخدمين...
          </p>
        }
      >
        <UsersContent />
      </Suspense>
    </main>
  );
}
