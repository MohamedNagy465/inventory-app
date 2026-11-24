
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

import AppHeader from "./components/AppHeader";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  applicationName: "نظام المخزون",
  title: "نظام المخزون",
  description: "إدارة المخزون والمبيعات",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "نظام المخزون",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col bg-gray-50 antialiased">

        {/* Top Header */}
        <Suspense fallback={null}>
          <AppHeader />
        </Suspense>

        {/* Sidebar + Main Content */}
        <div className="flex flex-1 flex-col lg:flex-row">

          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>

          <div className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1600px]">
              {children}
            </div>
          </div>

        </div>
      </body>
    </html>
  );
}
