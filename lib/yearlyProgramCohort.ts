/// Хелпери для роботи з YearlyProgramCohort — поточний cohort, дефолтні значення,
/// рендеринг welcome-листа.

import type { PrismaClient } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/// Дефолти для форми створення нового cohort.
/// startDate за замовчуванням = 01.09 поточного або наступного року (залежить від today).
/// endDate = startDate + 9 місяців − 1 день (програма триває 9 повних місяців).
export function getDefaultCohortValues(now: Date = new Date()): {
  name: string;
  startDate: Date;
  endDate: Date;
} {
  const year = now.getMonth() >= 8 /* Sep+ */ && now.getDate() > 1 ? now.getFullYear() + 1 : now.getFullYear();
  const startDate = new Date(year, 8, 1, 0, 0, 0, 0); // 01.09.{year} 00:00
  const endDate = new Date(year + 1, 5, 1, 0, 0, 0, 0); // 01.06.{year+1} 00:00 — приблизно +9 міс
  // Округлюємо endDate на 1 день назад щоб дати були "до кінця 31.05".
  endDate.setTime(endDate.getTime() - MS_PER_DAY);
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
