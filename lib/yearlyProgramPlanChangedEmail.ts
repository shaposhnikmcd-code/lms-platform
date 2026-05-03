import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// Лист "ваш план змінено" для Річної програми. Шлемо коли користувач переключається
/// між MONTHLY-разова ↔ MONTHLY-автоплатіж (через нову оплату). Викликається з callback-у
/// після успішного флипу платежу, якщо в межах поточної транзакції відбулась зміна
/// `autoRenew` (детектиться по subscription events).
///
/// Текст зберігається у `EmailTemplate` (key='plan-changed-upgrade' / 'plan-changed-downgrade').

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
  const expiresLine = expiresAt
    ? `<p style="margin: 0 0 16px;"><b>Доступ діє до:</b> ${esc(expiresAt.toISOString().slice(0, 10))}</p>`
    : '';

  const tpl = await getPaymentTemplate(direction === 'upgrade' ? 'plan-changed-upgrade' : 'plan-changed-downgrade');
  const vars = { greeting, expiresLine };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
