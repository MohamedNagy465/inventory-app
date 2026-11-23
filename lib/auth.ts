
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "inventory_session";

export type Role = "ADMIN" | "EMPLOYEE" | "SELLER" | "REP";

export type SessionPayload = {
  userId: number;
  email: string;
  role: Role;
};

// الصفحة الرئيسية لكل دور
export function homeFor(role: Role) {
  if (role === "SELLER") return "/invoices";
  if (role === "REP") return "/rep";
  return "/dashboard";
}

// مفتاح تشفير JWT
function getSecret() {
  const secretValue = process.env.JWT_SECRET;

  if (!secretValue || !secretValue.trim()) {
    throw new Error(
      "JWT_SECRET is missing or empty. Check your .env file."
    );
  }

  return new TextEncoder().encode(secretValue);
}

// إنشاء جلسة المستخدم
export async function createSession(user: SessionPayload) {
  const secret = getSecret();

  const token = await new SignJWT({
    userId: user.userId,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

// قراءة والتحقق من جلسة المستخدم
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "number" ||
      typeof payload.email !== "string" ||
      (payload.role !== "ADMIN" &&
        payload.role !== "EMPLOYEE" &&
        payload.role !== "SELLER" &&
        payload.role !== "REP")
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// حذف جلسة المستخدم
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// التحقق من تسجيل الدخول والصلاحيات
export async function requireRole(allowed: Role[]) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!allowed.includes(session.role)) {
    redirect(homeFor(session.role));
  }

  return session;
}
