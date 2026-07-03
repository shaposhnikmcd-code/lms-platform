/// WayForPay helpers — підписи + параметри регулярних платежів + REMOVE на скасування.

import crypto from 'crypto';

/// Тестовий мерчант WFP (з офіційної доки https://wiki.wayforpay.com/view/852472).
/// Активується через env `WAYFORPAY_TEST_MODE=1` — переключає всі платежі в тестовий
/// gateway, реальні гроші не списуються. Тестові карти: 4111111111111111, 5454545454545454.
/// merchantDomainName має бути `www.market.ua` (зареєстрований домен test_merch_n1) —
/// інакше WFP відхиляє платіж з "Bank declined".
const WFP_TEST_MERCHANT = 'test_merch_n1';
const WFP_TEST_SECRET = 'flk3409refn54t54t*FNJRET';
const WFP_TEST_DOMAIN = 'www.market.ua';
const WFP_PROD_DOMAIN = 'www.uimp.com.ua';

export function getWayforpayCreds(): { merchantAccount: string; secretKey: string; merchantDomainName: string; isTest: boolean } {
  if (process.env.WAYFORPAY_TEST_MODE === '1') {
    return {
      merchantAccount: WFP_TEST_MERCHANT,
      secretKey: WFP_TEST_SECRET,
      merchantDomainName: WFP_TEST_DOMAIN,
      isTest: true,
    };
  }
  return {
    merchantAccount: process.env.WAYFORPAY_MERCHANT_LOGIN!,
    secretKey: process.env.WAYFORPAY_SECRET_KEY!,
    merchantDomainName: WFP_PROD_DOMAIN,
    isTest: false,
  };
}

/// Побудова HMAC-MD5 підпису з масиву полів, розділених `;`.
export function signFields(fields: (string | number)[], secretKey: string): string {
  return crypto
    .createHmac('md5', secretKey)
    .update(fields.join(';'))
    .digest('hex');
}

/// Параметри, що йдуть у Purchase як flags для регулярних списань.
/// Використовується для ПЕРШОГО платежу Місячної підписки — WFP запамʼятає картку
/// і почне щомісячно списувати автоматично. Кожне списання шле callback на serviceUrl.
///
/// `anchor` — дата, яку «покриває» перший (Purchase) платіж: для покупки до старту
/// програми це cohort.startDate, для звичайної покупки — момент оплати. Перше
/// РЕГУЛЯРНЕ списання WFP ставиться через 1 місяць після якоря через поле `dateNext`
/// (дата першого регулярного списання, ДД.ММ.РРРР, має бути в майбутньому).
/// УВАГА: поля `dateBegin` у Purchase-запиті WFP НЕ існує (перевірено на проді
/// 2026-07-03 + wiki.wayforpay.com/view/852102) — WFP його ігнорує і без `dateNext`
/// списує просто через місяць після покупки. Тому тут САМЕ dateNext.
///
/// `totalPayments` задає скільки ВСЬОГО списань має бути (1 Purchase + (N-1) scheduled).
/// Для Річної програми 9 місяців → 9 платежів → dateEnd = anchor + 8 місяців + 10 днів буфер.
/// Після dateEnd WFP припиняє автосписання автоматично.
export function buildRegularPurchaseFlags(opts: {
  amount: number;
  anchor?: Date;
  dateEnd?: Date;
  totalPayments?: number;
}) {
  const begin = opts.anchor ?? new Date();
  const next = new Date(begin);
  next.setMonth(next.getMonth() + 1);
  let end: Date;
  if (opts.dateEnd) {
    end = opts.dateEnd;
  } else if (opts.totalPayments && opts.totalPayments > 1) {
    end = new Date(begin);
    end.setMonth(end.getMonth() + (opts.totalPayments - 1));
    end.setDate(end.getDate() + 10);
  } else {
    end = new Date(begin.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  }
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };
  return {
    regularOn: '1',
    regularMode: 'monthly',
    regularAmount: opts.amount,
    dateNext: fmt(next),
    dateEnd: fmt(end),
  };
}

/// WFP regularApi вимагає `merchantPassword` як MD5-хеш від паролю мерчанта (не plaintext).
/// Якщо в env вже задано 32-символьний hex (готовий MD5) — використовуємо як є.
/// Інакше — хешуємо, щоб дозволити користувачу зберігати plaintext-пароль з WFP-кабінету.
function normalizeMerchantPassword(value: string): string {
  if (/^[a-f0-9]{32}$/i.test(value)) return value.toLowerCase();
  return crypto.createHash('md5').update(value).digest('hex');
}

