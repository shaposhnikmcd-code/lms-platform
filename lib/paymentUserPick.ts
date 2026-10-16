/// Вибір акаунта-платника серед кількох User з однаковою поштою (різний регістр).
///
/// Навіщо: історично пошта не нормалізувалась, тож у базі живуть пари на кшталт
/// `olena@…` і `Olena@…` — два окремі User. Роут оплати шукав `findFirst` без
/// сортування і міг узяти «не той» акаунт: доплата за персональним посиланням тоді
/// звірялась із підписками чужого акаунта і падала у 409 `renew_link_stale`.
/// Базу не мерджимо — лише детерміновано обираємо, чий це платіж.
///
/// Правила (за спаданням пріоритету):
///  1. `preferredUserId` — власник підписки, названої renew-токеном. Посилання видане
///     на конкретну підписку, тож платником має бути саме її власник.
///  2. Акаунт із живою підпискою Річної (PENDING / ACTIVE / GRACE).
///  3. Акаунт із будь-якою не архівною підпискою Річної (EXPIRED / CANCELLED —
///     щоб повторна покупка підхопила сплачені модулі свого набору).
///  4. Найновіший акаунт (`createdAt`), при рівності — більший `id`.
/// Для єдиного акаунта результат завжди він сам.

export interface PaymentUserCandidate {
  id: string;
  createdAt: Date;
  /// Статуси підписок Річної цього акаунта.
  yearlyStatuses: string[];
}

const LIVE = new Set(['PENDING', 'ACTIVE', 'GRACE']);

function rank(c: PaymentUserCandidate): number {
  if (c.yearlyStatuses.some((s) => LIVE.has(s))) return 2;
  if (c.yearlyStatuses.some((s) => s !== 'ARCHIVED')) return 1;
  return 0;
}

export function pickPaymentUser<T extends PaymentUserCandidate>(
  candidates: readonly T[],
  preferredUserId?: string | null,
): T | null {
  if (candidates.length === 0) return null;
  if (preferredUserId) {
    const preferred = candidates.find((c) => c.id === preferredUserId);
    if (preferred) return preferred;
  }
  return [...candidates].sort((a, b) => {
    const r = rank(b) - rank(a);
    if (r !== 0) return r;
    const t = b.createdAt.getTime() - a.createdAt.getTime();
    if (t !== 0) return t;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  })[0];
}
