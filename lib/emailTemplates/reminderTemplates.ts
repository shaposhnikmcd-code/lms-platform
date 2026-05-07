import prisma from '@/lib/prisma';
import { renderTemplate } from './paymentTemplates';

/// Реєстр email-нагадувань Річної програми. Те саме DB-pattern що й paymentTemplates:
/// дефолти живуть у коді, custom subject/bodyHtml зберігається у `EmailTemplate` з префіксом
/// `reminder.<key>` щоб не плутатись з payment-шаблонами.
///
/// Розклад адаптивний за `graceDays` із налаштувань:
///   • start (день +1) — завжди
///   • mid (≈ середина grace) — тільки якщо graceDays ≥ 5
///   • last (за 1 день до закриття) — тільки якщо graceDays ≥ 3
///   • closed — у день закриття
/// Manual і cyclical потоки мають окремі шаблони, але однаковий розклад.
///
/// 9 шаблонів:
///   manual-before, manual-on-expiry, manual-grace-start, manual-grace-mid, manual-grace-last
///   cyclical-failed-1, cyclical-grace-mid, cyclical-grace-last
///   closed

export type ReminderTemplateKey =
  | 'manual-before'
  | 'manual-on-expiry'
  | 'manual-grace-start'
  | 'manual-grace-mid'
  | 'manual-grace-last'
  | 'cyclical-failed-1'
  | 'cyclical-grace-mid'
  | 'cyclical-grace-last'
  | 'closed';

export type ReminderTemplateGroup = 'manual' | 'cyclical' | 'shared';

export interface ReminderTemplateMeta {
  key: ReminderTemplateKey;
  group: ReminderTemplateGroup;
  title: string;
  when: string;
  placeholders: string[];
  sampleData: Record<string, string>;
  defaultSubject: string;
  defaultBodyHtml: string; // повний HTML з FRAME wrapper-ом
  /// Мінімальна тривалість grace, при якій cron шле цей шаблон.
  /// undefined = шаблон активний завжди (start, before, on-expiry, closed).
  /// 5 = шле тільки при graceDays ≥ 5 (mid-templates).
  /// 3 = шле тільки при graceDays ≥ 3 (last-templates).
  minGraceDays?: number;
}

export const REMINDER_TEMPLATE_GROUPS: { id: ReminderTemplateGroup; title: string; description: string }[] = [
  { id: 'manual',   title: '💳 Manual — клієнт платить сам', description: 'Лист-нагадування про оплату наступного місяця для тих, хто платить вручну (без автосписання).' },
  { id: 'cyclical', title: '🔄 Cyclical — автосписання',     description: 'Шлемо тільки при невдалому списанні з картки.' },
  { id: 'shared',   title: '🚪 Спільний фінал',              description: 'Лист про закриття доступу — однаковий для обох флоу.' },
];

const PROGRAM_URL = 'https://www.uimp.com.ua/yearly-program';
const SUPPORT_TG = 'https://t.me/uimp_support';

