import type { PrismaClient } from '@prisma/client';
import {
  cohortModuleStart,
  cohortSlotIndex,
  lastAutopayChargeDate,
  maxAutopayChargeCount,
  maxPrepayModules,
  monthlySchedule,
  purchaseAnchorSlot,
} from './yearlyProgramAccess';
import { moduleMonthLabel, nextUnpaidModule, type ModuleRef } from './yearlyProgramModules';
import { verifyRenewToken } from './yearlyProgramRenew';
import { autopayGraceReason, type AutopayGraceReason } from './yearlyProgramReminderSchedule';

/// Що показати на `/yearly-program` тому, хто прийшов за персональним посиланням. Уся
/// логіка «чи можна зараз продати цій людині наступний модуль» — тут, в ОДНОМУ місці,
/// і кожна гілка дзеркалить конкретний 409 з `/api/wayforpay`. Сторінка не має права
/// бути оптимістичнішою за роут: кнопка, яка веде у відмову платіжки, гірша за чесний
/// текст.
///
/// Токен нічого не відкриває: він лише називає підписку. Усе, що нижче, — читання стану
/// цієї підписки тими самими функціями, якими його читає оплата.
///
/// Рубильника «Реєстрація відкрита» тут НЕМАЄ, і це рішення власника (09.09.2026).
/// `registrationOpen` вимикає НОВІ продажі — картки тарифів на лендінгу. Оплата
/// наступного модуля чинним студентом свого живого набору продажем не є: це доплата
/// всередині програми, за яку людина вже заплатила. Поки прапорець стосувався і її,
/// одразу після запуску набору (менеджер закриває реєстрацію) кожен студент місячної
/// оплати лишався без легального способу заплатити за наступний модуль — на цілий
/// навчальний рік. Той самий контракт тримає `/api/wayforpay`: прапорець там перевіряє
/// лише народження НОВОЇ підписки.
///
/// НАБІР беремо з САМОЇ підписки, а не з `resolveSellableCohort`. Це не дрібниця:
/// sellable-набір відповідає на питання «куди йдуть НОВІ покупці», і навесні, коли
/// менеджер заводить набір 2027 під продажі, він перестає збігатися з набором тих, хто
/// зараз навчається. Поки renew звірявся з ним, усі персональні посилання чинного
/// набору ставали «недійсними» рівно в той день, коли з'явився наступний набір, — і те
/// саме робив будь-який «блукаючий» набір без `isCurrent`. Поновлення — це доплата
/// всередині СВОГО набору: з нього рахуються сітка модулів, номер модуля і дати.

/// Чи можна автоплатнику доплатити модуль РАЗОВО, не вимикаючи автосписання наперед.
///
/// Rule 2 у `/api/wayforpay` («спочатку скасуйте автосписання») захищає від подвійного
/// списання, поки регулярка у WFP робоча: модуль і так спишеться сам. Але коли списання
/// вже не пройшло (`failedChargeCount > 0`) або підписка дійшла до GRACE (регулярки
/// немає, графік зсунуто, WFP мовчки перестав списувати), чекати нема чого — а студент,
/// який сам вимкнути автосписання не може, лишався без жодного шляху заплатити і тихо
/// втрачав доступ. Тож у цих станах разова доплата дозволена; саме правило регулярки
/// роут знімає при відкритті оплати (гілка downgrade), щоб WFP не списав той самий
/// модуль вдруге.
///
/// Єдине джерело правди для роуту, сторінки поновлення і листів автоплатника.
export function autopayAllowsManualTopUp(sub: {
  autoRenew: boolean;
  status: string;
  failedChargeCount: number | null;
}): boolean {
  if (!sub.autoRenew) return false;
  return sub.status === 'GRACE' || (sub.failedChargeCount ?? 0) > 0;
}

