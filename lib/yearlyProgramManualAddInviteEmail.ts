import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// Лист-запрошення для студента, якого менеджер додав вручну через кнопку
/// «Додати студента» в адмінці Річної програми. Містить персональне invite-посилання
/// (signed token, 7 днів) — за ним студент сам обирає план і платить.
///
/// Текст шаблону зберігається у `EmailTemplate` (key='manual-add-invite').
/// Менеджер може редагувати у адмінці. Дефолти — `lib/emailTemplates/paymentTemplates.ts`.

export async function sendYearlyProgramManualAddInviteEmail(args: {
  to: string;
  name: string | null;
  inviteUrl: string;
  cohortName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, inviteUrl, cohortName } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const inviteButton = `<p style="margin: 24px 0;"><a href="${esc(inviteUrl)}" style="display: inline-block; background: #b08d3f; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Перейти до оплати</a></p>`;

  const tpl = await getPaymentTemplate('manual-add-invite');
  const vars = {
    greeting,
    cohortName: esc(cohortName),
    inviteButton,
    inviteUrl: esc(inviteUrl),
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
