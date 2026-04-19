/// Шле всі варіанти листів Річної програми на вказаний email через Resend.
/// Використання: node --env-file=.env.local scripts/sendYearlyEmails.mjs <email>
/// Шаблони продубльовано з lib/emailTemplates/yearlyProgram.ts (.mjs не може імпортувати .ts).

import { Resend } from 'resend';

const recipient = process.argv[2];
if (!recipient || !recipient.includes('@')) {
  console.error('❌ Передай email першим аргументом, наприклад:');
  console.error('   node --env-file=.env.local scripts/sendYearlyEmails.mjs you@example.com');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY не знайдений у env. Запусти з --env-file=.env.local');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'UIMP <onboarding@resend.dev>';
const SAMPLE_NAME = 'Ольга';
const PROGRAM_URL = 'https://www.uimp.com.ua/yearly-program';
const SUPPORT_TG = 'https://t.me/uimp_support';

const FRAME = (body) => `
<!DOCTYPE html>
<html lang="uk"><head><meta charset="utf-8"><title>UIMP Email</title></head>
<body style="margin:0;padding:24px;background:#f6f3ee;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background:#fff; border-radius:12px; padding:32px; color:#1c1917; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    ${body}
  </div>
</body></html>`;

const SUPPORT_FOOTER = `
  <p>Якщо у вас є питання — напишіть у відповідь на цей лист або до <a href="${SUPPORT_TG}" style="color:#1C3A2E; font-weight:600; text-decoration:underline;">Тех. підтримки в Telegram</a>.</p>
`;

const CTA_BUTTON = (label) => `
  <p style="text-align:center; margin: 28px 0;">
    <a href="${PROGRAM_URL}" style="display:inline-block; background:#D4A017; color:#fff; font-weight:bold; padding:12px 28px; border-radius:10px; text-decoration:none;">${label}</a>
  </p>
`;

function reminder(daysBefore, kind) {
  const expires = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000);
  const dateStr = expires.toISOString().slice(0, 10);
  const subjectPrefix = daysBefore === 1 ? 'Завтра' : `Через ${daysBefore} дні`;
  const subject = `[ТЕСТ ${kind}] ${subjectPrefix} закінчується ваша підписка на Річну програму`;
  const body = kind === 'manual'
    ? `
      <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${SAMPLE_NAME}!</h2>
      <p>Нагадую, що ваша підписка на <strong>Річну програму</strong> закінчується <strong>${dateStr}</strong>.</p>
      <p>Щоб продовжити навчання — оформіть оплату на наступний місяць на сайті:</p>
      ${CTA_BUTTON('Оплатити наступний місяць')}
      <p>Якщо оплата не надійде протягом 7 днів після дати завершення — доступ до курсу буде закрито.</p>
      ${SUPPORT_FOOTER}
      <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
    `
    : `
      <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${SAMPLE_NAME}!</h2>
      <p>Нагадую, що ваша підписка на <strong>Річну програму</strong> закінчується <strong>${dateStr}</strong>.</p>
      <p>Щоб не втратити доступ до навчання — переконайтеся, що на картці є достатньо коштів для автоматичного списання. Якщо списання не відбудеться протягом 7 днів після дати завершення — доступ до курсу буде закрито.</p>
      ${SUPPORT_FOOTER}
      <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
    `;
  return { subject, html: FRAME(body) };
}

function expired() {
  const html = FRAME(`
    <h2 style="color: #1C3A2E; margin-top: 0;">Вітаю, ${SAMPLE_NAME}!</h2>
    <p>На жаль, ми не отримали оплату за чергову підписку на <strong>Річну програму</strong>, тому доступ до курсу тимчасово закрито.</p>
    <p>Ви можете відновити підписку в будь-який момент — просто оформіть нову оплату на сайті:</p>
    ${CTA_BUTTON('Відновити підписку')}
    ${SUPPORT_FOOTER}
    <p style="margin-top: 32px;">З повагою,<br/>Команда UIMP</p>
  `);
  return { subject: '[ТЕСТ] Доступ до Річної програми закрито', html };
}

const emails = [
  { label: '3д · cyclical', ...reminder(3, 'cyclical') },
  { label: '3д · manual',   ...reminder(3, 'manual') },
  { label: '1д · cyclical', ...reminder(1, 'cyclical') },
  { label: '1д · manual',   ...reminder(1, 'manual') },
  { label: 'expired',       ...expired() },
];

console.log(`📧 Шлю ${emails.length} тестові листи на ${recipient}…\n`);
for (const e of emails) {
  try {
    const res = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: e.subject,
      html: e.html,
    });
    if (res.error) {
      console.error(`  ✗ ${e.label}: ${res.error.message}`);
    } else {
      console.log(`  ✓ ${e.label} (id: ${res.data?.id ?? '—'})`);
    }
  } catch (err) {
    console.error(`  ✗ ${e.label}: ${err.message}`);
  }
}
console.log('\n✅ Готово. Перевір інбокс.');
