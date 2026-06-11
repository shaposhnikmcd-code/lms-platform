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

  /// Скільки місяців доступу до платформи студент отримує ПІСЛЯ дати завершення Річної
  /// програми (cohort.endDate). Напр. програма завершується 31.05.2027 + 6 міс = доступ
  /// до 30.11.2027. Стосується і YEARLY (одразу), і MONTHLY (після повної сплати всіх платежів).
  postAccessMonths: 6,

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
/// MIN=2 щоб уникнути сценарію «start + closed в один день/24h»: при graceDays=1
/// cron-розклад вироджується і студент отримує «доступ продовжено на 1 день» одразу
/// перед «доступ закрито». 2 дні дають хоча б один день буфера між листами.
export const YEARLY_GRACE_MIN_DAYS = 2;
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

/// Ключ у `AppSetting` для runtime-конфігурованого SendPulse course ID Річної програми.
/// Редагується з адмінки `/dashboard/admin/courses` (колонка SP ID у рядку «Річна підписка»).
/// Має пріоритет над env `SENDPULSE_YEARLY_COURSE_ID` — env лишається fallback-ом.
export const YEARLY_SP_COURSE_SETTING_KEY = 'yearlySendpulseCourseId';

/// Читає актуальний SendPulse course ID Річної програми: спершу з БД (AppSetting),
/// якщо не заданий — fallback на env `SENDPULSE_YEARLY_COURSE_ID`. null = не налаштовано ніде.
export async function getYearlySendpulseCourseId(
  prismaClient: { appSetting: { findUnique: (args: { where: { key: string } }) => Promise<{ value: number } | null> } },
): Promise<number | null> {
  try {
    const row = await prismaClient.appSetting.findUnique({
      where: { key: YEARLY_SP_COURSE_SETTING_KEY },
    });
    if (row?.value && row.value > 0) return row.value;
  } catch {
    /// Таблиця ще не мігрована / БД недоступна — безпечний fallback на env.
  }
  return YEARLY_PROGRAM_CONFIG.sendpulseCourseId;
}

/// Ключ у `AppSetting` для runtime-конфігурованої тривалості доступу після завершення
/// програми (у місяцях). Зміна з адмінки перераховує expiresAt усіх живих підписок.
export const YEARLY_POST_ACCESS_SETTING_KEY = 'yearlyPostAccessMonths';
export const YEARLY_POST_ACCESS_MIN_MONTHS = 0;
export const YEARLY_POST_ACCESS_MAX_MONTHS = 24;

/// Читає актуальну кількість місяців пост-доступу з БД. Fallback на константу з config.
export async function getYearlyPostAccessMonths(
  prismaClient: { appSetting: { findUnique: (args: { where: { key: string } }) => Promise<{ value: number } | null> } },
): Promise<number> {
  try {
    const row = await prismaClient.appSetting.findUnique({
      where: { key: YEARLY_POST_ACCESS_SETTING_KEY },
    });
    return row?.value ?? YEARLY_PROGRAM_CONFIG.postAccessMonths;
  } catch {
    return YEARLY_PROGRAM_CONFIG.postAccessMonths;
  }
}
