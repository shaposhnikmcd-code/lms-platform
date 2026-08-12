/// Лічильник використань глобального промокоду (`PromoCode.usedCount` vs `maxUses`).
///
/// Чому raw SQL, а не read-modify-write: перевірка ліміту і сам інкремент мають бути
/// ОДНІЄЮ атомарною операцією (compare-and-swap). Інакше два паралельні чекаути читають
/// `usedCount = 0` при `maxUses = 1`, обидва бачать «ліміт вільний» і обидва отримують
/// знижку.
///
/// Правило використання: `claimPromoUse` викликається ДО того, як знижена ціна пішла
/// в Payment і в підпис WayForPay. Якщо повернув `false` — ліміт вичерпано, і ціну
/// треба перерахувати БЕЗ промо. Інакше знижка вже застосована, а лічильник —
/// ні: продавали б за акційною ціною безкінечно.
///
/// `releasePromoUse` повертає використання назад, коли чекаут не став оплатою
/// (Declined/Expired) або коли на тому самому замовленні промокод замінили на інший.
/// Ідемпотентність — на боці викликача: він обнуляє `Payment.promoCodeId` і за цим
/// маркером більше сюди не заходить.

import prisma from './prisma';

/// Атомарно займає одне використання. `true` — зайняли, знижку давати можна.
/// `false` — код неактивний або ліміт вичерпано (жодного рядка не оновлено).
export async function claimPromoUse(promoId: string): Promise<boolean> {
  const rows = await prisma.$executeRaw`
    UPDATE "PromoCode"
    SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${promoId}
      AND "active" = true
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `;
  return rows > 0;
}

/// Повертає одне використання в ліміт. `usedCount > 0` — щоб подвійний виклик
/// не загнав лічильник у мінус.
export async function releasePromoUse(promoId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "PromoCode"
    SET "usedCount" = "usedCount" - 1
    WHERE "id" = ${promoId}
      AND "usedCount" > 0
  `;
}