/// Чи можна відкривати чекаут з НОВИМ правилом автосписання для автоплатника зі зламаним
/// списанням (`resubscribe_broken_autopay`), коли вже відомий результат зняття СТАРИХ правил.
///
/// Ні — якщо хоч одне старе правило не знялось. `error` у результаті
/// `removeSubscriptionAutopay` збирає рівно ці випадки: відмова WFP з кодом ≠ 4102,
/// мережа/таймаут, не налаштовані креди мерчанта. 4102 («правила немає») туди не
/// потрапляє — це «знімати нічого», а не провал; тому `removed < attempted` без `error`
/// провалом не є.
///
/// Чому блок, а не «лог і далі», як у downgrade: на downgrade підписка стає разовою
/// (`autoRenew=false`), і нічний крок `retry_autopay_remove` дознімає правило. Тут нове
/// правило народилось би поруч зі старим, а ретрай autoRenew=true-підписок не бере —
/// старе правило жило б назавжди, і кожен модуль списувався б двічі.
export function resubscribeAllowedAfterRemove(result: {
  removed: number;
  attempted: number;
  error: string | null;
}): boolean {
  return result.error === null;
}

export type RenewBlockReason =
  /// Rule 2 у роуті: `monthly_autopay_active` — автосписання справне, модуль спишеться сам.
  | 'autopay'
  /// Rule 1 у роуті: `yearly_already_purchased`.
  | 'yearly_active'
  /// `monthly_fully_paid`.
  | 'fully_paid'
  /// `monthly_schedule_debt`.
  | 'debt'
  /// Сітки для цієї підписки не існує (перший платіж лежить за кінцем набору).
  | 'no_schedule'
  /// Набір, у якому людина навчається, уже завершився — доплачувати в нього нічого.
  | 'cohort_finished'
  /// Підписку деактивовано менеджером (ARCHIVED).
  | 'archived'
  /// У підписки немає жодного зарахованого платежу. Для системи це не «студент, який
  /// доплачує модуль», а новий продаж — і при закритій реєстрації `/api/wayforpay`
  /// відповість 409 `registration_closed`. Панель мусить казати те саме, інакше кнопка
  /// веде у відмову платіжки (саме так розходились сторінка й роут на manual-add
  /// підписці в режимі «чекаємо перший платіж»). Перший платіж робиться через
  /// запрошення менеджера, а не через це посилання.
  | 'no_payment';

/// Один варіант «оплатити N модулів одним платежем» для панелі поновлення.
export interface RenewModuleOption {
  /// Скільки модулів покриває платіж (1…`maxModules`).
  modules: number;
  /// Останній модуль, який покриває цей платіж (для N=1 — той самий, що `module`).
  last: { number: number; monthLabel: string };
  /// Сума до оплати = N × ціна модуля (без адмін-тестової ціни — її панель рахує сама).
  amount: number;
  /// ОСТАННІЙ день, оплачений цим платежем (день перед початком першого неоплаченого
  /// модуля; не далі кінця набору). Для `coversAll` — кінець набору. Панель пише
  /// «оплачено по <дата> включно» — тому саме останній день, а не початок наступного.
  paidThrough: Date;
  /// Цей платіж закриває ВСІ модулі, що лишились у наборі.
  coversAll: boolean;
}

/// Пропозиція підключити автоплатіж за посиланням: що саме і коли спишеться далі.
/// Ті самі функції, якими `/api/wayforpay` програмує WFP (`purchaseAnchorSlot`,
/// `maxAutopayChargeCount`, `lastAutopayChargeDate`) — панель не обіцяє інших дат.
export interface RenewAutopayOffer {
  /// Перше автоматичне списання (початок модуля після того, що оплачується зараз).
  nextChargeAt: Date;
  /// Останнє автоматичне списання (початок останнього модуля набору).
  lastChargeAt: Date;
  /// Скільки автоматичних списань буде ПІСЛЯ цієї оплати.
  charges: number;
  /// Сума кожного списання = ціна модуля.
  amount: number;
}

