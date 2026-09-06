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
  /// Для autopay — абсолютний номер МОДУЛЯ набору, який покрив цей платіж, і скільки
  /// модулів усього («модуль 3 з 9»). Для разової оплати — null (там немає графіку).
  chargeProgress: { current: number; total: number } | null;
  /// Дата наступного автосписання = перший день наступного модуля. null, якщо списань
  /// більше не буде (усі свої модулі сплачені) — тоді фраза в листі йде без дати.
  nextChargeAt?: Date | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, amount, autoRenew, newExpiresAt, chargeProgress, nextChargeAt } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const progressLine = chargeProgress
    ? `<p style="margin: 0 0 16px; color: #555;">Оплачено модуль ${chargeProgress.current} з ${chargeProgress.total}.</p>`
    : '';
  // UTC-форматування — уся математика дат Річної живе в UTC, тож дата в листі збігається
  // з датою у графіку WFP і в адмінці.
  // Тире вже є в тексті шаблону («…автоматично{nextChargeDate} — у перший день…»),
  // тут лише пробіл + дата, інакше в листі виходило два тире підряд.
  const nextChargeDate = nextChargeAt
    ? ` ${String(nextChargeAt.getUTCDate()).padStart(2, '0')}.${String(nextChargeAt.getUTCMonth() + 1).padStart(2, '0')}.${nextChargeAt.getUTCFullYear()}`
    : '';

  const tpl = await getPaymentTemplate(autoRenew ? 'receipt-autopay' : 'receipt-one-time');
  const vars = {
    greeting,
    amount: esc(String(amount)),
    expiresAt: esc(newExpiresAt.toISOString().slice(0, 10)),
    progressLine,
    nextChargeDate: esc(nextChargeDate),
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
