/// WayForPay helpers — підписи + параметри регулярних платежів + REMOVE на скасування.

import crypto from 'crypto';
import { addCalendarMonths } from './yearlyProgramAccess';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/// Буфер до дати завершення регулярки. WFP припиняє списання після `dateEnd`, тож якщо
/// поставити її рівно на день останнього списання — банківська затримка на добу зрізала б
/// останній платіж. 10 днів — той самий запас, що історично був у безкогортній гілці.
const REGULAR_DATE_END_BUFFER_DAYS = 10;

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
  // Клемпований календарний місяць (спільна формула з розрахунком доступу): 31.10 + 1 міс
  // = 30.11, а не 01.12 — інакше графік WFP розходився з нашими датами доступу.
  const next = addCalendarMonths(begin, 1);
  let end: Date;
  if (opts.dateEnd) {
    // Cohort-гілка: передана дата — це день ОСТАННЬОГО списання. Додаємо той самий
    // 10-денний буфер, що й нижче, щоб WFP не зрізав останній платіж.
    end = new Date(opts.dateEnd.getTime() + REGULAR_DATE_END_BUFFER_DAYS * MS_PER_DAY);
  } else if (opts.totalPayments && opts.totalPayments > 1) {
    end = new Date(
      addCalendarMonths(begin, opts.totalPayments - 1).getTime()
      + REGULAR_DATE_END_BUFFER_DAYS * MS_PER_DAY,
    );
  } else {
    end = new Date(begin.getTime() + 10 * 365 * MS_PER_DAY);
  }
  // UTC-форматування (як і вся математика дат Річної): на Vercel локальний час = UTC,
  // тож поведінка проду не змінюється, а локальні прогони перестають з'їжджати на добу.
  const fmt = (d: Date) => {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
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
  /// true — відповідь НЕ дає відповіді на питання «чи є правило»: 5xx/timeout,
  /// нечитний JSON, невідомий reasonCode. Викликач НЕ має трактувати це як
  /// «правила нема» (інакше 15-хвилинний збій WFP затирає кеш графіків в адмінці).
  inconclusive: boolean;
  /// 'Active' | 'Suspended' | 'Removed' | 'Completed' | ... — рядок ЯК ЙОГО ПОВЕРНУВ WFP,
  /// без нормалізації і без згортання «не Active» у «правила немає». Призупинене правило —
  /// це живе правило: воно лишається у кабінеті мерчанта і може ожити, тому викликач має
  /// бачити реальний статус, а не порожнечу (інакше підписка зникає з радара звірки).
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
  const parsed = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const raw = parsed ?? {};
  const found = res.ok && raw.reasonCode === 4100;
  // 4102 = «Rule not found» — це ЧЕСНА відповідь «правила нема». Усе інше без 4100
  // (HTTP-помилка, нечитний JSON, чужий reasonCode) — невизначеність, а не відсутність.
  const inconclusive = !found && !(res.ok && parsed !== null && raw.reasonCode === 4102);
  const toDate = (v: unknown): Date | null =>
    typeof v === 'number' && v > 0 ? new Date(v * 1000) : null;
  // Статус правила WFP віддає полем `status`; у частині відповідей regularApi те саме
  // значення приходить як `regularStatus`. Беремо перше непорожнє і НЕ приводимо до
  // жодного канонічного вигляду — «Suspended», «Removed», «Completed» мають дійти до
  // викликача як є, щоб він міг розрізнити «правила немає» і «правило не активне».
  const rawStatus = [raw.status, raw.regularStatus].find((v) => typeof v === 'string' && v.trim() !== '');
  return {
    found,
    inconclusive,
    status: typeof rawStatus === 'string' ? rawStatus.trim() : null,
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
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getUTCFullYear()}`;
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
