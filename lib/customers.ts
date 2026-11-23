import { prisma } from "./prisma";

/** لازم يطابق CASH_CUSTOMER_NAME في SellerPOS.tsx */
export const CASH_CUSTOMER_NAME = "عميل نقدي";

/** يرجّع id العميل النقدي، وينشئه لو مش موجود */
export async function ensureCashCustomer() {
  const existing = await prisma.customer.findFirst({
    where: { name: CASH_CUSTOMER_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.customer.create({
    data: { name: CASH_CUSTOMER_NAME },
    select: { id: true },
  });
  return created.id;
}