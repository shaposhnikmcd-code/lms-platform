/// Розрахунок доступу до Річної програми. Single source of truth — використовується
/// з WFP callback (при кожній оплаті), при запуску cohort, при перенесенні підписки
/// в інший cohort, при cron-у sync.
///
/// Правила (узгоджені 2026-05-01, оновлені 2026-06-03 — пост-доступ; 2026-07-03 —
/// календарний графік; 2026-09-06 — СІТКА МОДУЛІВ набору):
/// — Набір = 9 модулів, модуль = календарний місяць від cohort.startDate
///   (для старту 01.09.2026: вересень = модуль 1 … травень = модуль 9).
/// — Місячний платіж 2200 ₴ = оплата ОДНОГО модуля. Оплата, зроблена всередині модуля,
///   покриває САМЕ цей модуль, незалежно від дня. Наступні платежі/списання припадають
///   на ПЕРШИЙ ДЕНЬ наступних модулів — сітка однакова для всіх, незалежно від дати
///   покупки. Пізній покупець просто починає з пізнішого модуля і має менше слотів
///   (купив у жовтні → модуль 2, 8 слотів).
/// — Правило краю: якщо до початку наступного модуля лишилось менше 24 годин, платіж
///   зараховується вже в НАСТУПНИЙ модуль. Інакше людина, яка купила 30.09 о 23:30,
///   платила б за вересень, який завтра скінчиться, а WFP отримав би `dateNext`
///   «завтра» (WFP вимагає дату в майбутньому). Правило єдине для доступу і для WFP —
///   вони мусять збігатися до дня.
/// — YEARLY → expiresAt = cohort.endDate + postAccessMonths (фікс на весь період).
/// — MONTHLY до повної сплати → початок модуля `firstSlot + paidCount`, кеп cohort.endDate.
/// — MONTHLY після сплати всіх СВОЇХ слотів (`totalSlots = 9 − firstSlot`) →
///   cohort.endDate + postAccessMonths (та сама логіка, що й YEARLY).
/// — Без cohort (legacy) → стара поведінка: yearlyDurationDays/monthlyDurationDays від оплати.

import { YEARLY_PROGRAM_CONFIG } from './yearlyProgramConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/// Додає `months` календарних місяців до дати, клемпуючи день до останнього дня
/// цільового місяця (31.05 + 6 міс = 30.11, а не 1.12; 31.10 + 1 міс = 30.11).
/// Час доби зберігається.
///
/// SINGLE SOURCE OF TRUTH для «плюс N місяців» у всій Річній програмі: доступ,
/// графік WFP-регулярки, звірка графіка, валідація дат набору. Не дублювати формулу —
/// імпортувати звідси (винятки, які фізично не можуть імпортувати TS, перелічені
/// в коментарях біля своїх копій).
///
/// UTC-геттери свідомо: дати набору зберігаються як UTC-інстанти (00:00:00Z старт,
/// 23:59:59.999Z кінець доби). З локальними геттерами на машині у UTC+3 дата
/// «31.05.2027 23:59:59.999Z» читалась би як 1 червня — і клемп місяця з'їжджав би
/// на добу. На Vercel (UTC) різниці немає, тож поведінка проду не змінюється.
export function addCalendarMonths(date: Date, months: number): Date {
  if (!months) return new Date(date);
  const day = date.getUTCDate();
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTarget = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTarget));
  return result;
}

/// Кінець доби (23:59:59.999 UTC) — межа набору включає останній день цілком.
/// Застосовується і до вже збережених рядків, у яких endDate лежить як 00:00Z:
/// без цього останній місячний слот «не влазив» і графік коротшав на списання.
export function endOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export interface CohortLike {
  startDate: Date;
  endDate: Date;
}

