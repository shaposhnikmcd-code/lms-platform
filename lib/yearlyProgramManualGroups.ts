/// Групування часток авто-розбивки ручного платежу в ОДНЕ внесення.
///
/// Навіщо: доступ MONTHLY-підписки рахується як КІЛЬКІСТЬ PAID-платежів (calculateAccessUntil),
/// тому внесення на кілька місяців сервер розбиває на місячні частки — кожна частка = 1 місяць.
/// У списках це виглядало як 5 непов'язаних рядків з однаковими датою/сумою/нотаткою і читалось
/// менеджером як дубль/глюк. Тут — єдине джерело правди, як ці частки зібрати назад.
///
/// Ключ групи — базовий orderReference, який сервер видає на все внесення:
/// `manual-{method}_{timestamp}_{subIdSlice}` + суфікс `_1…_N` для кожної частки
/// (див. handleManualPayment у app/api/admin/yearly-program/[id]/route.ts).
/// Базу свідомо НЕ доповнюємо `createdAt`: рядки створюються однією транзакцією, але
/// мітки часу можуть відрізнятись на мілісекунди, а timestamp + хвіст id підписки
/// у самій базі вже унікальні для кожного внесення.

const SPLIT_REF_RE = /^(manual-[^_]+_\d+_[^_]+)_(\d+)$/;

/// Розбирає orderReference частки на базу внесення + порядковий номер.
/// null — це не частка розбивки (одиночний ручний платіж, carryover, WFP).
export function parseSplitRef(orderReference: string): { base: string; index: number } | null {
  const m = SPLIT_REF_RE.exec(orderReference);
  if (!m) return null;
  return { base: m[1]!, index: Number(m[2]) };
}

export interface GroupableManualPayment {
  id: string;
  orderReference: string;
  amount: number;
  /// Опційно — коли групуємо реєстр по ВСІХ підписках (вкладка «Ручні платежі»),
  /// щоб теоретичний збіг баз між різними підписками не склеїв чужі платежі.
  subscriptionId?: string | null;
}

export interface ManualPaymentGroup<T> {
  /// Стабільний ключ для React-списків.
  key: string;
  /// Базовий orderReference внесення (null — одиночний платіж).
  base: string | null;
  /// Частки в порядку розбивки (_1 … _N). Для одиночного платежу — один елемент.
  parts: T[];
  /// Перша частка — з неї беруться дата / спосіб / нотатка / клієнт для згорнутого рядка.
  head: T;
  /// Сума всього внесення (сума часток).
  total: number;
  amounts: number[];
  isSplit: boolean;
}

/// Збирає плаский список платежів у список внесень, зберігаючи порядок першої появи.
export function groupManualPayments<T extends GroupableManualPayment>(rows: T[]): ManualPaymentGroup<T>[] {
  const byKey = new Map<string, { base: string; parts: { row: T; index: number }[] }>();
  const order: { key: string; single?: T }[] = [];

  for (const row of rows) {
    const split = parseSplitRef(row.orderReference);
    if (!split) {
      order.push({ key: `single:${row.id}`, single: row });
      continue;
    }
    const key = `${row.subscriptionId ?? ''}#${split.base}`;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.parts.push({ row, index: split.index });
    } else {
      byKey.set(key, { base: split.base, parts: [{ row, index: split.index }] });
      order.push({ key });
    }
  }

  return order.map(({ key, single }) => {
    if (single) {
      return {
        key,
        base: null,
        parts: [single],
        head: single,
        total: single.amount,
        amounts: [single.amount],
        isSplit: false,
      };
    }
    const bucket = byKey.get(key)!;
    const parts = [...bucket.parts].sort((a, b) => a.index - b.index).map((p) => p.row);
    const amounts = parts.map((p) => p.amount);
    return {
      key,
      base: bucket.base,
      parts,
      head: parts[0]!,
      total: amounts.reduce((s, a) => s + a, 0),
      amounts,
      isSplit: parts.length > 1,
    };
  });
}

/// «4 × 2 200 + 4 000» — компактний опис складу розбивки (однакові суми поспіль злипаються).
export function describeSplitParts(amounts: number[]): string {
  const runs: { amount: number; count: number }[] = [];
  for (const a of amounts) {
    const last = runs[runs.length - 1];
    if (last && last.amount === a) last.count += 1;
    else runs.push({ amount: a, count: 1 });
  }
  return runs
    .map((r) => (r.count > 1 ? `${r.count} × ${r.amount.toLocaleString('uk-UA')}` : r.amount.toLocaleString('uk-UA')))
    .join(' + ');
}

/// Українська плюралізація: 1 частина / 2-4 частини / 5+ частин (11-14 → «частин»).
export function pluralParts(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'частин';
  if (mod10 === 1) return 'частина';
  if (mod10 >= 2 && mod10 <= 4) return 'частини';
  return 'частин';
}
