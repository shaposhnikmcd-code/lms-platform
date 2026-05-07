/// Тонкий шар поверх `reminderTemplates.ts`. Кожна функція тягне шаблон з DB
/// (fallback на дефолт у коді) і підставляє placeholder-и. Зберігає старий API
/// `{ subject, html }` щоб не ламати cron-споживачів.
///
/// Для редагування шаблонів — `lib/emailTemplates/reminderTemplates.ts` + admin UI
/// «Листи Нагадування».

import {
  renderReminder,
  nameOfVar,
  dateOfVar,
  daysWordVar,
} from './reminderTemplates';

// ==================== MANUAL FLOW (клієнт платить сам) ====================

/// Manual #1: за 3 дні до закінчення оплаченого місяця.
export async function manualBeforeExpiry(args: { name: string | null; expiresAt: Date }): Promise<{ subject: string; html: string }> {
  return renderReminder('manual-before', {
    name: nameOfVar(args.name),
    expiresAt: dateOfVar(args.expiresAt),
  });
}

/// Manual #2: у день закінчення оплаченого місяця.
export async function manualOnExpiry(args: { name: string | null }): Promise<{ subject: string; html: string }> {
  return renderReminder('manual-on-expiry', { name: nameOfVar(args.name) });
}

/// Manual #3: наступний день після закінчення — стартував пільговий період grace.
export async function manualGraceStart(args: {
  name: string | null;
  gracePeriodEndsAt: Date;
  graceDays: number;
}): Promise<{ subject: string; html: string }> {
  return renderReminder('manual-grace-start', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
    graceDays: String(args.graceDays),
    graceDaysWord: daysWordVar(args.graceDays),
  });
}

/// Manual #4: середина grace-періоду (тільки якщо graceDays ≥ 5).
export async function manualGraceMid(args: {
  name: string | null;
  gracePeriodEndsAt: Date;
}): Promise<{ subject: string; html: string }> {
  const daysLeft = Math.max(0, Math.ceil((args.gracePeriodEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return renderReminder('manual-grace-mid', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
    daysLeft: String(daysLeft),
    daysWord: daysWordVar(daysLeft),
  });
}

/// Manual #5: за 1 день до закриття (тільки якщо graceDays ≥ 3).
export async function manualGraceLast(args: {
  name: string | null;
  gracePeriodEndsAt: Date;
}): Promise<{ subject: string; html: string }> {
  return renderReminder('manual-grace-last', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
  });
}

// ==================== CYCLICAL FLOW (автосписання, тільки при помилці) ====================

/// Cyclical #1: через 1 день після експайру — WFP не зміг списати.
export async function cyclicalChargeFailed1(args: {
  name: string | null;
  gracePeriodEndsAt: Date;
  graceDays: number;
}): Promise<{ subject: string; html: string }> {
  return renderReminder('cyclical-failed-1', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
    graceDays: String(args.graceDays),
    graceDaysWord: daysWordVar(args.graceDays),
  });
}

/// Cyclical #2: середина grace-періоду (тільки якщо graceDays ≥ 5).
export async function cyclicalGraceMid(args: {
  name: string | null;
  gracePeriodEndsAt: Date;
}): Promise<{ subject: string; html: string }> {
  const daysLeft = Math.max(0, Math.ceil((args.gracePeriodEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return renderReminder('cyclical-grace-mid', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
    daysLeft: String(daysLeft),
    daysWord: daysWordVar(daysLeft),
  });
}

/// Cyclical #3: за 1 день до закриття (тільки якщо graceDays ≥ 3).
export async function cyclicalGraceLast(args: {
  name: string | null;
  gracePeriodEndsAt: Date;
}): Promise<{ subject: string; html: string }> {
  return renderReminder('cyclical-grace-last', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
  });
}

// ==================== СПІЛЬНИЙ ФІНАЛ (закриття доступу) ====================

/// Закриття доступу — спільний для manual і cyclical.
export async function accessClosed(args: { name: string | null }): Promise<{ subject: string; html: string }> {
  return renderReminder('closed', { name: nameOfVar(args.name) });
}
