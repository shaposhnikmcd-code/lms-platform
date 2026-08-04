/// Хелпери для роботи з YearlyProgramCohort — поточний cohort, дефолтні значення,
/// рендеринг welcome-листа.

import type { PrismaClient } from '@prisma/client';
import { addCalendarMonths, countMonthlySlots, endOfUtcDay } from './yearlyProgramAccess';
import { YEARLY_PROGRAM_CONFIG } from './yearlyProgramConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/// Нормалізація дати завершення набору до КІНЦЯ доби (23:59:59.999 UTC).
/// Менеджер вводить «31.05.2027» — і має на увазі весь цей день. Якщо зберегти 00:00,
/// останній місячний слот не влазить у набір і графік списань коротшає на платіж.
export function normalizeCohortEndDate(date: Date): Date {
  return endOfUtcDay(date);
}

/// Скільки календарних місячних слотів вміщується у набір + рекомендована дата завершення
/// для рівно `totalMonthlyPayments` слотів. Та сама сітка, що й у графіку списань.
export function describeCohortSchedule(startDate: Date, endDate: Date): {
  slots: number;
  required: number;
  recommendedEndDate: Date;
} {
  const required = YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;
  return {
    // На один більше за потрібне — щоб побачити й «задовгий» період, а не лише короткий.
    slots: countMonthlySlots(startDate, endDate, required + 1),
    required,
    // Останній слот покриває доступ до `start + N місяців − 1 день`.
    recommendedEndDate: new Date(
      addCalendarMonths(startDate, YEARLY_PROGRAM_CONFIG.totalMonthlyPayments).getTime() - MS_PER_DAY,
    ),
  };
}

/// Валідація періоду набору: між startDate і endDate має вміщуватись РІВНО
/// `totalMonthlyPayments` місячних слотів. Захист від «зсунули дату на день — і всі
/// клієнти втратили останнє списання» (або навпаки, отримали зайве).
/// Повертає текст помилки або null, якщо все гаразд.
export function validateCohortSchedule(startDate: Date, endDate: Date): string | null {
  const { slots, required, recommendedEndDate } = describeCohortSchedule(startDate, endDate);
  if (slots === required) return null;
  const fmt = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('.');
  // countMonthlySlots обмежений required+1, тож «required+1» означає «стільки або більше».
  const fits = slots > required ? `більше ніж ${required}` : String(slots);
  return `Період набору має вміщувати рівно ${required} місячних слотів, а вміщує ${fits}. `
    + `Для старту ${fmt(startDate)} коректна дата завершення — ${fmt(recommendedEndDate)}.`;
}

type CohortClient = {
  yearlyProgramCohort: {
    findFirst: (args: { where: { isCurrent: boolean } }) => Promise<{ id: string; startDate: Date; endDate: Date } | null>;
  };
};

export interface CohortRecord {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  launchedAt: Date | null;
  emailScheduledFor: Date | null;
  emailSentAt: Date | null;
  launchEmailSubject: string | null;
  launchEmailBody: string | null;
  isCurrent: boolean;
}

/// Знаходить поточний cohort (`isCurrent=true`). null якщо менеджер ще не створив жодного.
/// Використовується при кожній новій оплаті — підписка автоматично прив'язується сюди.
export async function getCurrentCohort(client: CohortClient): Promise<{ id: string; startDate: Date; endDate: Date } | null> {
  return client.yearlyProgramCohort.findFirst({ where: { isCurrent: true } });
}

type SellableCohortClient = Pick<PrismaClient, 'yearlyProgramCohort'>;

/// Cohort, у який ідуть нові оплати і який «відкриває» кнопки на публічній сторінці.
/// Пріоритет: 1) явно позначений «Поточний» (`isCurrent`, ще не завершений — `endDate >= now`);
/// 2) НЕзапущений майбутній
/// набір (`launchedAt IS NULL AND endDate >= now`, найраніший за startDate) — щоб коли
/// співіснують «2026 уже запущена й добігає» та «2027 створена під продажі», нові оплати
/// йшли у 2027, навіть якщо менеджер забув перемкнути «Поточний»; 3) найближчий ще не
/// завершений запуск (стара поведінка — дозволяє late-joiner-ам купувати у запущений
/// cohort, поки наступного не існує). null — коли запусків немає або всі завершені.
/// ВАЖЛИВО: публічний гейт (page.tsx) і прив'язка оплати (/api/wayforpay) мають викликати
/// САМЕ цей резолвер — інакше кнопка може бути активна, а оплата падати (різні cohort-и).
export async function resolveSellableCohort(
  client: SellableCohortClient,
  now: Date = new Date(),
): Promise<{ id: string; startDate: Date; endDate: Date } | null> {
  // `endDate >= now` обов'язковий і тут (як у гілках нижче): менеджер часто лишає прапорець
  // «Поточний» на минулорічному наборі. Без цієї умови продажі не закривались би після
  // завершення програми, а нова оплата рахувала б дати доступу по вже закінченому cohort-у
  // (доступ «народжується» простроченим).
  const current = await client.yearlyProgramCohort.findFirst({
    where: { isCurrent: true, endDate: { gte: now } },
    select: { id: true, startDate: true, endDate: true },
  });
  if (current) return current;
  const upcoming = await client.yearlyProgramCohort.findFirst({
    where: { launchedAt: null, endDate: { gte: now } },
    orderBy: { startDate: 'asc' },
    select: { id: true, startDate: true, endDate: true },
  });
  if (upcoming) return upcoming;
  return client.yearlyProgramCohort.findFirst({
    where: { endDate: { gte: now } },
    orderBy: { startDate: 'asc' },
    select: { id: true, startDate: true, endDate: true },
  });
}

