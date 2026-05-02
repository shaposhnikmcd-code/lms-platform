import { sendEmail, esc, appBaseUrl } from '@/lib/mailer';

/// Generic welcome lett для Річної програми. Шлемо одразу після першої оплати
/// (`wasFirstPayment=true` у callback-у). НЕ містить логіну/пароля — креденшилз
/// студент отримає окремим листом, коли менеджер запустить програму
/// (масова розсилка через `executeLaunchLoop`) або через extra-launch для
/// пізніх приєднанців. SendPulse event на cohort-flow-у НЕ викликається при оплаті.

export async function sendYearlyProgramWelcomeEmail(args: {
  to: string;
  name: string | null;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, plan, autoRenew } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const planText =
    plan === 'YEARLY'
      ? 'Річна оплата'
      : autoRenew
        ? 'Місячний план з автосписанням'
        : 'Місячна оплата (одноразова)';
  const dashboardUrl = `${appBaseUrl()}/dashboard`;

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Вітаємо на Річній програмі</h2>
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 16px;">Дякуємо за оплату — ваше місце на Річній програмі навчання Українського інституту Душеопіки та Психотерапії (UIMP) закріплене.</p>
  <p style="margin: 0 0 16px;"><b>Ваш план:</b> ${esc(planText)}</p>
  <h3 style="margin: 24px 0 8px;">Що далі</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Ми готуємо запуск програми. <b>Перед початком навчання</b> ви отримаєте окремий лист з вашими доступами до навчальної платформи (логін і пароль).</li>
    ${autoRenew ? '<li style="margin-bottom: 8px;">Наступний платіж за вашим місячним планом пройде автоматично.</li>' : ''}
    <li style="margin-bottom: 8px;">Деталі вашої підписки доступні в особистому кабінеті: <a href="${dashboardUrl}" style="color: #b08d3f;">${dashboardUrl}</a>.</li>
  </ul>
  <p style="margin: 24px 0 0; color: #555;">Якщо є питання — пишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</p>
  <p style="margin: 16px 0 0; color: #555;">— Команда Українського інституту Душеопіки та Психотерапії (UIMP)</p>
</div>
`.trim();

  return sendEmail({
    to,
    subject: 'Вітаємо на Річній програмі — Український інститут Душеопіки та Психотерапії',
    html,
    replyTo: 'edu@uimp.com.ua',
  });
}
