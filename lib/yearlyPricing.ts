import prisma from "@/lib/prisma";

/// Дефолтні ціни Річної програми. Override-яться через `CategoryPromoOverride.price`
/// (category="yearly" або "monthly").
export const YEARLY_DEFAULT_PRICE = 15000;
export const MONTHLY_DEFAULT_PRICE = 2200;

export interface YearlyPricing {
  yearlyPrice: number;
  yearlyOldPrice: number | null;
  monthlyPrice: number;
  monthlyOldPrice: number | null;
}

/// Резолвить актуальні ціни Річної програми з override-ів.
/// Fallback на дефолти, якщо рядки в БД відсутні.
export async function getYearlyPricing(): Promise<YearlyPricing> {
  try {
    const rows = await prisma.categoryPromoOverride.findMany({
      where: { category: { in: ["yearly", "monthly"] } },
      select: { category: true, price: true, oldPrice: true },
    });
    const byCategory = new Map(rows.map((r) => [r.category, r]));
    const yearly = byCategory.get("yearly");
    const monthly = byCategory.get("monthly");
    return {
      yearlyPrice: yearly?.price ?? YEARLY_DEFAULT_PRICE,
      yearlyOldPrice: yearly?.oldPrice ?? null,
      monthlyPrice: monthly?.price ?? MONTHLY_DEFAULT_PRICE,
      monthlyOldPrice: monthly?.oldPrice ?? null,
    };
  } catch {
    return {
      yearlyPrice: YEARLY_DEFAULT_PRICE,
      yearlyOldPrice: null,
      monthlyPrice: MONTHLY_DEFAULT_PRICE,
      monthlyOldPrice: null,
    };
  }
}