export type RenewState =
  /// Токен зіпсований, прострочений, або підписка вже не та, для якої його видали.
  /// Панель показує це ТЕКСТОМ («напишіть менеджеру — надішле нове»), а не порожнечею:
  /// людина прийшла за посиланням з листа і має отримати відповідь, а не білий екран.
  | { kind: 'invalid' }
  | {
      kind: 'payable';
      subscriptionId: string;
      name: string | null;
      email: string;
      module: ModuleRef;
      price: number;
      prefill: { phone: string | null; country: string | null; telegram: string | null };
      /// Автоплатник, у якого списання не пройшло: ця оплата вимкне автосписання
      /// (див. `autopayAllowsManualTopUp`). Панель має сказати це до оплати.
      stopsAutopay: boolean;
      /// Чому автосписання не спрацювало (`autopayGraceReason`) — панель називає саме цю
      /// причину, а не завжди «не пройшло». null, коли `stopsAutopay` = false.
      stopsAutopayReason: AutopayGraceReason | null;
      /// Скільки модулів можна оплатити одним платежем (`maxPrepayModules`) — ≥ 1.
      maxModules: number;
      /// Варіанти N = 1…maxModules, по порядку.
      options: RenewModuleOption[];
      /// null — автоплатіж підключати нема чого (лишився один модуль).
      autopay: RenewAutopayOffer | null;
    }
  | {
      kind: 'blocked';
      reason: RenewBlockReason;
      name: string | null;
      email: string;
      /// Наступний неоплачений модуль, якщо він узагалі існує (для 'debt' — той, за який
      /// борг; для 'fully_paid' / 'no_schedule' / 'archived' — null).
      module: ModuleRef | null;
      /// Скільки модулів пропущено — тільки для 'debt'.
      missedModules?: number;
    };

type RenewStateClient = Pick<PrismaClient, 'yearlyProgramSubscription'>;

