import { requireRole, type Role } from "./auth";

// لفّ أي صفحة بالمكوّن ده (جوه Suspense) عشان تحدد مين يدخلها
export default async function RoleGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  await requireRole(allow);
  return <>{children}</>;
}