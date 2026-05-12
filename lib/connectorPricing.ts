import prisma from "@/lib/prisma";

/// Дефолтна ціна гри Конектор. Якщо в `CategoryPromoOverride.price`
/// (category="connector") задано значення — воно перекриває цю константу.
export const CONNECTOR_DEFAULT_PRICE = 1099;

/// Адмін/менеджер тестова ціна (символічна, для перевірки callback-флоу).
export const CONNECTOR_ADMIN_TEST_PRICE = 1;

export interface ConnectorPricing {
  price: number;
  oldPrice: number | null;
}

/// Резолвить актуальну ціну Конектора з override-у. Якщо override відсутній
/// або поле порожнє — повертає дефолт. `oldPrice` — null, якщо не задано.
export async function getConnectorPricing(): Promise<ConnectorPricing> {
  try {
    const row = await prisma.categoryPromoOverride.findUnique({
      where: { category: "connector" },
      select: { price: true, oldPrice: true },
    });
    return {
      price: row?.price ?? CONNECTOR_DEFAULT_PRICE,
      oldPrice: row?.oldPrice ?? null,
    };
  } catch {
    return { price: CONNECTOR_DEFAULT_PRICE, oldPrice: null };
  }
}
