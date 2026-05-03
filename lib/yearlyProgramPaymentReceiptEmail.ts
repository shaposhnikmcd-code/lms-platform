import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// Receipt-лист на кожне successful списання MONTHLY-плану — і автоматичні списання
/// (autoRenew=true), і ручні повторні разові оплати (autoRenew=false). Викликається
/// з callback-у, коли flipResult.wasFirstPayment=false і нема plan-change маркера.
/// Для YEARLY не використовується (там лише 1 платіж = welcome lett).
///
/// Текст зберігається у `EmailTemplate` (key='receipt-autopay' / 'receipt-one-time').

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
  const progressLine = chargeProgress
    ? `<p style="margin: 0 0 16px; color: #555;">Списання ${chargeProgress.current} з ${chargeProgress.total}.</p>`
    : '';

  const tpl = await getPaymentTemplate(autoRenew ? 'receipt-autopay' : 'receipt-one-time');
  const vars = {
    greeting,
    amount: esc(String(amount)),
    expiresAt: esc(newExpiresAt.toISOString().slice(0, 10)),
    progressLine,
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
