import { sendEmail, esc } from '@/lib/mailer';

/// Лист "доступ закрито менеджером" для Річної програми. Шлемо при ручних admin-actions,
/// які зупиняють автоплатіж і/або закривають доступ:
///   — Cancel (status → CANCELLED, autopay знято, доступ зберігається до expiresAt)
///   — Archive (status → ARCHIVED, незворотно, SP-доступ закрито)
///   — Close access (status → EXPIRED, SP-доступ закрито, можна відкрити знову)
///
/// Для cron-EXPIRED (grace вийшов) і failed-charge — окремі лист-шаблони (accessClosed,
/// cyclicalChargeFailed*) у `lib/emailTemplates/yearlyProgram.ts`. Цей файл — про
/// людський адмін-екшен.

export type AdminEndKind = 'cancelled' | 'archived' | 'access_closed';

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

  let subject: string;
  let title: string;
  let intro: string;
  const bullets: string[] = [];

  if (kind === 'cancelled') {
    subject = 'Підписку на Річну програму скасовано';
    title = 'Підписку скасовано';
    intro = 'Вашу підписку на Річну програму Українського інституту Душеопіки та Психотерапії (UIMP) скасовано.';
    if (hadAutoRenew) {
      bullets.push('Автосписання вимкнено — наступні платежі не будуть стягуватись.');
    }
    if (expiresAt) {
      bullets.push(`Доступ до навчальної платформи зберігається до <b>${esc(expiresAt.toISOString().slice(0, 10))}</b>.`);
    }
    bullets.push('Якщо ви бажаєте продовжити навчання — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.');
  } else if (kind === 'access_closed') {
    subject = 'Доступ до Річної програми закрито';
    title = 'Доступ закрито';
    intro = 'Ваш доступ до Річної програми Українського інституту Душеопіки та Психотерапії (UIMP) закрито.';
    if (hadAutoRenew) {
      bullets.push('Автосписання вимкнено — наступні платежі не будуть стягуватись.');
    }
    bullets.push('Якщо це сталось помилково або ви бажаєте відновити доступ — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.');
  } else {
    subject = 'Доступ до Річної програми закрито';
    title = 'Доступ закрито';
    intro = 'Ваш доступ до Річної програми Українського інституту Душеопіки та Психотерапії (UIMP) закрито.';
    if (hadAutoRenew) {
      bullets.push('Автосписання вимкнено — наступні платежі не будуть стягуватись.');
    }
    bullets.push('Якщо це сталось помилково — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.');
  }

  const bulletsHtml = bullets
    .map((b) => `<li style="margin-bottom: 8px;">${b}</li>`)
    .join('\n    ');

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
  <h2 style="color: #1a1a1a; margin: 0 0 16px;">${esc(title)}</h2>
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 16px;">${esc(intro)}</p>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    ${bulletsHtml}
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
