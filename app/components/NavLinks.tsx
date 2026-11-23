
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Role = "ADMIN" | "EMPLOYEE" | "SELLER" | "REP";

const links: {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}[] = [
  {
    href: "/dashboard",
    label: "الرئيسية",
    icon: "⌂",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    href: "/products",
    label: "المنتجات",
    icon: "▦",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    href: "/customers",
    label: "العملاء",
    icon: "♙",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    href: "/purchases",
    label: "المشتريات",
    icon: "▤",
    roles: ["ADMIN"],
  },
  {
    href: "/invoices",
    label: "الفواتير",
    icon: "▤",
    roles: ["ADMIN", "EMPLOYEE", "SELLER"],
  },
  {
    href: "/orders",
    label: "الطلبات",
    icon: "⇄",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    href: "/rep",
    label: "المندوب",
    icon: "♧",
    roles: ["ADMIN", "REP"],
  },
  {
    href: "/stock-movements",
    label: "حركة المخزون",
    icon: "⇅",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    href: "/users",
    label: "المستخدمين",
    icon: "♙",
    roles: ["ADMIN"],
  },
];

export default function NavLinks({
  role,
  className = "",
}: {
  role: Role;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="القائمة الرئيسية"
      className={`flex min-w-0 items-center gap-1 ${className}`}
    >
      {links
        .filter((link) => link.roles.includes(role))
        .map((link) => {
          const active =
            pathname === link.href ||
            pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`
                group relative flex min-w-[78px] shrink-0
                snap-start flex-col items-center justify-center
                gap-1 rounded-xl px-2 py-2.5 text-center
                text-[11px] font-semibold transition

                sm:min-w-[96px] sm:flex-row sm:gap-2
                sm:px-3 sm:py-3 sm:text-sm

                lg:w-full lg:min-w-0 lg:justify-start
                lg:rounded-xl lg:px-3 lg:py-3

                ${
                  active
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }
              `}
            >
              <span
                className={`
                  flex h-8 w-8 shrink-0 items-center justify-center
                  rounded-lg text-lg transition
                  ${
                    active
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                  }
                `}
              >
                {link.icon}
              </span>

              <span className="max-w-full truncate leading-5">
                {link.label}
              </span>

              {active && (
                <span className="ms-auto hidden h-2 w-2 shrink-0 rounded-full bg-blue-600 lg:block" />
              )}
            </Link>
          );
        })}
    </nav>
  );
}
