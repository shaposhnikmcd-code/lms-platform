/// HTML-шаблони для листів password-reset. Стиль тримаємо простим та
/// inline-css (без зовнішніх CSS — багато поштовиків їх ріжуть).

import { esc } from '../mailer';

export interface InviteEmailArgs {
  userName: string | null;
  userEmail: string;
  roleLabel: string;
  setPasswordUrl: string;
  expiresAt: Date;
}

export function inviteEmailHtml(args: InviteEmailArgs): string {
  const name = args.userName?.trim() || args.userEmail;
  const expiresHuman = args.expiresAt.toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #1C3A2E; font-size: 22px; margin: 0 0 16px;">Вітаємо в UIMP!</h2>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Здрастуйте, ${esc(name)}.</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Для вас створено акаунт з роллю <strong>${esc(args.roleLabel)}</strong>.
        Щоб увійти, будь ласка, встановіть свій пароль за посиланням нижче.
      </p>
      <p style="margin: 24px 0;">
        <a href="${args.setPasswordUrl}"
           style="display: inline-block; background: #D4A017; color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Встановити пароль
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0 0 8px;">
        Посилання дійсне до <strong>${esc(expiresHuman)}</strong>.
      </p>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0 0 20px;">
        Якщо ви не очікували цього листа — просто проігноруйте його, акаунтом ніхто не зможе скористатись без вашого пароля.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9ca3af;">
        Український інститут Душеопіки та Психотерапії (UIMP) · uimp.com.ua
      </p>
    </div>
  `;
}

export interface ResetEmailArgs {
  userName: string | null;
  userEmail: string;
  resetUrl: string;
  expiresAt: Date;
}

export function resetEmailHtml(args: ResetEmailArgs): string {
  const name = args.userName?.trim() || args.userEmail;
  const expiresHuman = args.expiresAt.toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #1C3A2E; font-size: 22px; margin: 0 0 16px;">Скидання пароля</h2>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Здрастуйте, ${esc(name)}.</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Ви (або хтось, хто знає вашу пошту) запросили скидання пароля. Щоб створити новий пароль, перейдіть за посиланням:
      </p>
      <p style="margin: 24px 0;">
        <a href="${args.resetUrl}"
           style="display: inline-block; background: #D4A017; color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Створити новий пароль
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0 0 8px;">
        Посилання дійсне до <strong>${esc(expiresHuman)}</strong>.
      </p>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0 0 20px;">
        Якщо ви не запитували скидання — просто проігноруйте цей лист. Ваш поточний пароль залишиться без змін.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9ca3af;">
        Український інститут Душеопіки та Психотерапії (UIMP) · uimp.com.ua
      </p>
    </div>
  `;
}
