import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// Лист «ваш план тепер Річний» — шлеться, коли менеджер натиснув «Перевести на Річну»
/// у картці підписки (дія `convert_to_yearly`): місячний план стає YEARLY, автосписання
/// у WFP знято, доступ перерахований до кінця набору + пост-доступ.
///
/// Текст зберігається у `EmailTemplate` (key='plan-converted-yearly').
export async function sendYearlyProgramConvertedToYearlyEmail(args: {
  to: string;
  name: string | null;
  /// Сумарно сплачено по підписці (реальні гроші, без тест-оплат адмінів).
  totalPaid: number;
  /// Дата завершення доступу після переведення.
  expiresAt: Date | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, totalPaid, expiresAt } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const expiresLine = expiresAt
    ? `<p style="margin: 0 0 16px;"><b>Доступ діє до:</b> ${esc(expiresAt.toISOString().slice(0, 10))}</p>`
    : '';

  const tpl = await getPaymentTemplate('plan-converted-yearly');
  const vars = {
    greeting,
    totalPaid: totalPaid.toLocaleString('uk-UA'),
    expiresLine,
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
