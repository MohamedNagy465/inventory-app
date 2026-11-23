
import { getSession } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { logout } from "../actions/auth";
import Link from "next/link";

const roleLabel = {
  ADMIN: "مدير النظام",
  EMPLOYEE: "موظف",
  SELLER: "بائع",
  REP: "مندوب",
} as const;

export default async function AppHeader() {
  const session = await getSession();

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  const displayName = user?.name ?? session.email;

  return (
    <header
      dir="rtl"
      className="sticky top-0 z-30 h-16 w-full border-b border-gray-200 bg-white shadow-sm print:hidden"
    >
      <div className="mx-auto flex h-full w-full max-w-[1920px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex min-w-0 shrink items-center gap-1.5 text-gray-900 sm:gap-2"
        >
          <span className="shrink-0 text-xl sm:text-2xl">
            📦
          </span>

          <span className="truncate text-sm font-extrabold sm:text-lg">
            نظام المخزون
          </span>
        </Link>

        {/* User Information */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-5">

          {/* User */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 sm:h-10 sm:w-10 sm:text-base">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="max-w-[140px] truncate text-sm font-semibold text-gray-800 md:max-w-[200px]">
                {displayName}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {roleLabel[session.role as keyof typeof roleLabel] ?? "مستخدم"}
              </p>
            </div>
          </div>

          {/* Logout */}
          <form action={logout}>
            <button
              type="submit"
              aria-label="تسجيل الخروج"
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg bg-red-50 px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 active:bg-red-200 sm:h-10 sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">خروج</span>
              <span className="hidden sm:inline">
                تسجيل الخروج
              </span>
            </button>
          </form>

        </div>
      </div>
    </header>
  );
}
