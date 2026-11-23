
import { getSession } from "../../lib/auth";
import NavLinks, { type Role } from "./NavLinks";

const roleLabels: Record<Role, string> = {
  ADMIN: "مدير النظام",
  EMPLOYEE: "موظف",
  SELLER: "بائع",
  REP: "مندوب",
};

const allowedRoles: Role[] = [
  "ADMIN",
  "EMPLOYEE",
  "SELLER",
  "REP",
];

export default async function Sidebar() {
  const session = await getSession();

  if (
    !session ||
    !allowedRoles.includes(session.role as Role)
  ) {
    return null;
  }

  const role = session.role as Role;

  return (
    <aside
      className="
        relative z-20 w-full min-w-0 shrink-0
        border-b border-gray-200 bg-white

        lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]
        lg:w-64 lg:self-start lg:overflow-y-auto
        lg:border-b-0 lg:border-l
      "
    >
      <div className="min-w-0 p-2 sm:p-3 lg:p-5">

        {/* Desktop brand */}
        <div className="mb-6 hidden border-b border-gray-100 pb-5 lg:block">
          <p className="text-xs font-medium text-gray-400">
            نظام إدارة الأعمال
          </p>

          <h2 className="mt-2 text-lg font-bold text-gray-900">
            📦 نظام المخزون
          </h2>

          <div className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {roleLabels[role]}
          </div>
        </div>

        {/* Mobile navigation heading */}
        <div className="mb-2 flex items-center justify-between px-2 lg:hidden">
          <span className="text-xs font-bold text-gray-700">
            القائمة الرئيسية
          </span>

          <span className="text-[10px] text-gray-400">
            اسحب للتنقل ←
          </span>
        </div>

        {/* Desktop navigation heading */}
        <p className="mb-2 hidden px-3 text-xs font-semibold text-gray-400 lg:block">
          القائمة الرئيسية
        </p>

        {/* Navigation */}
        <NavLinks
          role={role}
          className="
            flex-row items-stretch
            overflow-x-auto overscroll-x-contain
            snap-x snap-mandatory
            pb-2
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden

            lg:flex-col lg:items-stretch
            lg:overflow-visible lg:pb-0
            lg:snap-none
          "
        />
      </div>
    </aside>
  );
}
