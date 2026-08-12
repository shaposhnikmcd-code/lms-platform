/// Запис події VIEWED для публічної верифікації сертифіката — з дедуплікацією.
///
/// Навіщо: сторінка `/[locale]/certificate/[token]` і API `/api/certificate/[token]`
/// писали подію на КОЖНЕ відкриття. Один перегляд сторінки = мінімум 2 рядки, а
/// оновлення F5 / рефреш вкладки роздували журнал так, що реальні події (SENT,
/// REVOKED) губилися серед сотень VIEWED. Тепер — не частіше ніж раз на годину
/// на пару (сертифікат, IP).

import prisma from '@/lib/prisma';

const VIEW_THROTTLE_MS = 60 * 60 * 1000;

export function clientIpFrom(headerValue: string | null | undefined): string | null {
  return headerValue?.split(',')[0].trim() || null;
}

export async function logCertificateView(
  certificateId: string,
  ip: string | null,
  ua: string | null,
): Promise<void> {
  try {
    /// Без IP дедуплікувати нема по чому — пишемо як є (рідкісний випадок).
    if (ip) {
      const recent = await prisma.certificateEvent.findFirst({
        where: {
          certificateId,
          action: 'VIEWED',
          createdAt: { gte: new Date(Date.now() - VIEW_THROTTLE_MS) },
          metadata: { path: ['ip'], equals: ip },
        },
        select: { id: true },
      });
      if (recent) return;
    }

    await prisma.certificateEvent.create({
      data: {
        certificateId,
        action: 'VIEWED',
        metadata: { ip, ua } as object,
      },
    });
  } catch {
    /// Журнал переглядів — не критичний шлях: ніколи не валимо через нього рендер.
  }
}
