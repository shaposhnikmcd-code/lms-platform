import prisma from '@/lib/prisma';
import { renderTemplate } from './paymentTemplates';

/// Реєстр email-нагадувань Річної програми. Те саме DB-pattern що й paymentTemplates:
/// дефолти живуть у коді, custom subject/bodyHtml зберігається у `EmailTemplate` з префіксом
/// `reminder.<key>` щоб не плутатись з payment-шаблонами.
///
/// 6 шаблонів:
///   manual-before, manual-on-expiry, manual-grace-start (manual flow)
///   cyclical-failed-1, cyclical-failed-3 (autopay flow тільки при failure)
///   closed (спільний фінал manual+cyclical при закритті доступу)

export type ReminderTemplateKey =
  | 'manual-before'
  | 'manual-on-expiry'
  | 'manual-grace-start'
  | 'cyclical-failed-1'
  | 'cyclical-failed-3'
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

const SIGNATURE = `    <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>`;
const SIGNATURE_RESPECT = `    <p style="margin-top: 32px;">З повагою,<br/>Команда UIMP</p>`;

export const REMINDER_TEMPLATES: Record<ReminderTemplateKey, ReminderTemplateMeta> = {
  'manual-before': {
    key: 'manual-before',
    group: 'manual',
    title: '📅 За 3 дні до дати закінчення',
    when: 'Шлемо за 3 дні до того, як закінчиться оплачений місяць (manual flow). Нагадуємо оформити оплату на наступний місяць.',
    placeholders: ['name', 'expiresAt'],
    sampleData: { name: 'Іван Петренко', expiresAt: '15.08.2026' },
    defaultSubject: 'Через 3 дні закінчується ваш місяць у Річній програмі інституту UIMP',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong> закінчується <strong>{expiresAt}</strong>.</p>
    <p>Щоб не перервати навчання — оформіть оплату на наступний місяць заздалегідь:</p>
${CTA_BUTTON('Оплатити наступний місяць')}
${SUPPORT_FOOTER}
${SIGNATURE}`),
  },

  'manual-on-expiry': {
    key: 'manual-on-expiry',
    group: 'manual',
    title: '📆 У дату закінчення',
    when: 'Шлемо у день, коли закінчується оплачений місяць (manual flow). Сьогодні останній день — час оплатити.',
    placeholders: ['name'],
    sampleData: { name: 'Іван Петренко' },
    defaultSubject: 'Сьогодні останній день вашого місяця у Річній програмі інституту UIMP',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Сьогодні — <strong>останній день</strong> вашого оплаченого місяця у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>Щоб продовжити навчання без перерви — оформіть платіж на наступний місяць сьогодні:</p>
${CTA_BUTTON('Оплатити зараз')}
${SUPPORT_FOOTER}
${SIGNATURE}`),
  },

  'manual-grace-start': {
    key: 'manual-grace-start',
    group: 'manual',
    title: '🛟 Наступний день після дати закінчення',
    when: 'Шлемо коли оплачений місяць щойно закінчився, а доступ продовжено на 7 днів grace (manual flow). Встигнути оплатити.',
    placeholders: ['name', 'gracePeriodEndsAt'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026' },
    defaultSubject: 'Доступ продовжено на 7 днів — оплатіть наступний місяць',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong> вчора закінчився, але ми <strong>залишили вам доступ ще на 7 днів</strong>, щоб ви встигли оформити наступну оплату.</p>
    <p>Доступ буде закрито <strong>{gracePeriodEndsAt}</strong>, якщо до цього часу не надійде оплата.</p>
${CTA_BUTTON('Оплатити наступний місяць')}
${SUPPORT_FOOTER}
${SIGNATURE}`),
  },

  'cyclical-failed-1': {
    key: 'cyclical-failed-1',
    group: 'cyclical',
    title: '⚠ 1-й день після дати закінчення (autopay)',
    when: 'Шлемо коли WFP не зміг автоматично списати оплату — на наступний день після експайру. Перевірте картку.',
    placeholders: ['name', 'gracePeriodEndsAt'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026' },
    defaultSubject: 'Не вдалось списати оплату — перевірте картку',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>На жаль, нам не вдалось автоматично списати оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>Можливі причини: недостатньо коштів, картку заблоковано, або вона прострочена.</p>
    <p>Ми залишили вам доступ ще на <strong>7 днів</strong> — до <strong>{gracePeriodEndsAt}</strong>.</p>
    <p style="margin-top: 18px;"><strong>Що робити:</strong></p>
    <ol style="margin: 8px 0 16px 0; padding-left: 20px; line-height: 1.7;">
      <li><strong>Поповніть рахунок</strong> або переконайтеся що картка діюча — WayForPay автоматично спробує списати ще раз протягом 7 днів.</li>
      <li><strong>Або оплатіть вручну</strong> за кнопкою нижче. На сторінці оплати оберіть варіант <strong style="color:#1C3A2E;">«Місячна — РАЗОВА»</strong> (а не АВТОПЛАТІЖ) — інакше може статися подвійне списання.</li>
    </ol>
${CTA_BUTTON('Оплатити вручну (РАЗОВА)')}
    <p style="font-size: 13px; color: #6b7280;">Якщо хочете щоб автосписання продовжило працювати в наступних місяцях — нічого не робіть, просто поповніть картку. Якщо ж хочете далі платити вручну — після кнопки оберіть РАЗОВА і автосписання вимкнеться.</p>
${SUPPORT_FOOTER}
${SIGNATURE}`),
  },

  'cyclical-failed-3': {
    key: 'cyclical-failed-3',
    group: 'cyclical',
    title: '⏳ 3-й день після дати закінчення (autopay)',
    when: 'Шлемо через 3 дні після того, як WFP не зміг списати — лишилось 4 дні до закриття.',
    placeholders: ['name', 'gracePeriodEndsAt', 'daysLeft', 'daysWord'],
    sampleData: { name: 'Іван Петренко', gracePeriodEndsAt: '22.08.2026', daysLeft: '4', daysWord: 'дні' },
    defaultSubject: 'Залишилось {daysLeft} {daysWord} до закриття доступу',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>Минуло 3 дні з моменту, коли не вдалось списати оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>До <strong>{gracePeriodEndsAt}</strong> залишилось <strong>{daysLeft} {daysWord}</strong>. Якщо до цього часу оплата не надійде — доступ буде закрито.</p>
    <p style="margin-top: 18px;"><strong>Як оплатити вручну:</strong></p>
    <ol style="margin: 8px 0 16px 0; padding-left: 20px; line-height: 1.7;">
      <li>Натисніть кнопку нижче.</li>
      <li>На сторінці оплати оберіть варіант <strong style="color:#1C3A2E;">«Місячна — РАЗОВА»</strong> (а не АВТОПЛАТІЖ) — це гарантує що з вас не спишуть двічі.</li>
      <li>Завершіть оплату.</li>
    </ol>
${CTA_BUTTON('Оплатити вручну (РАЗОВА)')}
    <p style="font-size: 13px; color: #6b7280;">Альтернатива: поповніть картку — WayForPay може автоматично повторити списання у залишені дні.</p>
${SUPPORT_FOOTER}
${SIGNATURE}`),
  },

  'closed': {
    key: 'closed',
    group: 'shared',
    title: '🔒 Закриття доступу',
    when: 'Шлемо коли закриваємо доступ — спільно для manual і cyclical (через 7 днів grace без оплати).',
    placeholders: ['name'],
    sampleData: { name: 'Іван Петренко' },
    defaultSubject: 'Доступ до Річної програми інституту UIMP закрито',
    defaultBodyHtml: wrapReminderInner(`    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, {name}!</h2>
    <p>На жаль, ми не отримали оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>, тому доступ до курсу закрито.</p>
    <p>Ви можете відновити підписку в будь-який момент — просто оформіть нову оплату на сайті:</p>
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
    what: 'Дата, до якої триває пільговий період (7 днів grace) — наприклад «22.08.2026».',
    consequence: 'БЕЗ цього поля отримувач не побачить дедлайн, до якого треба оплатити.',
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
