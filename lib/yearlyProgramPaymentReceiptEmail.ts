import { sendEmail, esc } from '@/lib/mailer';

/// Receipt-лист на кожне successful списання MONTHLY-плану — і автоматичні списання
/// (autoRenew=true), і ручні повторні разові оплати (autoRenew=false). Викликається
/// з callback-у, коли flipResult.wasFirstPayment=false і нема plan-change маркера.
/// Для YEARLY не використовується (там лише 1 платіж = welcome lett).

export async function sendYearlyProgramPaymentReceiptEmail(args: {
  to: string;
  name: string | null;
  amount: number;
  autoRenew: boolean;
  /// Дата, до якої тепер відкритий доступ (після цього успішного списання).
  newExpiresAt: Date;
  /// Для autopay — порядковий номер цього списання у плані cohort-у та загальна кількість.
  /// Для разової оплати — null (там немає графіку).
  chargeProgress: { current: number; total: number } | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, amount, autoRenew, newExpiresAt, chargeProgress } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const planLabel = autoRenew ? 'Місячний план з автосписанням' : 'Місячна оплата (одноразова)';
  const subject = autoRenew
    ? `Автосписання по Річній програмі — ${amount} ₴`
    : `Оплата по Річній програмі — ${amount} ₴`;

  const expiresLine = `<p style="margin: 0 0 8px;"><b>Доступ продовжено до:</b> ${esc(newExpiresAt.toISOString().slice(0, 10))}</p>`;
  const progressLine = chargeProgress
    ? `<p style="margin: 0 0 16px; color: #555;">Списання ${chargeProgress.current} з ${chargeProgress.total}.</p>`
    : '';

  const autopayNote = autoRenew
    ? `<li style="margin-bottom: 8px;">Наступне списання пройде автоматично через місяць.</li>
       <li style="margin-bottom: 8px;">Скасувати автосписання можна у будь-який момент — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>`
    : `<li style="margin-bottom: 8px;">Щоб продовжити навчання наступного місяця — оформте нову оплату на сайті.</li>`;

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Дякуємо за оплату</h2>
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 16px;">Платіж по Річній програмі Українського інституту Душеопіки та Психотерапії (UIMP) успішно проведено.</p>
  <p style="margin: 0 0 8px;"><b>Сума:</b> ${esc(String(amount))} ₴</p>
  <p style="margin: 0 0 8px;"><b>План:</b> ${esc(planLabel)}</p>
  ${expiresLine}
  ${progressLine}
  <h3 style="margin: 24px 0 8px;">Що далі</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    ${autopayNote}
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
