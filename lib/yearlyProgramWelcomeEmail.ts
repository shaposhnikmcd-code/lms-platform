import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// Generic welcome lett для Річної програми. Шлемо одразу після першої оплати
/// (`wasFirstPayment=true` у callback-у). НЕ містить логіну/пароля — креденшилз
/// студент отримає окремим листом, коли менеджер запустить програму
/// (масова розсилка через `executeLaunchLoop`) або через extra-launch для
/// пізніх приєднанців. SendPulse event на cohort-flow-у НЕ викликається при оплаті.
///
/// Текст шаблону зберігається у `EmailTemplate` (key='welcome'). Менеджер може
/// редагувати у адмінці. Дефолти — `lib/emailTemplates/paymentTemplates.ts`.

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
  const autoRenewBullet = autoRenew
    ? '<li style="margin-bottom: 8px;">Наступний платіж за вашим місячним планом пройде автоматично.</li>'
    : '';

  const tpl = await getPaymentTemplate('welcome');
  const vars = { greeting, plan: esc(planText), autoRenewBullet };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
