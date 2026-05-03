import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

/// Лист "доступ закрито менеджером" для Річної програми. Шлемо при ручних admin-actions,
/// які зупиняють автоплатіж і/або закривають доступ:
///   — Cancel (status → CANCELLED, autopay знято, доступ зберігається до expiresAt)
///   — Archive (status → ARCHIVED, незворотно, SP-доступ закрито)
///   — Close access (status → EXPIRED, SP-доступ закрито, можна відкрити знову)
///
/// Текст зберігається у `EmailTemplate` (key='admin-cancelled' / 'admin-archived' /
/// 'admin-access-closed').

export type AdminEndKind = 'cancelled' | 'archived' | 'access_closed';

const KIND_TO_KEY: Record<AdminEndKind, PaymentTemplateKey> = {
  cancelled: 'admin-cancelled',
  archived: 'admin-archived',
  access_closed: 'admin-access-closed',
};

export async function sendYearlyProgramAdminEndedEmail(args: {
  to: string;
  name: string | null;
  kind: AdminEndKind;
  /// Дата, до якої діє доступ (релевантно для cancel — там доступ продовжує діяти).
  /// Для archived/access_closed — null (доступ уже закрито).
  expiresAt: Date | null;
  /// Чи був autopay активний (для контексту в листі — щоб написати "автосписання вимкнено").
  hadAutoRenew: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, kind, expiresAt, hadAutoRenew } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  const autoRenewBullet = hadAutoRenew
    ? '<li style="margin-bottom: 8px;">Автосписання вимкнено — наступні платежі не будуть стягуватись.</li>'
    : '';
  const expiresLine = kind === 'cancelled' && expiresAt
    ? `<li style="margin-bottom: 8px;">Доступ до навчальної платформи зберігається до <b>${esc(expiresAt.toISOString().slice(0, 10))}</b>.</li>`
    : '';

  const tpl = await getPaymentTemplate(KIND_TO_KEY[kind]);
  const vars = { greeting, autoRenewBullet, expiresLine };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
