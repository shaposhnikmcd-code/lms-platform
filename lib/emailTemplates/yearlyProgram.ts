/// HTML-шаблони листів про Річну програму. Спільні для cron (фактична відправка)
/// і admin-preview (попередній перегляд у адмінці).
///
/// Логіка:
/// — MANUAL (клієнт платить сам, recToken=null): 4 листи — за 3 дні до експайру,
///   у день експайру, наступного дня (grace стартував), через 7 днів (закриття).
/// — CYCLICAL (автосписання, recToken=set): 3 листи лише якщо WFP не списав —
///   через 1, 3 дні після експайру, і фінальний на 7-й день (закриття).

const PROGRAM_URL = 'https://www.uimp.com.ua/yearly-program';
const SUPPORT_TG = 'https://t.me/uimp_support';

const FRAME = (body: string) => `
<!DOCTYPE html>
<html lang="uk"><head><meta charset="utf-8"><title>UIMP Email</title></head>
<body style="margin:0;padding:24px;background:#f6f3ee;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background:#fff; border-radius:12px; padding:32px; color:#1c1917; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    ${body}
  </div>
</body></html>`;

const SUPPORT_FOOTER = `
  <p>Якщо у вас є питання — напишіть у відповідь на цей лист або до <a href="${SUPPORT_TG}" style="color:#0088cc; font-weight:600; text-decoration:none; white-space:nowrap;">Тех. підтримки в Telegram</a></p>
`;

const CTA_BUTTON = (label: string) => `
  <p style="text-align:center; margin: 28px 0;">
    <a href="${PROGRAM_URL}" style="display:inline-block; background:#D4A017; color:#fff; font-weight:bold; padding:12px 28px; border-radius:10px; text-decoration:none;">${label}</a>
  </p>
`;

function nameOf(name: string | null): string {
  return name && name.trim().length > 0 ? name.trim() : 'друже';
}

function dateOf(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-');
  return `${day}.${m}.${y}`;
}

/// Українська множина: 1 день, 2-4 дні, 5-20 днів, 21 день, 22-24 дні, …
function daysWord(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'днів';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дні';
  return 'днів';
}

// ==================== MANUAL FLOW (клієнт платить сам) ====================

/// Manual #1: за 3 дні до закінчення оплаченого місяця.
export function manualBeforeExpiry(args: { name: string | null; expiresAt: Date }): { subject: string; html: string } {
  const subject = 'Через 3 дні закінчується ваш місяць у Річній програмі інституту UIMP';
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${nameOf(args.name)}!</h2>
    <p>Ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong> закінчується <strong>${dateOf(args.expiresAt)}</strong>.</p>
    <p>Щоб не перервати навчання — оформіть оплату на наступний місяць заздалегідь:</p>
    ${CTA_BUTTON('Оплатити наступний місяць')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
  `);
  return { subject, html };
}

/// Manual #2: у день закінчення оплаченого місяця.
export function manualOnExpiry(args: { name: string | null }): { subject: string; html: string } {
  const subject = 'Сьогодні останній день вашого місяця у Річній програмі інституту UIMP';
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${nameOf(args.name)}!</h2>
    <p>Сьогодні — <strong>останній день</strong> вашого оплаченого місяця у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>Щоб продовжити навчання без перерви — оформіть платіж на наступний місяць сьогодні:</p>
    ${CTA_BUTTON('Оплатити зараз')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
  `);
  return { subject, html };
}

/// Manual #3: наступний день після закінчення — пільгові 7 днів стартували.
export function manualGraceStart(args: { name: string | null; gracePeriodEndsAt: Date }): { subject: string; html: string } {
  const subject = 'Доступ продовжено на 7 днів — оплатіть наступний місяць';
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${nameOf(args.name)}!</h2>
    <p>Ваш оплачений місяць у <strong>Річній програмі інституту UIMP</strong> вчора закінчився, але ми <strong>залишили вам доступ ще на 7 днів</strong>, щоб ви встигли оформити наступну оплату.</p>
    <p>Доступ буде закрито <strong>${dateOf(args.gracePeriodEndsAt)}</strong>, якщо до цього часу не надійде оплата.</p>
    ${CTA_BUTTON('Оплатити наступний місяць')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
  `);
  return { subject, html };
}

// ==================== CYCLICAL FLOW (автосписання, тільки при помилці) ====================

/// Cyclical #1: через 1 день після експайру — WFP не зміг списати.
export function cyclicalChargeFailed1(args: { name: string | null; gracePeriodEndsAt: Date }): { subject: string; html: string } {
  const subject = 'Не вдалось списати оплату — перевірте картку';
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${nameOf(args.name)}!</h2>
    <p>На жаль, нам не вдалось автоматично списати оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>Можливі причини: недостатньо коштів, картку заблоковано, або вона прострочена.</p>
    <p>Ми залишили вам доступ ще на <strong>7 днів</strong> — до <strong>${dateOf(args.gracePeriodEndsAt)}</strong>. За цей час потрібно або поповнити рахунок, або оплатити вручну на сайті:</p>
    ${CTA_BUTTON('Оплатити вручну')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
  `);
  return { subject, html };
}

/// Cyclical #2: через 3 дні після експайру — все ще не списано.
export function cyclicalChargeFailed3(args: { name: string | null; gracePeriodEndsAt: Date }): { subject: string; html: string } {
  const daysLeft = Math.max(0, Math.ceil((args.gracePeriodEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const subject = `Залишилось ${daysLeft} ${daysWord(daysLeft)} до закриття доступу`;
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${nameOf(args.name)}!</h2>
    <p>Минуло 3 дні з моменту, коли не вдалось списати оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>.</p>
    <p>До <strong>${dateOf(args.gracePeriodEndsAt)}</strong> залишилось <strong>${daysLeft} ${daysWord(daysLeft)}</strong>. Якщо до цього часу оплата не надійде — доступ буде закрито.</p>
    <p>Поповніть рахунок на картці або оплатіть вручну:</p>
    ${CTA_BUTTON('Оплатити вручну')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
  `);
  return { subject, html };
}

// ==================== СПІЛЬНИЙ ФІНАЛ (закриття доступу) ====================

/// Закриття доступу — спільний для manual і cyclical.
export function accessClosed(args: { name: string | null }): { subject: string; html: string } {
  const subject = 'Доступ до Річної програми інституту UIMP закрито';
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${nameOf(args.name)}!</h2>
    <p>На жаль, ми не отримали оплату за наступний місяць у <strong>Річній програмі інституту UIMP</strong>, тому доступ до курсу закрито.</p>
    <p>Ви можете відновити підписку в будь-який момент — просто оформіть нову оплату на сайті:</p>
    ${CTA_BUTTON('Відновити підписку')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З повагою,<br/>Команда UIMP</p>
  `);
  return { subject, html };
}
