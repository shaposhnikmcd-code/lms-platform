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

/// Manual #3: наступний день після закінчення — пільгові 7 днів стартували.
export async function manualGraceStart(args: { name: string | null; gracePeriodEndsAt: Date }): Promise<{ subject: string; html: string }> {
  return renderReminder('manual-grace-start', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
  });
}

// ==================== CYCLICAL FLOW (автосписання, тільки при помилці) ====================

/// Cyclical #1: через 1 день після експайру — WFP не зміг списати.
export async function cyclicalChargeFailed1(args: { name: string | null; gracePeriodEndsAt: Date }): Promise<{ subject: string; html: string }> {
  return renderReminder('cyclical-failed-1', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
  });
}

/// Cyclical #2: через 3 дні після експайру — все ще не списано.
export async function cyclicalChargeFailed3(args: { name: string | null; gracePeriodEndsAt: Date }): Promise<{ subject: string; html: string }> {
  const daysLeft = Math.max(0, Math.ceil((args.gracePeriodEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return renderReminder('cyclical-failed-3', {
    name: nameOfVar(args.name),
    gracePeriodEndsAt: dateOfVar(args.gracePeriodEndsAt),
    daysLeft: String(daysLeft),
    daysWord: daysWordVar(daysLeft),
  });
}

// ==================== СПІЛЬНИЙ ФІНАЛ (закриття доступу) ====================

/// Закриття доступу — спільний для manual і cyclical.
export async function accessClosed(args: { name: string | null }): Promise<{ subject: string; html: string }> {
  return renderReminder('closed', { name: nameOfVar(args.name) });
}
