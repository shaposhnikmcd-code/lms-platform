import type { PrismaClient } from '@prisma/client';
import { cohortSlotIndex, monthlySchedule } from './yearlyProgramAccess';
import { nextUnpaidModule, type ModuleRef } from './yearlyProgramModules';
import { verifyRenewToken } from './yearlyProgramRenew';

/// Що показати на `/yearly-program?renew=…`. Уся логіка «чи можна зараз продати цій
/// людині наступний модуль» — тут, в ОДНОМУ місці, і кожна гілка дзеркалить конкретний
/// 409 з `/api/wayforpay`. Сторінка не має права бути оптимістичнішою за роут: кнопка,
/// яка веде у відмову платіжки, гірша за чесний текст.
///
/// Токен нічого не відкриває: він лише називає підписку. Усе, що нижче, — читання стану
/// цієї підписки тими самими функціями, якими його читає оплата.

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
  /// Продажі закриті менеджером. Renew-посилання НЕ обходить `registrationOpen` —
  /// це той самий рубильник, що вимикає кнопки в картках тарифів.
  | 'registration_closed';

export type RenewState =
  /// Токен зіпсований, прострочений, або підписка вже не та, для якої його видали.
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
      /// борг; для 'fully_paid' / 'no_schedule' — null).
      module: ModuleRef | null;
      /// Скільки модулів пропущено — тільки для 'debt'.
      missedModules?: number;
    };

type RenewStateClient = Pick<PrismaClient, 'yearlyProgramSubscription'>;

export async function resolveRenewState(args: {
  client: RenewStateClient;
  token: string;
  /// Набір, за яким зараз ідуть продажі (`resolveSellableCohort`). null — продавати нічого.
  currentCohort: { id: string; startDate: Date; endDate: Date } | null;
  monthlyPrice: number;
  registrationOpen: boolean;
  now?: Date;
}): Promise<RenewState> {
  const { client, currentCohort, monthlyPrice, registrationOpen } = args;
  const now = args.now ?? new Date();

  const payload = verifyRenewToken(args.token);
  if (!payload) return { kind: 'invalid' };
  // Посилання прив'язане до набору. Якщо продажі вже йдуть в іншому наборі (або не йдуть
  // зовсім) — сітка модулів інша, і продовжувати нема чого: чекаут усе одно впаде на
  // `renew_link_stale` / `no_current_cohort`.
  if (!currentCohort || currentCohort.id !== payload.cohortId) return { kind: 'invalid' };

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
      payments: {
        where: { status: 'PAID', excludedFromAccess: false },
        select: {
          amount: true, status: true, paidAt: true, createdAt: true,
          excludedFromAccess: true, manualMethod: true,
        },
      },
    },
  });
  if (!sub || sub.plan !== 'MONTHLY' || sub.status === 'ARCHIVED') return { kind: 'invalid' };
  if (sub.cohortId !== payload.cohortId) return { kind: 'invalid' };
  // Email у токені підписаний, але власника підписки могли змінити (об'єднання акаунтів,
  // виправлення адреси менеджером). Тоді посилання адресує вже не ту людину.
  const email = sub.user?.email?.trim().toLowerCase() ?? '';
  if (!email || email !== payload.email) return { kind: 'invalid' };

  const name = sub.user?.name ?? null;
  const schedule = monthlySchedule({ cohort: currentCohort, payments: sub.payments });
  const nextModule = nextUnpaidModule({ cohort: currentCohort, payments: sub.payments });
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
    const missed = cohortSlotIndex(currentCohort, now, { edge: false }) - schedule.nextSlotIndex;
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