export interface PaymentLike {
  amount: number;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  /// true — платіж зафіксовано як факт списання, але в доступ він НЕ йде
  /// (orphan-списання по закритій підписці, понад ліміт місяців, розбіжність суми).
  /// Поле опційне: синтетичні платежі в guard-ах і старі виклики його не передають,
  /// `undefined` читається як «звичайний платіж».
  excludedFromAccess?: boolean | null;
  /// Спосіб ручної оплати (готівка / переказ / carryover). `null` — платіж WayForPay,
  /// `undefined` — поле не вибрали в запиті. Визначає, від якої дати платіж займає
  /// слот у сітці модулів (див. `slotDateOf`), тому у ВСІХ вибірках, що йдуть у
  /// `monthlySchedule`/`calculateAccessUntil`, це поле треба селектити.
  manualMethod?: string | null;
}

export type Plan = 'YEARLY' | 'MONTHLY';

/// Підрахунок успішних PAID платежів з валідними paidAt. Платежі без paidAt
/// (race-у callback-у) використовують createdAt як fallback.
///
/// `excludedFromAccess` відсіюється тут — у ЄДИНОМУ місці, де PAID-платежі
/// перетворюються на місяці доступу. Інакше orphan-списання (записане саме тому, що
/// система відмовилась продовжувати доступ) при найближчому перерахунку тихо
/// додавало б людині місяць — і відмова скасовувала б сама себе.
function paidPaymentDates(payments: PaymentLike[]): Date[] {
  return payments
    .filter((p) => p.status === 'PAID' && !p.excludedFromAccess)
    .map((p) => p.paidAt ?? p.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
}

/// Дата, за якою платіж займає СЛОТ у сітці модулів (не плутати з датою факту оплати).
///
/// Для платежу WayForPay це `createdAt` — момент ЧЕКАУТУ, тобто той самий «зараз», від
/// якого `/api/wayforpay` порахував якір і запрограмував `dateNext` у WFP. Сторінка
/// оплати живе добу (`orderLifetime`), тож чекаут 29.09 о 20:00 і успішна картка 30.09
/// о 01:00 — звичайна річ. Якби слот брався з `paidAt`, доступ розійшовся б із графіком
/// WFP на цілий модуль: людині запрограмували 9 списань, а сітка дала б 8 слотів —
/// дев'яте списання відхилив би `monthly_cap_reached`, і 2200 ₴ зняли б без доступу.
///
/// Для РУЧНОГО платежу навпаки: `createdAt` — це момент, коли менеджер вніс рядок
/// (може бути через місяці після факту), тож слот дає `paidAt`.
function slotDateOf(p: PaymentLike): Date {
  // `null` = точно WayForPay. `undefined` (поле не вибрали) читаємо як «не знаємо» і
  // лишаємо стару поведінку — для ручного платежу вона правильна, а для WFP лише
  // повертає стару похибку замість того, щоб зіпсувати ручні розбивки.
  if (p.manualMethod === null) return p.createdAt;
  return p.paidAt ?? p.createdAt;
}

/// Слот-дати всіх зарахованих PAID-платежів, за зростанням.
function paidPaymentSlotDates(payments: PaymentLike[]): Date[] {
  return payments
    .filter((p) => p.status === 'PAID' && !p.excludedFromAccess)
    .map(slotDateOf)
    .sort((a, b) => a.getTime() - b.getTime());
}

// ─────────────────────────── СІТКА МОДУЛІВ НАБОРУ ───────────────────────────

/// Скільки модулів у наборі. Норма — `totalMonthlyPayments` (9), але якщо набір
/// фізично коротший (менше 9 календарних місяців між startDate і endDate), модулів
/// стільки, скільки влазить: інакше WFP отримав би графік, що виходить за межі програми.
/// Валідація дат набору (lib/yearlyProgramCohort.ts) такі набори не пропускає, але
/// історичні / зіпсовані рядки трапляються — тут страхуємось, а не падаємо.
export function cohortModuleCount(cohort: CohortLike): number {
  const fits = countMonthlySlots(cohort.startDate, cohort.endDate, YEARLY_PROGRAM_CONFIG.totalMonthlyPayments);
  return Math.max(1, Math.min(YEARLY_PROGRAM_CONFIG.totalMonthlyPayments, fits));
}

/// Дата початку модуля `index` (0-based): `cohort.startDate + index місяців`.
export function cohortModuleStart(cohort: CohortLike, index: number): Date {
  return addCalendarMonths(cohort.startDate, index);
}

/// Правило краю: за скільки до початку наступного модуля платіж уже зараховується
/// в НАСТУПНИЙ модуль. Рівно доба — стільки ж, скільки WFP вимагає «дата в майбутньому»
/// для `dateNext`, і рівно стільки, щоб не брати гроші за модуль, який завтра скінчиться.
const SLOT_EDGE_MS = MS_PER_DAY;

/// Індекс модуля (0-based), у який потрапляє момент `at`: найбільше `k`, для якого
/// `cohortModuleStart(cohort, k) <= at`. До старту → 0, після кінця набору → останній модуль.
///
/// `edge` (за замовчуванням true) вмикає правило краю. Воно доречне ЛИШЕ там, де ми
/// вирішуємо, який модуль КУПУЄ людина: слот першого платежу і якір WFP. Для питання
/// «який модуль іде зараз» (guard боргу) правило краю шкідливе: 31.10 воно показало б
/// листопад, і студент, який платить за жовтень в останній його день, отримував би
/// 409 «пропущено 1 місяць», а той, хто платить 30.10, — ні.
export function cohortSlotIndex(cohort: CohortLike, at: Date, opts?: { edge?: boolean }): number {
  const maxIndex = cohortModuleCount(cohort) - 1;
  // Зсув на добу вперед і реалізує правило краю: момент, до кінця модуля якого лишилось
  // МЕНШЕ доби, «дотягується» до наступного. Рівно доба — ще поточний модуль, тому
  // порівняння строге.
  // Без правила краю — «сирий» індекс: модуль уже почався (`<=`). З правилом — модуль
  // почнеться менш ніж через добу (`<` до `at + 24 год`; рівно доба — ще поточний модуль).
  const started = (nextStart: Date) => (opts?.edge === false
    ? nextStart.getTime() <= at.getTime()
    : nextStart.getTime() < at.getTime() + SLOT_EDGE_MS);
  let k = 0;
  while (k < maxIndex && started(cohortModuleStart(cohort, k + 1))) k++;
  return k;
}

/// Стан місячного графіка підписки на сітці набору. ЄДИНА функція, з якої читають
/// свій стан усі споживачі: доступ, guard-и покупки, WFP-графік, cron-нагадування,
/// прогрес у листах. Дублювати «9 − щось» деінде не можна — набір слотів у пізнього
/// покупця коротший, і будь-яка локальна арифметика розійдеться з доступом.
export interface MonthlySchedule {
  /// Модуль першої оплати (0-based). Без платежів — 0.
  firstSlot: number;
  /// Скільки модулів має сплатити САМЕ ця підписка: `cohortModuleCount − firstSlot`.
  totalSlots: number;
  paidCount: number;
  /// Скільки слотів лишилось несплаченими.
  remaining: number;
  isFullyPaid: boolean;
  hasPayments: boolean;
  /// Індекс першого НЕ покритого модуля (`firstSlot + paidCount`, кеп — кінець набору).
  nextSlotIndex: number;
  /// Момент, до якого оплачено (= початок першого неоплаченого модуля). null без платежів.
  coveredUntil: Date | null;
  /// Початок наступного НЕОПЛАЧЕНОГО модуля — саме ця дата йде у WFP `dateNext`.
  /// null, якщо все сплачено.
  nextSlotStart: Date | null;
  /// Абсолютний 1-based номер модуля, який покрив ОСТАННІЙ платіж («модуль 3 з 9»).
  /// null без платежів.
  currentModuleNumber: number | null;
  /// Дата початку модуля `index` (0-based) цього набору.
  moduleOf(index: number): Date;
  /// Перший платіж лежить ПІСЛЯ кінця набору — сітки для нього не існує (підписку
  /// перенесли у вже завершений набір). Слотів 0, повної оплати не буває.
  degenerate: boolean;
}

function scheduleFromDates(cohort: CohortLike, dates: Date[]): MonthlySchedule {
  const moduleCount = cohortModuleCount(cohort);
  const paidCount = dates.length;
  const hasPayments = paidCount > 0;
  const moduleOf = (index: number) => cohortModuleStart(cohort, index);

  // Вироджений випадок: перший платіж лежить уже за кінцем набору (підписку перенесли
  // в завершений набір, ручний платіж заднім числом). `cohortSlotIndex` притиснув би
  // його до останнього модуля — вийшло б «totalSlots = 1, сплачено 1 → повна оплата»,
  // і один платіж на 2200 ₴ відкрив би доступ до кінця набору ПЛЮС увесь пост-доступ.
  // Сітки для такого платежу немає: слотів 0, повної оплати не буває, доступ упирається
  // в кінець набору — далі рішення менеджера.
  if (hasPayments && dates[0]! > endOfUtcDay(cohort.endDate)) {
    return {
      firstSlot: moduleCount - 1,
      totalSlots: 0,
      paidCount,
      remaining: 0,
      isFullyPaid: false,
      hasPayments,
      nextSlotIndex: moduleCount,
      coveredUntil: cohort.endDate,
      nextSlotStart: null,
      currentModuleNumber: null,
      moduleOf,
      degenerate: true,
    };
  }

  const firstSlot = hasPayments ? cohortSlotIndex(cohort, dates[0]!) : 0;
  const totalSlots = Math.max(1, moduleCount - firstSlot);
  const isFullyPaid = paidCount >= totalSlots;
  const nextSlotIndex = Math.min(firstSlot + paidCount, moduleCount);
  return {
    firstSlot,
    totalSlots,
    paidCount,
    remaining: Math.max(0, totalSlots - paidCount),
    isFullyPaid,
    hasPayments,
    nextSlotIndex,
    coveredUntil: hasPayments ? cohortModuleStart(cohort, firstSlot + paidCount) : null,
    nextSlotStart: isFullyPaid ? null : cohortModuleStart(cohort, nextSlotIndex),
    currentModuleNumber: hasPayments ? firstSlot + paidCount : null,
    moduleOf,
    degenerate: false,
  };
}

/// Стан графіка MONTHLY-підписки. `newPaymentAt` — платіж, якого ще нема в `payments`
/// (in-tx розрахунки callback-у).
export function monthlySchedule(args: {
  cohort: CohortLike;
  payments: PaymentLike[];
  newPaymentAt?: Date | null;
}): MonthlySchedule {
  const dates = paidPaymentSlotDates(args.payments);
  if (args.newPaymentAt) {
    dates.push(args.newPaymentAt);
    dates.sort((a, b) => a.getTime() - b.getTime());
  }
  return scheduleFromDates(args.cohort, dates);
}

/// Розрахунок expiresAt для підписки з огляду на cohort. Без cohort — fallback на legacy.
export function calculateAccessUntil(args: {
  plan: Plan;
  autoRenew: boolean;
  cohort: CohortLike | null;
  payments: PaymentLike[];
  /// Дата нового платежу, який ще НЕ записаний у `payments` (для in-tx розрахунків
  /// у WFP callback). Якщо null — рахуємо тільки з payments.
  newPaymentAt?: Date | null;
  /// Місяців доступу до платформи після cohort.endDate. Default 0 (без пост-доступу).
  /// Передається з runtime-налаштування (getYearlyPostAccessMonths).
  postAccessMonths?: number;
}): Date | null {
  const paymentDates = paidPaymentDates(args.payments);
  if (args.newPaymentAt) {
    paymentDates.push(args.newPaymentAt);
    paymentDates.sort((a, b) => a.getTime() - b.getTime());
  }

  if (paymentDates.length === 0) return null;

  // Без cohort — стара логіка (legacy/без-cohort підписка).
  if (!args.cohort) {
    const last = paymentDates[paymentDates.length - 1]!;
    const days = args.plan === 'YEARLY'
      ? YEARLY_PROGRAM_CONFIG.yearlyDurationDays
      : YEARLY_PROGRAM_CONFIG.monthlyDurationDays;
    return new Date(last.getTime() + days * MS_PER_DAY);
  }

  // Дата завершення доступу = cohort.endDate + N місяців пост-доступу до платформи.
  const months = args.postAccessMonths ?? 0;
  const accessEnd = addCalendarMonths(args.cohort.endDate, months);

  // YEARLY завжди = endDate cohort + пост-доступ.
  if (args.plan === 'YEARLY') {
    return accessEnd;
  }

  // MONTHLY: сітка модулів набору. Оплата покриває свій модуль цілком, доступ триває
  // до початку першого НЕоплаченого модуля. Слот рахується зі СЛОТ-дат (для WFP це
  // момент чекауту, не момент списання) — інакше доступ розійшовся б з графіком WFP.
  const slotDates = paidPaymentSlotDates(args.payments);
  if (args.newPaymentAt) {
    slotDates.push(args.newPaymentAt);
    slotDates.sort((a, b) => a.getTime() - b.getTime());
  }
  const schedule = scheduleFromDates(args.cohort, slotDates);

  // Сплачено всі СВОЇ слоти (у покупця до старту це 9, у жовтневого — 8) → той самий
  // повний доступ, що й у YEARLY, з пост-доступом.
  if (schedule.isFullyPaid) {
    return accessEnd;
  }

  // Часткова сплата: hard cap на cohort.endDate (пост-доступ ще не нараховуємо — він
  // вмикається лише після повної оплати, рядок вище). Залишок до повного — manual.
  const expires = schedule.coveredUntil!;
  if (expires > args.cohort.endDate) {
    return args.cohort.endDate;
  }
  return expires;
}

/// Скільки списань (включно з першим Purchase) має бути у підписки, яка стартує
/// з модуля `firstSlot`: рівно стільки, скільки модулів набору ще попереду.
/// Це `totalSlots` із `monthlySchedule` — окрема функція лишена для місць, де
/// платежів ще нема (перший Purchase) і сітку задає лише модуль-якір.
///
/// Приклади (набір 01.09.2026–31.05.2027): firstSlot=0 → 9; firstSlot=1 (жовтень) → 8.
export function maxAutopayChargeCount(args: {
  cohort: CohortLike;
  firstSlot: number;
}): number {
  // Мінімум 1: навіть якщо якір з'їхав за межу набору, перший (Purchase) платіж
  // відбувається реально — інакше повернули б 0 списань на живу оплату.
  return Math.max(1, cohortModuleCount(args.cohort) - args.firstSlot);
}

/// Дата останнього автосписання WFP-регулярки = початок ОСТАННЬОГО модуля набору.
/// Використовується для `dateEnd` у buildRegularPurchaseFlags.
export function lastAutopayChargeDate(args: {
  cohort: CohortLike;
  firstSlot: number;
}): Date {
  const count = maxAutopayChargeCount(args);
  return cohortModuleStart(args.cohort, args.firstSlot + count - 1);
}

/// Скільки повних календарних місячних слотів від `anchor` вміщується до `until`
/// (включно з останнім днем: межа — кінець доби). Слот `i` покриває доступ до
/// `anchor + (i+1) місяців − 1 день`.
/// Базова лічилка сітки — на ній стоять і кількість модулів набору, і валідація дат.
export function countMonthlySlots(anchor: Date, until: Date, maxSlots = 240): number {
  const limit = endOfUtcDay(until);
  let n = 0;
  while (n < maxSlots) {
    const coveredUntil = new Date(addCalendarMonths(anchor, n + 1).getTime() - MS_PER_DAY);
    if (coveredUntil > limit) break;
    n++;
  }
  return n;
}
