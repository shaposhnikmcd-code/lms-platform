import prisma from '@/lib/prisma';
import {
  buildLiveIdentityIndex,
  isOrphanPendingDuplicate,
} from '@/lib/yearlyProgramVisibility';

export interface ArchiveDuplicatesResult {
  archived: string[];
  errors: string[];
}

/// Event-driven авто-архів дублів незавершених спроб оплати.
///
/// Викликається у момент, коли підписка стала ACTIVE після успішної оплати (WFP-callback).
/// Знаходить усі інші PENDING-підписки ТІЄЇ САМОЇ людини (матчинг по userId, нормалізованому
/// телефону і Telegram-ніку — той самий предикат, що ховає рядки в адмінці) і переводить їх
/// у ARCHIVED. Без цього дублі жили б до нічного cron-у `archiveStalePending` (24 год) і весь
/// цей час «В очікуванні» у KPI брехало на +1.
///
/// Guard-и (ідентичні cron-у):
///   • не чіпаємо PENDING з реальним PAID-платежем;
///   • не чіпаємо ручно доданих менеджером (manuallyAddedAt != null);
///   • апдейт через `updateMany` з тими самими умовами у `where` — захист від рейсу,
///     якщо людина встигла оплатити саме між вибіркою й апдейтом.
///
/// Ніколи не кидає — помилки повертаються у `errors`, щоб не завалити обробку платежу.
export async function archiveDuplicatePendingSubscriptions(activeSub: {
  id: string;
  userId: string;
  phone?: string | null;
  telegramUsername?: string | null;
}): Promise<ArchiveDuplicatesResult> {
  const result: ArchiveDuplicatesResult = { archived: [], errors: [] };

  try {
    const liveIndex = buildLiveIdentityIndex([
      {
        userId: activeSub.userId,
        status: 'ACTIVE',
        phone: activeSub.phone ?? null,
        telegramUsername: activeSub.telegramUsername ?? null,
        hasPaidPayment: true,
      },
    ]);

    // Кандидати: всі відкриті PENDING без оплати й не ручні. Набір малий (це живі
    // незавершені чекаути), тож нормалізацію телефону/TG робимо в JS — у SQL формати
    // збереження надто різні (+380, 380, пробіли, дужки).
    const candidates = await prisma.yearlyProgramSubscription.findMany({
      where: {
        status: 'PENDING',
        id: { not: activeSub.id },
        manuallyAddedAt: null,
        payments: { none: { status: 'PAID' } },
      },
      select: { id: true, userId: true, phone: true, telegramUsername: true },
    });

    const duplicates = candidates.filter((c) =>
      isOrphanPendingDuplicate(
        {
          userId: c.userId,
          status: 'PENDING',
          phone: c.phone,
          telegramUsername: c.telegramUsername,
          manuallyAddedAt: null,
          hasPaidPayment: false,
        },
        liveIndex,
      ),
    );

    for (const dup of duplicates) {
      try {
        const claim = await prisma.yearlyProgramSubscription.updateMany({
          where: {
            id: dup.id,
            status: 'PENDING',
            manuallyAddedAt: null,
            payments: { none: { status: 'PAID' } },
          },
          data: { status: 'ARCHIVED' },
        });
        if (claim.count === 0) continue; // встигли оплатити / хтось інший заархівував

        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: dup.id,
            type: 'admin_action',
            message: `Авто-архів: дубль незавершеної спроби — той самий клієнт оплатив успішно (subscription ${activeSub.id})`,
            metadata: {
              reason: 'duplicate-pending-on-successful-payment',
              paidSubscriptionId: activeSub.id,
            },
          },
        });
        result.archived.push(dup.id);
      } catch (e) {
        result.errors.push(`${dup.id}: ${(e as Error).message.slice(0, 200)}`);
      }
    }
  } catch (e) {
    result.errors.push((e as Error).message.slice(0, 200));
  }

  return result;
}
