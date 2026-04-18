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

  /// Grace-період після expiresAt, протягом якого доступ залишається відкритим.
  graceDays: 1,

  /// Нагадування — за скільки днів до expiresAt.
  reminderDaysBefore: [3, 1],
} as const;

export function isYearlyProgramOrderRef(orderReference: string): 'yearly' | 'monthly' | null {
  // Увага: monthly префікс містить "yearly-program", тому перевіряємо його ПЕРШИМ.
  if (orderReference.startsWith(`${YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix}_`)) return 'monthly';
  if (orderReference.startsWith(`${YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix}_`)) return 'yearly';
  return null;
}