/// Скасування регулярного платежу через regularApi REMOVE.
/// Використовується, коли юзер скасовує підписку — WFP припиняє списання.
export async function removeRegularSchedule(opts: {
  merchantAccount: string;
  merchantPassword: string;
  orderReference: string;
}): Promise<{ ok: boolean; raw: Record<string, unknown> }> {
  const res = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'REMOVE',
      merchantAccount: opts.merchantAccount,
      merchantPassword: normalizeMerchantPassword(opts.merchantPassword),
      orderReference: opts.orderReference,
      apiVersion: 1,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // WFP regularApi використовує власну таблицю reasonCode (4100=Accept, 4101=Reject,
  // 4102=Rule not found, 4104=Removed). Transaction API натомість використовує 1100=Ok.
  // Тому success тут — будь-який з: status='Accept', reasonCode=4100 (Accept на REMOVE),
  // reasonCode=4104 (вже знятий — теж OK для нас, регулярка точно неактивна),
  // або reasonCode=1100 (на випадок якщо WFP повертає transaction-style код).
  const isSuccess =
    raw.status === 'Accept'
    || raw.reasonCode === 4100
    || raw.reasonCode === 4104
    || raw.reasonCode === 1100;
  return { ok: res.ok && isSuccess, raw };
}

/// Стан правила регулярки у WFP. `found=false` (reasonCode 4102) — правила з таким
/// orderReference не існує/не існувало: НЕ помилка, очікувано для разових оплат і
/// child-refs рекурентних списань (`..._WFPREG-...`).
/// Дати WFP повертає unix-секундами → конвертуємо в Date.
export interface RegularStatus {
  found: boolean;
  /// 'Active' | 'Suspended' | 'Removed' | 'Completed' | ... (як повернув WFP)
  status: string | null;
  mode: string | null;
  amount: number | null;
  currency: string | null;
  nextPaymentAt: Date | null;
  dateEndAt: Date | null;
  raw: Record<string, unknown>;
}

export async function getRegularStatus(opts: {
  merchantAccount: string;
  merchantPassword: string;
  orderReference: string;
}): Promise<RegularStatus> {
  const res = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'STATUS',
      merchantAccount: opts.merchantAccount,
      merchantPassword: normalizeMerchantPassword(opts.merchantPassword),
      orderReference: opts.orderReference,
      apiVersion: 1,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const found = res.ok && raw.reasonCode === 4100;
  const toDate = (v: unknown): Date | null =>
    typeof v === 'number' && v > 0 ? new Date(v * 1000) : null;
  return {
    found,
    status: typeof raw.status === 'string' ? raw.status : null,
    mode: typeof raw.mode === 'string' ? raw.mode : null,
    amount: typeof raw.amount === 'number' ? raw.amount : null,
    currency: typeof raw.currency === 'string' ? raw.currency : null,
    nextPaymentAt: toDate(raw.nextPaymentDate),
    dateEndAt: toDate(raw.dateEnd),
    raw,
  };
}

/// Перенос дат існуючого правила регулярки через regularApi CHANGE.
/// УВАГА до неймінгу WFP: у regularApi дата НАСТУПНОГО списання передається полем
/// `dateBegin` (у Purchase-віджеті те саме зветься `dateNext`). Перевірено живим
/// експериментом 2026-07-03: CHANGE з dateBegin=15.10.2026 переніс nextPaymentDate,
/// не зачепивши amount/dateEnd/mode.
/// Суму і mode СВІДОМО передаємо ті, що правило має зараз (обов'язкові поля CHANGE):
/// callback відкидає списання з сумою ≠ першому платежу, тому міняти суму не можна.
export async function changeRegularSchedule(opts: {
  merchantAccount: string;
  merchantPassword: string;
  orderReference: string;
  /// Поточні параметри правила (з getRegularStatus) — передаються назад без змін.
  currentAmount: number;
  currentCurrency: string;
  currentMode: string;
  /// Нова дата наступного списання.
  nextPaymentAt: Date;
  /// Нова дата завершення графіка.
  dateEndAt: Date;
}): Promise<{ ok: boolean; raw: Record<string, unknown> }> {
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  };
  const res = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'CHANGE',
      merchantAccount: opts.merchantAccount,
      merchantPassword: normalizeMerchantPassword(opts.merchantPassword),
      orderReference: opts.orderReference,
      regularMode: opts.currentMode,
      amount: opts.currentAmount,
      currency: opts.currentCurrency,
      dateBegin: fmt(opts.nextPaymentAt),
      dateEnd: fmt(opts.dateEndAt),
      apiVersion: 1,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const isSuccess = raw.status === 'Accept' || raw.reasonCode === 4100 || raw.reasonCode === 1100;
  return { ok: res.ok && isSuccess, raw };
}
