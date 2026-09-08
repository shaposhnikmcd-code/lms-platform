import type { PrismaClient } from '@prisma/client';
import { cohortSlotIndex, monthlySchedule } from './yearlyProgramAccess';
import { nextUnpaidModule, type ModuleRef } from './yearlyProgramModules';
import { verifyRenewToken } from './yearlyProgramRenew';

/// Що показати на `/yearly-program` тому, хто прийшов за персональним посиланням. Уся
/// логіка «чи можна зараз продати цій людині наступний модуль» — тут, в ОДНОМУ місці,
/// і кожна гілка дзеркалить конкретний 409 з `/api/wayforpay`. Сторінка не має права
/// бути оптимістичнішою за роут: кнопка, яка веде у відмову платіжки, гірша за чесний
/// текст.
///
/// Токен нічого не відкриває: він лише називає підписку. Усе, що нижче, — читання стану
/// цієї підписки тими самими функціями, якими його читає оплата.
///
/// НАБІР беремо з САМОЇ підписки, а не з `resolveSellableCohort`. Це не дрібниця:
/// sellable-набір відповідає на питання «куди йдуть НОВІ покупці», і навесні, коли
/// менеджер заводить набір 2027 під продажі, він перестає збігатися з набором тих, хто
/// зараз навчається. Поки renew звірявся з ним, усі персональні посилання чинного
/// набору ставали «недійсними» рівно в той день, коли з'явився наступний набір, — і те
/// саме робив будь-який «блукаючий» набір без `isCurrent`. Поновлення — це доплата
/// всередині СВОГО набору: з нього рахуються сітка модулів, номер модуля і дати.

export type RenewBlockReason =
  /// Rule 2 у роуті: `monthly_autopay_active`.
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
  /// Продажі закриті менеджером. Renew-посилання НЕ обходить `registrationOpen` —
  /// це той самий рубильник, що вимикає кнопки в картках тарифів.
  | 'registration_closed';

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
  registrationOpen: boolean;
  now?: Date;
}): Promise<RenewState> {
  const { client, monthlyPrice, registrationOpen } = args;
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
          excludedFromAccess: true, manualMethod: true,
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
  if (sub.autoRenew && hasLivePayment) return blocked('autopay');
  if (schedule.degenerate) return blocked('no_schedule', { module: null });
  if (schedule.isFullyPaid || !nextModule) return blocked('fully_paid', { module: null });

  if (schedule.hasPayments) {
    // `edge: false` — питання «який модуль іде ЗАРАЗ», а не «який купують»: те саме
    // правило, що й у guard-і боргу в роуті, інакше сторінка і чекаут розійшлись би
    // в останню добу модуля.
    const missed = cohortSlotIndex(cohort, now, { edge: false }) - schedule.nextSlotIndex;
    if (missed > 0) return blocked('debt', { missedModules: missed });
  }

  if (!registrationOpen) return blocked('registration_closed');

  return {
    kind: 'payable',
    subscriptionId: sub.id,
    name,
    email,
    module: nextModule,
    price: monthlyPrice,
    prefill: { phone: sub.phone, country: sub.country, telegram: sub.telegramUsername },
  };
}
