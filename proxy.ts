import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "inventory_session";

type Role = "ADMIN" | "EMPLOYEE" | "SELLER" | "REP";

async function verifySession(token: string) {
  try {
    const secretValue = process.env.JWT_SECRET;

    if (!secretValue) return null;

    const secret = new TextEncoder().encode(secretValue);

    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

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

    return { userId: payload.userId, role: payload.role as Role };
  } catch {
    return null;
  }
}

function homeFor(role: Role) {
  if (role === "SELLER") return "/invoices";
  if (role === "REP") return "/rep";
  return "/products";
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (pathname === "/login") {
      return NextResponse.next();
    }

    const response = NextResponse.redirect(new URL("/login", request.url));

    if (token) {
      response.cookies.delete(COOKIE_NAME);
    }

    return response;
  }

  const home = homeFor(session.role);

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // البائع للفواتير بس، والمندوب لصفحته بس
  if (
    (session.role === "SELLER" || session.role === "REP") &&
    !pathname.startsWith(home)
  ) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // المستخدمين للمدير بس
  if (pathname.startsWith("/users") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // الطلبات للمدير والموظف
  if (
    pathname.startsWith("/orders") &&
    session.role !== "ADMIN" &&
    session.role !== "EMPLOYEE"
  ) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/products/:path*",
    "/customers/:path*",
    "/invoices/:path*",
    "/users/:path*",
    "/rep/:path*",
    "/orders/:path*",
  ],
};