/// Дефолти для форми створення нового cohort.
/// startDate за замовчуванням = 01.09 поточного або наступного року (залежить від today).
/// endDate = startDate + 9 місяців − 1 день, кінець доби (рівно 9 місячних слотів —
/// саме те, що вимагає validateCohortSchedule).
/// Все в UTC, як і решта дат Річної: інакше на машині у UTC+3 «01.09 00:00 локально»
/// зберігалось би як 31.08 21:00Z і з'їдало добу з графіка.
export function getDefaultCohortValues(now: Date = new Date()): {
  name: string;
  startDate: Date;
  endDate: Date;
} {
  const year = now.getUTCMonth() >= 8 /* Sep+ */ && now.getUTCDate() > 1 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const startDate = new Date(Date.UTC(year, 8, 1, 0, 0, 0, 0)); // 01.09.{year} 00:00 UTC
  const endDate = normalizeCohortEndDate(
    new Date(addCalendarMonths(startDate, YEARLY_PROGRAM_CONFIG.totalMonthlyPayments).getTime() - MS_PER_DAY),
  );
  return {
    name: `Річна програма ${year}`,
    startDate,
    endDate,
  };
}

/// Рендеринг шаблона welcome-листа з підстановкою плейсхолдерів.
/// Підтримуються: {{name}}, {{email}}, {{startDate}}, {{endDate}}, {{cohortName}}.
/// Дати форматуються у локальному UA-стилі (напр. "1 вересня 2026").
export function renderLaunchEmailTemplate(template: {
  subject: string;
  body: string;
  variables: {
    name: string | null;
    email: string;
    startDate: Date;
    endDate: Date;
    cohortName: string;
  };
}): { subject: string; body: string } {
  const fmtDate = (d: Date) => new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);

  const replacements: Record<string, string> = {
    '{{name}}': template.variables.name ?? 'учаснику',
    '{{email}}': template.variables.email,
    '{{startDate}}': fmtDate(template.variables.startDate),
    '{{endDate}}': fmtDate(template.variables.endDate),
    '{{cohortName}}': template.variables.cohortName,
  };

  const apply = (s: string) => Object.entries(replacements).reduce(
    (acc, [k, v]) => acc.split(k).join(v),
    s,
  );

  return {
    subject: apply(template.subject),
    body: apply(template.body),
  };
}

/// Дефолтний шаблон welcome-листа. Використовується якщо cohort.launchEmailSubject/Body
/// не задані. Менеджер може скопіювати в редактор і змінити.
export const DEFAULT_LAUNCH_EMAIL_SUBJECT = 'Ласкаво просимо до {{cohortName}} — програма стартувала!';

export const DEFAULT_LAUNCH_EMAIL_BODY = `<p>Вітаємо, {{name}}!</p>

<p>Ми раді вітати вас у програмі <strong>{{cohortName}}</strong>. Сьогодні ваше навчання
офіційно стартувало — доступ до всіх матеріалів вже відкрито на платформі SendPulse.</p>

<p><strong>Ваш період навчання:</strong><br>
з {{startDate}} до {{endDate}}</p>

<p>Усі модулі, відеолекції та практичні завдання з'являтимуться у вашому особистому кабінеті
згідно з графіком програми. Радимо приділяти навчанню кілька годин на тиждень — це гарантовано
дасть результат.</p>

<p>Якщо виникнуть питання — пишіть нам у відповідь на цей лист, і ми обов'язково допоможемо.</p>

<p>З найкращими побажаннями,<br>
команда UIMP</p>`;

/// Чи може cohort приймати нові оплати (поточний cohort, ще не запущений).
/// Запущені cohort-и НЕ приймають нові оплати — нові підписники йдуть у наступний cohort.
export function canAcceptNewSubscriptions(cohort: { isCurrent: boolean; launchedAt: Date | null }): boolean {
  return cohort.isCurrent && cohort.launchedAt === null;
}