export async function resolveRenewState(args: {
  client: RenewStateClient;
  token: string;
  monthlyPrice: number;
  now?: Date;
}): Promise<RenewState> {
  const { client, monthlyPrice } = args;
  const now = args.now ?? new Date();

  const payload = verifyRenewToken(args.token);
  if (!payload) return { kind: 'invalid' };

  const sub = await client.yearlyProgramSubscription.findUnique({
    where: { id: payload.subscriptionId },
    select: {
      id: true,
      userId: true,
      plan: true,
      status: true,
      autoRenew: true,
      failedChargeCount: true,
      wfpRegularRef: true,
      cohortId: true,
      phone: true,
      country: true,
      telegramUsername: true,
      user: { select: { name: true, email: true } },
      // Набір ПІДПИСКИ — єдине джерело сітки модулів для поновлення.
      cohort: { select: { id: true, startDate: true, endDate: true } },
      payments: {
        where: { status: 'PAID', excludedFromAccess: false },
        select: {
          amount: true, status: true, paidAt: true, createdAt: true,
          excludedFromAccess: true, manualMethod: true, moduleCount: true,
        },
      },
    },
  });
  if (!sub) return { kind: 'invalid' };
  // Посилання прив'язане до набору, у якому підписка була на момент видачі. Якщо її
  // відтоді перенесли — сітка модулів інша, і продовжувати за старим посиланням не можна.
  if (sub.cohortId !== payload.cohortId) return { kind: 'invalid' };
  // Email у токені підписаний, але власника підписки могли змінити (об'єднання акаунтів,
  // виправлення адреси менеджером). Тоді посилання адресує вже не ту людину.
  const email = sub.user?.email?.trim().toLowerCase() ?? '';
  if (!email || email !== payload.email) return { kind: 'invalid' };

  const name = sub.user?.name ?? null;
  /// Блокування без сітки модулів — для станів, у яких номер модуля не має сенсу.
  const flat = (reason: RenewBlockReason): RenewState => ({ kind: 'blocked', reason, name, email, module: null });

  if (sub.status === 'ARCHIVED') return flat('archived');
  // Підписку конвертували в Річну (`convert_to_yearly`) — модулі їй більше не продаються.
  if (sub.plan !== 'MONTHLY') return flat('yearly_active');
  // Набір видалили після видачі посилання — сітки не існує, вигадувати її не можна.
  const cohort = sub.cohort;
  if (!cohort) return { kind: 'invalid' };
  // Те саме порівняння, що й у `resolveSellableCohort` (`endDate >= now`): кінець набору
  // нормалізований до 23:59:59.999 UTC, тож останній день набору ще «живий».
  if (cohort.endDate.getTime() < now.getTime()) return flat('cohort_finished');

  const schedule = monthlySchedule({ cohort, payments: sub.payments });
  const nextModule = nextUnpaidModule({ cohort, payments: sub.payments });
  const blocked = (reason: RenewBlockReason, extra?: { module?: ModuleRef | null; missedModules?: number }): RenewState => ({
    kind: 'blocked',
    reason,
    name,
    email,
    module: extra?.module !== undefined ? extra.module : nextModule,
    ...(extra?.missedModules !== undefined ? { missedModules: extra.missedModules } : {}),
  });

  // Порядок гілок — рівно як у роуті: спершу крос-планові блоки, потім кеп, потім борг.
  const hasLivePayment = sub.status === 'ACTIVE' || sub.status === 'GRACE' || schedule.hasPayments;
  const yearlySub = await client.yearlyProgramSubscription.findFirst({
    where: { userId: sub.userId, plan: 'YEARLY', status: { in: ['ACTIVE', 'GRACE'] } },
    select: { id: true },
  });
  if (yearlySub) return blocked('yearly_active', { module: null });
  // Справне автосписання — блок (модуль спишеться сам). Зламане — пропускаємо далі до
  // звичайних перевірок: людина може закрити модуль сама.
  const stopsAutopay = autopayAllowsManualTopUp(sub);
  if (sub.autoRenew && hasLivePayment && !stopsAutopay) return blocked('autopay');
  // Жодного зарахованого платежу — доплачувати нічого: це перша покупка, а не
  // поновлення. Стоїть ПЕРЕД сіткою модулів свідомо: без платежів сітка формально
  // віддала б «модуль 1 з 9», і панель обіцяла б оплату, яку роут не пропустить.
  if (!schedule.hasPayments) return blocked('no_payment', { module: null });
  if (schedule.degenerate) return blocked('no_schedule', { module: null });
  if (schedule.isFullyPaid || !nextModule) return blocked('fully_paid', { module: null });

  if (schedule.hasPayments) {
    // `edge: false` — питання «який модуль іде ЗАРАЗ», а не «який купують»: те саме
    // правило, що й у guard-і боргу в роуті, інакше сторінка і чекаут розійшлись би
    // в останню добу модуля.
    const missed = cohortSlotIndex(cohort, now, { edge: false }) - schedule.nextSlotIndex;
    if (missed > 0) return blocked('debt', { missedModules: missed });
  }

  // Скільки модулів можна закрити одним платежем — рівно стільки, скільки лишилось
  // своїх (роут відповість 409 `monthly_modules_exceed` на більше).
  const maxModules = Math.max(1, maxPrepayModules(schedule));
  const options: RenewModuleOption[] = [];
  for (let n = 1; n <= maxModules; n++) {
    const lastIndex = schedule.nextSlotIndex + n - 1;
    const coversAll = n >= schedule.remaining;
    const until = schedule.moduleOf(schedule.nextSlotIndex + n);
    options.push({
      modules: n,
      last: { number: lastIndex + 1, monthLabel: moduleMonthLabel(schedule.moduleOf(lastIndex)) },
      amount: monthlyPrice * n,
      paidThrough: coversAll || until > cohort.endDate
        ? cohort.endDate
        : new Date(until.getTime() - 24 * 60 * 60 * 1000),
      coversAll,
    });
  }

  // Автоплатіж: той самий якір, що й у роуті. Якщо після цієї оплати списувати нічого
  // (лишився останній модуль) — роут регулярку не програмує, і галочки не показуємо.
  const anchor = purchaseAnchorSlot({ cohort, schedule, now });
  const totalCharges = maxAutopayChargeCount({ cohort, firstSlot: anchor });
  const autopay: RenewAutopayOffer | null = totalCharges > 1 && maxModules > 1
    ? {
        nextChargeAt: cohortModuleStart(cohort, anchor + 1),
        lastChargeAt: lastAutopayChargeDate({ cohort, firstSlot: anchor }),
        charges: totalCharges - 1,
        amount: monthlyPrice,
      }
    : null;

  return {
    kind: 'payable',
    subscriptionId: sub.id,
    name,
    email,
    module: nextModule,
    price: monthlyPrice,
    maxModules,
    options,
    autopay,
    prefill: { phone: sub.phone, country: sub.country, telegram: sub.telegramUsername },
    stopsAutopay,
    stopsAutopayReason: stopsAutopay
      ? autopayGraceReason({ failedChargeCount: sub.failedChargeCount, wfpRegularRef: sub.wfpRegularRef ?? null })
      : null,
  };
}
