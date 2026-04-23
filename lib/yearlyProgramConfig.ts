/// Централізований конфіг Річної програми.
/// Імена продуктів (product_name для SendPulse event та WFP Purchase), orderReference-префікси,
/// тривалість доступу, grace-період, SendPulse course ID.

export const YEARLY_PROGRAM_CONFIG = {
  /// Префікс orderReference для річної (одноразової) оплати. Має збігатись з config у config.ts.
  yearlyOrderPrefix: 'yearly-program',
  /// Префікс orderReference для місячної (регулярної) оплати.
  monthlyOrderPrefix: 'yearly-program-monthly',

  /// Slug/product_name, який шлеться в SendPulse event і за яким воронка відкриває доступ.
  /// Має збігатись з courseId в app/[locale]/yearly-program/config.ts.
  sendpulseEventSlug: 'yearly-program',

  /// Числовий ID курсу в SendPulse Education API (для DELETE /students/{studentId}/{courseId}).
  /// Якщо не заданий — закриття доступу буде пропущене з помилкою в лог. Заповни після
  /// перегляду URL курсу в кабінеті SendPulse → Автоматизація → Онлайн-курси.
  sendpulseCourseId: Number(process.env.SENDPULSE_YEARLY_COURSE_ID) || null,

  /// Тривалість доступу після успішної оплати.
  yearlyDurationDays: 365,
  monthlyDurationDays: 30,

  /// Скільки всього щомісячних списань має бути у Місячній підписці (включно з першим Purchase).
  /// Програма триває 9 місяців → 9 платежів → після 9-го списання WFP припиняє регулярку.
  totalMonthlyPayments: 9,

  /// Grace-період після expiresAt, протягом якого доступ залишається відкритим.
  graceDays: 7,

  /// Нагадування — за скільки днів до expiresAt.
  reminderDaysBefore: [3, 1],
} as const;

export function isYearlyProgramOrderRef(orderReference: string): 'yearly' | 'monthly' | null {
  // Увага: monthly префікс містить "yearly-program", тому перевіряємо його ПЕРШИМ.
  if (orderReference.startsWith(`${YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix}_`)) return 'monthly';
  if (orderReference.startsWith(`${YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix}_`)) return 'yearly';
  return null;
}

/// Ключ у `AppSetting` для runtime-конфігурованого grace-періоду (у днях).
/// Зміна з адмінки впливає тільки на нові переходи ACTIVE→GRACE —
/// існуючі GRACE-записи мають `gracePeriodEndsAt` зафіксованим.
export const YEARLY_GRACE_SETTING_KEY = 'yearlyGraceDays';
export const YEARLY_GRACE_MIN_DAYS = 1;
export const YEARLY_GRACE_MAX_DAYS = 90;

/// Читає актуальне значення graceDays з БД. Fallback на константу з config —
/// означає «ніхто ще не змінював із UI» (рядок у AppSetting не створено).
export async function getYearlyGraceDays(
  prismaClient: { appSetting: { findUnique: (args: { where: { key: string } }) => Promise<{ value: number } | null> } },
): Promise<number> {
  try {
    const row = await prismaClient.appSetting.findUnique({
      where: { key: YEARLY_GRACE_SETTING_KEY },
    });
    return row?.value ?? YEARLY_PROGRAM_CONFIG.graceDays;
  } catch {
    /// Якщо таблиця ще не мігрована (rare race перед deploy) — безпечний fallback.
    return YEARLY_PROGRAM_CONFIG.graceDays;
  }
}
