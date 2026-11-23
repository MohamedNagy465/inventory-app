"use server";

import { prisma } from "../../lib/prisma";
import { createSession, deleteSession, homeFor, type Role } from "../../lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export type LoginState = {
  error: string;
} | null;

const VALID_ROLES: Role[] = ["ADMIN", "EMPLOYEE", "SELLER", "REP"];

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "من فضلك أدخل البريد الإلكتروني وكلمة المرور",
    };
  }

  let role: Role;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return {
        error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
      };
    }

    if (!VALID_ROLES.includes(user.role as Role)) {
      return {
        error: "حساب المستخدم غير صالح",
      };
    }

    role = user.role as Role;

    await createSession({
      userId: user.id,
      email: user.email,
      role,
    });
  } catch (error) {
    console.error("Login error:", error);

    return {
      error: "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى",
    };
  }

  // كل دور يروح على صفحته
  redirect(homeFor(role));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}