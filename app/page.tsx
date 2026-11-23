import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "../lib/auth";

// الصفحة الرئيسية للموقع: بتوجّه كل شخص لصفحة دوره، أو للدخول
async function Go() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
  return null;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  );
}