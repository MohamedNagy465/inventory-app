
"use client";

import { useActionState, useState } from "react";
import { login } from "../actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main
      dir="rtl"
      className="flex min-h-screen min-h-dvh items-center justify-center bg-gray-100 px-3 py-6 sm:px-5 sm:py-10"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-lg shadow-gray-200/60 sm:p-8">

        {/* Header */}
        <div className="mb-7 text-center sm:mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white shadow-md shadow-blue-200 sm:h-16 sm:w-16">
            📦
          </div>

          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
            Inventory System
          </h1>

          <p className="mt-2 text-xs leading-6 text-gray-500 sm:text-sm">
            سجل دخولك لإدارة المخزون والمبيعات
          </p>
        </div>

        {/* Login form */}
        <form action={formAction} className="space-y-4 sm:space-y-5">

          {/* Email */}
          <div className="min-w-0">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              البريد الإلكتروني
            </label>

            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="example@email.com"
              autoComplete="username"
              className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              dir="ltr"
            />
          </div>

          {/* Password */}
          <div className="min-w-0">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              كلمة المرور
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
                className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pl-20 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                dir="ltr"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                }
                aria-pressed={showPassword}
                className="absolute left-2 top-1/2 flex min-h-9 -translate-y-1/2 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-gray-500 transition hover:bg-blue-50 hover:text-blue-600"
              >
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>

          {/* Error */}
          {state?.error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-600"
            >
              {state.error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            {pending ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-7 border-t border-gray-100 pt-5 text-center sm:mt-8">
          <p className="text-[11px] text-gray-400 sm:text-xs">
            Inventory Management System
          </p>
        </div>

      </div>
    </main>
  );
}