/// Зовнішній FRAME — DOCTYPE + body-стилі з UIMP-фоном. Не редагується менеджером —
/// він редагує тільки inner-частину між div-і.
export function wrapReminderInner(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="uk"><head><meta charset="utf-8"><title>UIMP Email</title></head>
<body style="margin:0;padding:24px;background:#f6f3ee;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background:#fff; border-radius:12px; padding:32px; color:#1c1917; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
${innerHtml}
  </div>
</body></html>`;
}

/// Зворотний бік `wrapReminderInner` — витягує inner-HTML з повного. Якщо wrapper не розпізнано
/// (legacy/нестандартні правки) — повертає `fullBodyHtml` як є.
export function extractReminderInner(fullBodyHtml: string): string {
  const m = fullBodyHtml.match(
    /<div[^>]*style="[^"]*max-width:\s*560px[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/body>/,
  );
  return m ? m[1].trim() : fullBodyHtml;
}

/// Готові HTML-фрагменти, які менеджер може використовувати в листі:
/// CTA-кнопка з посиланням на сайт + footer із контактом тех-підтримки.
const CTA_BUTTON = (label: string) => `    <p style="text-align:center; margin: 28px 0;">
      <a href="${PROGRAM_URL}" style="display:inline-block; background:#D4A017; color:#fff; font-weight:bold; padding:12px 28px; border-radius:10px; text-decoration:none;">${label}</a>
    </p>`;

const SUPPORT_FOOTER = `    <p>Якщо у вас є питання — напишіть у відповідь на цей лист або до <a href="${SUPPORT_TG}" style="color:#0088cc; font-weight:600; text-decoration:none; white-space:nowrap;">Тех. підтримки в Telegram</a></p>`;

/// Усі reminder/grace/closed-листи — нейтральний tone. «З теплом» прибрали з усіх дефолтів,
/// бо для службово-фінансових повідомлень воно звучить занадто фамільярно.
const SIGNATURE_RESPECT = `    <p style="margin-top: 32px;">З повагою,<br/>Команда UIMP</p>`;

export const REMINDER_TEMPLATES: Record<ReminderTemplateKey, ReminderTemplateMeta> = {
  'manual-before': {
    key: 'manual-before',
    group: 'manual',
    title: '📅 За 3 дні до дати закінчення',
    when: 'Шлемо за 3 дні до того, як закінчиться оплачений місяць (manual flow). Нагадуємо оформити оплату на наступний місяць.',
    placeholders: ['name', 'expiresAt'],
    sampleData: { name: 'Іван Петренко', expiresAt: '15.08.2026' },
    defaultSubject: 'Через 3 дні завершується ваш місяць у Річній програмі',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong> завершується <strong>{expiresAt}</strong>.</p>
    <p>Якщо плануєте продовжити навчання, оплату на наступний місяць можна оформити вже зараз — щоб не було перерви у доступі:</p>
${CTA_BUTTON('Оплатити наступний місяць')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'manual-on-expiry': {
    key: 'manual-on-expiry',
    group: 'manual',
    title: '📆 У дату закінчення',
    when: 'Шлемо у день, коли закінчується оплачений місяць (manual flow). Сьогодні останній день — час оплатити.',
    placeholders: ['name'],
    sampleData: { name: 'Іван Петренко' },
    defaultSubject: 'Сьогодні завершується ваш місяць у Річній програмі',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Сьогодні завершується ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>Якщо плануєте продовжити навчання, оплату на наступний місяць можна оформити сьогодні:</p>
${CTA_BUTTON('Оплатити зараз')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'manual-grace-start': {
    key: 'manual-grace-start',
    group: 'manual',
    title: '🛟 Старт пільгового періоду · день +1',
    when: 'Шлемо коли оплачений місяць щойно закінчився, а доступ продовжено на пільговий період grace (manual flow). Спрацьовує завжди.',
    placeholders: ['name', 'gracePeriodEndsAt', 'graceDays', 'graceDaysWord'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026', graceDays: '7', graceDaysWord: 'днів' },
    defaultSubject: 'Доступ збережено ще на {graceDays} {graceDaysWord}',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong> вчора завершився. Ми залишили доступ ще на <strong>{graceDays} {graceDaysWord}</strong> — до <strong>{gracePeriodEndsAt}</strong>, щоб у вас був час оформити наступну оплату.</p>
    <p>Якщо плануєте продовжити навчання:</p>
${CTA_BUTTON('Оплатити наступний місяць')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'manual-grace-mid': {
    key: 'manual-grace-mid',
    group: 'manual',
    title: '📍 Середина пільгового періоду',
    when: 'Шлемо приблизно посередині grace-періоду (manual flow). Спрацьовує тільки якщо тривалість grace ≥ 5 днів — інакше пропускаємо, бо проміжна точка занадто близько до start/last.',
    placeholders: ['name', 'gracePeriodEndsAt', 'daysLeft', 'daysWord'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026', daysLeft: '4', daysWord: 'дні' },
    minGraceDays: 5,
    defaultSubject: 'Пільговий період — залишилось {daysLeft} {daysWord}',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Нагадуємо: пільговий період у вашій підписці на <strong>Річну програму інституту UIMP</strong> завершується <strong>{gracePeriodEndsAt}</strong> — залишилось <strong>{daysLeft} {daysWord}</strong>.</p>
    <p>Якщо плануєте продовжити навчання, оплату можна оформити за кнопкою нижче:</p>
${CTA_BUTTON('Оплатити наступний місяць')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'manual-grace-last': {
    key: 'manual-grace-last',
    group: 'manual',
    title: '🚨 За 1 день до закриття',
    when: 'Шлемо за день до того, як закінчиться пільговий період і доступ буде закрито (manual flow). Спрацьовує тільки якщо тривалість grace ≥ 3 днів — інакше дублює start.',
    placeholders: ['name', 'gracePeriodEndsAt'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026' },
    minGraceDays: 3,
    defaultSubject: 'Завтра завершується пільговий період',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Завтра, <strong>{gracePeriodEndsAt}</strong>, завершується пільговий період у вашій підписці на <strong>Річну програму інституту UIMP</strong>.</p>
    <p>Якщо плануєте продовжити навчання — оплату на наступний місяць зручно оформити сьогодні:</p>
${CTA_BUTTON('Оплатити зараз')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'cyclical-failed-1': {
    key: 'cyclical-failed-1',
    group: 'cyclical',
    title: '⚠ Старт пільгового періоду · день +1 (autopay)',
    when: 'Шлемо коли WFP не зміг автоматично списати оплату — на наступний день після експайру. Спрацьовує завжди при failed charge.',
    placeholders: ['name', 'gracePeriodEndsAt', 'graceDays', 'graceDaysWord'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026', graceDays: '7', graceDaysWord: 'днів' },
    defaultSubject: 'Автосписання не пройшло — є кілька варіантів',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Сьогодні WayForPay спробував автоматично списати оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>, але списання не пройшло. Це могло статись з кількох причин — наприклад, тимчасова затримка банку, недостатньо коштів або термін дії картки.</p>
    <p>Доступ зберігається ще на <strong>{graceDays} {graceDaysWord}</strong> — до <strong>{gracePeriodEndsAt}</strong>.</p>
    <p style="margin-top: 18px;"><strong>Як завершити оплату:</strong></p>
    <ol style="margin: 8px 0 16px 0; padding-left: 20px; line-height: 1.7;">
      <li><strong>Поповнити рахунок</strong> або оновити картку — WayForPay автоматично спробує списати ще раз протягом {graceDays} {graceDaysWord}.</li>
      <li><strong>Або оплатити вручну</strong> за кнопкою нижче. На сторінці оберіть варіант <strong style="color:#1C3A2E;">«Місячна — РАЗОВА»</strong> (а не АВТОПЛАТІЖ) — щоб з картки не списали двічі.</li>
    </ol>
${CTA_BUTTON('Оплатити вручну (РАЗОВА)')}
    <p style="font-size: 13px; color: #6b7280;">Якщо хочете, щоб автосписання продовжило працювати в наступних місяцях — нічого більше робити не треба, просто поповніть картку. Якщо зручніше платити вручну — оберіть РАЗОВА, і автосписання вимкнеться.</p>
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'cyclical-grace-mid': {
    key: 'cyclical-grace-mid',
    group: 'cyclical',
    title: '📍 Середина пільгового періоду (autopay)',
    when: 'Шлемо приблизно посередині grace-періоду — нагадуємо що автосписання все ще не відбулось. Спрацьовує тільки якщо тривалість grace ≥ 5 днів.',
    placeholders: ['name', 'gracePeriodEndsAt', 'daysLeft', 'daysWord'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026', daysLeft: '4', daysWord: 'дні' },
    minGraceDays: 5,
    defaultSubject: 'Пільговий період — залишилось {daysLeft} {daysWord}',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Автосписання за наступний місяць у <strong>Річній програмі інституту UIMP</strong> досі не пройшло — WayForPay робив кілька спроб, але без успіху.</p>
    <p>До завершення пільгового періоду залишилось <strong>{daysLeft} {daysWord}</strong> — до <strong>{gracePeriodEndsAt}</strong>.</p>
    <p style="margin-top: 18px;"><strong>Як завершити оплату:</strong></p>
    <ol style="margin: 8px 0 16px 0; padding-left: 20px; line-height: 1.7;">
      <li>Натисніть кнопку нижче.</li>
      <li>На сторінці оберіть варіант <strong style="color:#1C3A2E;">«Місячна — РАЗОВА»</strong> (а не АВТОПЛАТІЖ) — щоб з картки не списали двічі.</li>
      <li>Завершіть оплату.</li>
    </ol>
${CTA_BUTTON('Оплатити вручну (РАЗОВА)')}
    <p style="font-size: 13px; color: #6b7280;">Або поповніть картку — WayForPay може автоматично повторити списання у залишені дні.</p>
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'cyclical-grace-last': {
    key: 'cyclical-grace-last',
    group: 'cyclical',
    title: '🚨 За 1 день до закриття (autopay)',
    when: 'Шлемо за день до закриття доступу. Спрацьовує тільки якщо тривалість grace ≥ 3 днів — інакше дублює start.',
    placeholders: ['name', 'gracePeriodEndsAt'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026' },
    minGraceDays: 3,
    defaultSubject: 'Завтра завершується пільговий період',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Завтра, <strong>{gracePeriodEndsAt}</strong>, завершується пільговий період у вашій підписці на <strong>Річну програму інституту UIMP</strong>.</p>
    <p>Якщо плануєте продовжити навчання — поповніть картку (WayForPay спробує списати автоматично) або оплатіть вручну:</p>
${CTA_BUTTON('Оплатити вручну (РАЗОВА)')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },

  'closed': {
    key: 'closed',
    group: 'shared',
    title: '🔒 Закриття доступу',
    when: 'Шлемо коли закриваємо доступ — спільно для manual і cyclical (після завершення пільгового періоду grace без оплати).',
    placeholders: ['name'],
    sampleData: { name: 'Іван Петренко' },
    defaultSubject: 'Доступ до Річної програми тимчасово призупинено',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Пільговий період у вашій підписці на <strong>Річну програму інституту UIMP</strong> завершився, тому доступ до курсу наразі призупинено.</p>
    <p>Підписку можна відновити в будь-який момент — оформіть нову оплату на сайті:</p>
${CTA_BUTTON('Відновити підписку')}
${SUPPORT_FOOTER}
${SIGNATURE_RESPECT}`),
  },
};

