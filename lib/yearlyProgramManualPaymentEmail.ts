import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// Квитанція на РУЧНУ оплату Річної програми (готівка / переказ / напряму ФОП). Шлеться з
/// `handleManualPayment` після успішного запису платежу. При авто-розбивці великої суми на
/// кілька місячних платежів лист ОДИН — на всю внесену суму (`amount`), а не по одному на рядок.
///
/// Текст зберігається у `EmailTemplate` (key='manual-payment-received').
export async function sendYearlyProgramManualPaymentEmail(args: {
  to: string;
  name: string | null;
  /// Сума, яку менеджер щойно вніс (до розбивки).
  amount: number;
  /// Людський лейбл способу оплати («Готівка», «Переказ», …).
  methodLabel: string;
  /// Сумарно сплачено по підписці після цього платежу (реальні гроші, без тест-оплат).
  totalPaid: number;
  /// Скільки лишилось до повної вартості Річної. 0 або менше — рядок ховаємо.
  remaining: number;
  /// Дата завершення доступу після зарахування платежу.
  expiresAt: Date | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, amount, methodLabel, totalPaid, remaining, expiresAt } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const remainingLine = remaining > 0
    ? `<p style="margin: 0 0 16px;"><b>Залишок до повної вартості:</b> ${remaining.toLocaleString('uk-UA')} ₴</p>`
    : '';
  const expiresLine = expiresAt
    ? `<p style="margin: 0 0 16px;"><b>Доступ діє до:</b> ${esc(expiresAt.toISOString().slice(0, 10))}</p>`
    : '';

  const tpl = await getPaymentTemplate('manual-payment-received');
  const vars = {
    greeting,
    amount: amount.toLocaleString('uk-UA'),
    methodLabel: esc(methodLabel),
    totalPaid: totalPaid.toLocaleString('uk-UA'),
    remainingLine,
    expiresLine,
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
