import {
  cohortModuleCount,
  monthlySchedule,
  slotDateOf,
  type CohortLike,
  type MonthlySchedule,
  type PaymentLike,
} from './yearlyProgramAccess';

/// Читалка сітки модулів «для людей»: номер модуля з назвою місяця для кожного платежу
/// і для наступного (ще не оплаченого) слота. Формулу не рахує — лише споживає
/// `monthlySchedule` з `lib/yearlyProgramAccess.ts`.
///
/// Навіщо окремий модуль: і сторінка поновлення, і панель «Платежі» в адмінці, і листи
/// показують ОДНЕ й те саме — «Модуль 3 з 9 · листопад 2026». Три власні реалізації
/// розійшлися б на першому ж пізньому покупцеві (у нього сітка коротша, а номер модуля —
/// абсолютний номер у наборі, не порядковий номер його платежу).

/// «жовтень 2026». Дати модулів — UTC-опівночі з `cohortModuleStart`, тож форматуємо
/// теж в UTC: у київській зоні 01.10 00:00 UTC — це вже 01.10 03:00, місяць той самий,
/// але на наборах зі стартом 1-го числа й зимовим переходом краще не залежати від зони.
export function moduleMonthLabel(start: Date): string {
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(start)
    .replace(/\s*р\.$/, '');
}

export interface ModuleRef {
  /// Абсолютний 1-based номер модуля в наборі (вересень = 1 … травень = 9).
  number: number;
  /// Скільки всього модулів у наборі — знаменник у «3 з 9».
  total: number;
  /// Перший день модуля.
  startsAt: Date;
  /// «листопад 2026»
  monthLabel: string;
}

function moduleRef(cohort: CohortLike, index: number, schedule: MonthlySchedule): ModuleRef {
  const startsAt = schedule.moduleOf(index);
  return {
    number: index + 1,
    total: cohortModuleCount(cohort),
    startsAt,
    monthLabel: moduleMonthLabel(startsAt),
  };
}

/// Наступний НЕоплачений модуль підписки. null — усі свої модулі сплачені або сітки
/// для цієї підписки не існує (вироджений набір).
export function nextUnpaidModule(args: {
  cohort: CohortLike;
  payments: PaymentLike[];
}): ModuleRef | null {
  const schedule = monthlySchedule(args);
  if (schedule.degenerate || schedule.isFullyPaid || schedule.nextSlotStart === null) return null;
  return moduleRef(args.cohort, schedule.nextSlotIndex, schedule);
}

/// Розкладає ЗАРАХОВАНІ платежі по модулях: перший (за слот-датою) займає `firstSlot`,
/// кожен наступний — наступний модуль. Саме так їх рахує сітка, тому й показуємо так,
/// а не «за датою кожного платежу окремо»: людина, яка внесла два модулі одним днем,
/// має бачити модулі 3 і 4, а не двічі модуль 3.
///
/// Вироджений випадок (перший платіж уже за кінцем набору) повертає порожню мапу —
/// слотів у такої підписки нема, і вигадувати їм номери не можна.
export function assignPaymentModules<T extends PaymentLike & { id: string }>(args: {
  cohort: CohortLike;
  payments: T[];
}): Map<string, ModuleRef> {
  const schedule = monthlySchedule({ cohort: args.cohort, payments: args.payments });
  const result = new Map<string, ModuleRef>();
  if (schedule.degenerate) return result;
  const counted = args.payments
    .filter((p) => p.status === 'PAID' && !p.excludedFromAccess)
    .map((p) => ({ p, slot: slotDateOf(p) }))
    // Тай-брейк по id — щоб два платежі з однаковою слот-датою (авто-розбивка ручного
    // внесення) отримували стабільні номери між перезавантаженнями сторінки.
    .sort((a, b) => a.slot.getTime() - b.slot.getTime() || (a.p.id < b.p.id ? -1 : 1));
  counted.forEach(({ p }, i) => {
    result.set(p.id, moduleRef(args.cohort, schedule.firstSlot + i, schedule));
  });
  return result;
}