/// Префіксуємо у DB ключі щоб не плутатись з paymentTemplates (welcome, receipt-* тощо).
const DB_PREFIX = 'reminder.';
const dbKeyOf = (key: ReminderTemplateKey) => `${DB_PREFIX}${key}`;

/// Тягне шаблон з БД, fallback на дефолт із registry. Аналогічно `getPaymentTemplate`.
export async function getReminderTemplate(
  key: ReminderTemplateKey,
): Promise<{ subject: string; bodyHtml: string; isCustomized: boolean }> {
  const meta = REMINDER_TEMPLATES[key];
  if (!meta) {
    throw new Error(`Unknown reminder template key: ${key}`);
  }
  const row = await prisma.emailTemplate.findUnique({ where: { templateKey: dbKeyOf(key) } });
  if (row) {
    return { subject: row.subject, bodyHtml: row.bodyHtml, isCustomized: true };
  }
  return { subject: meta.defaultSubject, bodyHtml: meta.defaultBodyHtml, isCustomized: false };
}

/// Рендерить subject+html обраного шаблону з підставленими placeholder-ами.
/// Спрощує життя cron-у — одна функція замість 6.
export async function renderReminder(
  key: ReminderTemplateKey,
  vars: Record<string, string | null | undefined>,
): Promise<{ subject: string; html: string }> {
  const tpl = await getReminderTemplate(key);
  return {
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
  };
}

