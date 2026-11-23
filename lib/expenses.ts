export const EXPENSE_CATEGORIES = [
  { value: "RENT", label: "إيجار" },
  { value: "SALARIES", label: "مرتبات" },
  { value: "UTILITIES", label: "كهرباء ومياه وإنترنت" },
  { value: "TRANSPORT", label: "نقل ومواصلات" },
  { value: "MAINTENANCE", label: "صيانة" },
  { value: "SUPPLIES", label: "مستلزمات تشغيل" },
  { value: "OTHER", label: "أخرى" },
] as const;

export type ExpenseCategory =
  (typeof EXPENSE_CATEGORIES)[number]["value"];

export function isExpenseCategory(
  value: string
): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.some(
    (category) => category.value === value
  );
}

export function expenseCategoryLabel(value: string) {
  return (
    EXPENSE_CATEGORIES.find(
      (category) => category.value === value
    )?.label ?? value
  );
}