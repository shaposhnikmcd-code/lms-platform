import { sendEmail, esc } from '@/lib/mailer';

/// Лист "ваш план змінено" для Річної програми. Шлемо коли користувач переключається
/// між MONTHLY-разова ↔ MONTHLY-автоплатіж (через нову оплату). Викликається з callback-у
/// після успішного флипу платежу, якщо в межах поточної транзакції відбулась зміна
/// `autoRenew` (детектиться по subscription events).

export async function sendYearlyProgramPlanChangedEmail(args: {
  to: string;
  name: string | null;
  /// Напрямок зміни: upgrade = разова → автоплатіж, downgrade = автоплатіж → разова.
  direction: 'upgrade' | 'downgrade';
  /// Дата, до якої діє доступ (для контексту користувача).
  expiresAt: Date | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, direction, expiresAt } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const planLabel = direction === 'upgrade'
    ? 'Місячний план з автосписанням'
    : 'Місячна оплата (одноразова)';
  const subject = direction === 'upgrade'
    ? 'Ваш план змінено — автосписання ввімкнено'
    : 'Ваш план змінено — автосписання вимкнено';

  const expiresLine = expiresAt
    ? `<p style="margin: 0 0 16px;"><b>Доступ діє до:</b> ${esc(expiresAt.toISOString().slice(0, 10))}</p>`
    : '';

  const upgradeBullets = `
    <li style="margin-bottom: 8px;">Наступні платежі будуть стягуватись автоматично щомісяця з тієї ж картки.</li>
    <li style="margin-bottom: 8px;">Кожне успішне списання продовжує доступ ще на місяць.</li>
    <li style="margin-bottom: 8px;">Скасувати автосписання можна у будь-який момент — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>
  `;
  const downgradeBullets = `
    <li style="margin-bottom: 8px;">Автосписання вимкнено — наступні платежі не будуть стягуватись автоматично.</li>
    <li style="margin-bottom: 8px;">Поточний місяць доступу залишається активним до вказаної дати.</li>
    <li style="margin-bottom: 8px;">Щоб продовжити навчання — оформте нову оплату на сайті, або поверніться до автосписання.</li>
  `;

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Ваш план оновлено</h2>
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 16px;">Ваша підписка на Річну програму Українського інституту Душеопіки та Психотерапії (UIMP) успішно оновлена.</p>
  <p style="margin: 0 0 16px;"><b>Новий план:</b> ${esc(planLabel)}</p>
  ${expiresLine}
  <h3 style="margin: 24px 0 8px;">Що це означає</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    ${direction === 'upgrade' ? upgradeBullets : downgradeBullets}
  </ul>
  <p style="margin: 24px 0 0; color: #555;">Якщо є питання — пишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</p>
  <p style="margin: 16px 0 0; color: #555;">— Команда Українського інституту Душеопіки та Психотерапії (UIMP)</p>
</div>
`.trim();

  return sendEmail({
    to,
    subject,
    html,
    replyTo: 'edu@uimp.com.ua',
  });
}
