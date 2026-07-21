/// Спільне джерело правди «яка підписка Річної програми видима».
///
/// Проблема, яку модуль вирішує: клієнт робить невдалу спробу оплати (створюється
/// PENDING-підписка), потім оплачує успішно — інколи з іншого акаунту (одрук у email),
/// але з тим самим телефоном / Telegram. У БД лишається пара ACTIVE + осиротіла PENDING.
/// Осиротілу треба ховати зі списку і не рахувати в KPI, а згодом — архівувати.
///
/// Модуль навмисно чистий (без prisma/next імпортів), щоб покриватись юніт-тестами і
/// використовуватись однаково у трьох місцях:
///   1. `app/dashboard/admin/yearly-program/page.tsx` — рядки таблиці + KPI-лічильники;
///   2. `lib/yearlyProgramDedup.ts` — event-driven авто-архів дублів у WFP-callback;
///   3. cron `archiveStalePending` — safety net для тих, хто так і не оплатив.

/// Статуси, які означають «людина реально в програмі» (жива підписка).
export const YEARLY_LIVE_STATUSES = ['ACTIVE', 'GRACE'] as const;

/// Мінімальний зріз підписки, якого достатньо для рішення про видимість.
export interface YearlyVisibilitySubscription {
  userId: string;
  status: string;
  phone?: string | null;
  telegramUsername?: string | null;
  manuallyAddedAt?: Date | null;
  /// Чи має підписка хоч один PAID-платіж.
  hasPaidPayment: boolean;
}

/// Набір «живих» ідентичностей: акаунти + телефони + Telegram-ніки людей,
/// які вже мають ACTIVE/GRACE-підписку.
export interface YearlyLiveIdentityIndex {
  userIds: Set<string>;
  phones: Set<string>;
  telegrams: Set<string>;
}

/// Нормалізація телефону: лишаємо тільки цифри. Менш ніж 7 цифр — сміття
/// (обрізаний ввід), такий телефон не може бути ключем матчингу.
export function normalizeYearlyPhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

/// Нормалізація Telegram-ніка: трим, нижній регістр, без провідного `@`.
export function normalizeYearlyTelegram(value: string | null | undefined): string | null {
  const handle = (value ?? '').trim().toLowerCase().replace(/^@+/, '');
  return handle.length > 0 ? handle : null;
}

export function isYearlyLiveStatus(status: string): boolean {
  return (YEARLY_LIVE_STATUSES as readonly string[]).includes(status);
}

/// Будує індекс живих ідентичностей із повного набору підписок.
/// ВАЖЛИВО: подавати саме повний набір із БД, а не обрізану сторінку —
/// інакше дубль не зматчиться з ACTIVE-підпискою, що не потрапила у вибірку.
export function buildLiveIdentityIndex(
  subs: Iterable<YearlyVisibilitySubscription>,
): YearlyLiveIdentityIndex {
  const index: YearlyLiveIdentityIndex = {
    userIds: new Set<string>(),
    phones: new Set<string>(),
    telegrams: new Set<string>(),
  };
  for (const s of subs) {
    if (!isYearlyLiveStatus(s.status)) continue;
    index.userIds.add(s.userId);
    const phone = normalizeYearlyPhone(s.phone);
    if (phone) index.phones.add(phone);
    const tg = normalizeYearlyTelegram(s.telegramUsername);
    if (tg) index.telegrams.add(tg);
  }
  return index;
}

/// Чи належить підписка людині, яка вже має живу підписку (за акаунтом,
/// телефоном або Telegram-ніком).
export function matchesLiveIdentity(
  sub: YearlyVisibilitySubscription,
  index: YearlyLiveIdentityIndex,
): boolean {
  if (index.userIds.has(sub.userId)) return true;
  const phone = normalizeYearlyPhone(sub.phone);
  if (phone && index.phones.has(phone)) return true;
  const tg = normalizeYearlyTelegram(sub.telegramUsername);
  if (tg && index.telegrams.has(tg)) return true;
  return false;
}

/// Головний предикат: чи є ця підписка «осиротілим» дублем незавершеної спроби оплати.
/// Такі рядки ховаємо з таблиці, не рахуємо в KPI і архівуємо після успішної оплати.
///
/// Не дубль (лишається видимим), якщо:
///   • статус не PENDING;
///   • у PENDING є реальний PAID-платіж (аномалія — має бути видною);
///   • підписку завів менеджер вручну (manuallyAddedAt != null) — він свідомо тримає
///     її в «Очікує» і може підтвердити оплату готівкою/переказом будь-коли;
///   • людина не має жодної живої підписки (це самотній лід).
export function isOrphanPendingDuplicate(
  sub: YearlyVisibilitySubscription,
  index: YearlyLiveIdentityIndex,
): boolean {
  if (sub.status !== 'PENDING') return false;
  if (sub.hasPaidPayment) return false;
  if (sub.manuallyAddedAt != null) return false;
  return matchesLiveIdentity(sub, index);
}

/// Зручний інверс для фільтрів: `subs.filter((s) => isVisibleYearlySubscription(s, index))`.
export function isVisibleYearlySubscription(
  sub: YearlyVisibilitySubscription,
  index: YearlyLiveIdentityIndex,
): boolean {
  return !isOrphanPendingDuplicate(sub, index);
}