/// Helpers для зведення raw-args (Date, name|null) до string-vars для placeholder-substitution.

export function nameOfVar(name: string | null): string {
  return name && name.trim().length > 0 ? name.trim() : 'друже';
}

export function dateOfVar(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-');
  return `${day}.${m}.${y}`;
}

/// Українська множина: 1 день, 2-4 дні, 5-20 днів, 21 день, 22-24 дні, …
export function daysWordVar(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'днів';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дні';
  return 'днів';
}

/// Опис кожного відомого reminder-плейсхолдера — для довідника у редакторі і попереджень при видаленні.
export const REMINDER_PLACEHOLDER_DESCRIPTIONS: Record<string, { what: string; consequence: string }> = {
  name: {
    what: 'Імʼя отримувача (з форми оплати) — наприклад «Іван Петренко». Якщо імʼя пусте, підставиться «друже».',
    consequence: 'БЕЗ цього поля привітання буде безособовим — отримувач не побачить свого імені.',
  },
  expiresAt: {
    what: 'Дата закінчення оплаченого місяця у форматі «ДД.ММ.РРРР» — наприклад «15.08.2026».',
    consequence: 'БЕЗ цього поля отримувач не зрозуміє коли саме закінчується доступ.',
  },
  gracePeriodEndsAt: {
    what: 'Дата, до якої триває пільговий період grace (рахується від дати закінчення місяця + кількість днів grace із налаштувань) — наприклад «22.08.2026».',
    consequence: 'БЕЗ цього поля отримувач не побачить дедлайн, до якого треба оплатити.',
  },
  graceDays: {
    what: 'Кількість днів пільгового періоду grace із налаштувань програми — наприклад «7». При зміні значення в адмінці автоматично оновлюється у всіх листах, де використовується цей плейсхолдер.',
    consequence: 'БЕЗ цього поля у листі не буде явно вказано, скільки днів додатково триває доступ.',
  },
  graceDaysWord: {
    what: 'Українська форма множини для graceDays — «день» / «дні» / «днів» залежно від числа. Використовується разом з {graceDays}: «{graceDays} {graceDaysWord}» → «5 днів» / «1 день» / «3 дні».',
    consequence: 'БЕЗ цього поля у листі буде неузгодженість роду — «5 день» замість «5 днів».',
  },
  daysLeft: {
    what: 'Скільки днів лишилось до закриття доступу — наприклад «4».',
    consequence: 'БЕЗ цього поля у листі не буде кількості днів, що лишились.',
  },
  daysWord: {
    what: 'Українська форма слова «день» залежно від кількості: 1 день, 2 дні, 5 днів. Йде разом з {daysLeft}.',
    consequence: 'БЕЗ цього поля числівник буде у неправильній граматичній формі (наприклад «4 день» замість «4 дні»).',
  },
};
