/// HTML-шаблон листа з сертифікатом. Inline CSS (як у passwordReset) щоб не різали поштовики.

import { esc } from '../mailer';

export interface CertificateEmailArgs {
  recipientName: string;
  recipientEmail: string;
  type: 'COURSE' | 'YEARLY_PROGRAM';
  category?: 'LISTENER' | 'PRACTICAL';
  courseName?: string;
  certNumber: string;
  verificationUrl: string;
  issueYear: number;
}

export function certificateEmailSubject(args: CertificateEmailArgs): string {
  if (args.type === 'COURSE') {
    return `Ваш сертифікат UIMP — ${args.courseName ?? 'курс'}`;
  }
  return 'Ваш сертифікат UIMP — Річна програма';
}

export function certificateEmailHtml(args: CertificateEmailArgs): string {
  const name = args.recipientName?.trim() || args.recipientEmail;

  const achievement =
    args.type === 'COURSE'
      ? `ви успішно завершили курс <strong>${esc(args.courseName ?? '')}</strong> в Українському інституті душеопіки та психотерапії.`
      : args.category === 'LISTENER'
        ? 'ви успішно завершили Річну програму в Українському інституті душеопіки та психотерапії у категорії <strong>Слухач</strong>.'
        : 'ви успішно завершили Річну програму практичного навчання в Українському інституті душеопіки та психотерапії.';

  const typeLabel = args.type === 'COURSE' ? 'Сертифікат про завершення курсу' : 'Сертифікат Річної програми';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <div style="text-align: center; padding: 28px 20px 18px;">
        <div style="display: inline-block; padding: 10px 20px; border: 1px solid rgba(212,160,23,0.35); border-radius: 999px; background: linear-gradient(135deg, rgba(28,58,46,0.03), rgba(212,160,23,0.05));">
          <span style="font-size: 11px; font-weight: 600; letter-spacing: 0.22em; color: #A67522; text-transform: uppercase;">UIMP · ${esc(typeLabel)}</span>
        </div>
      </div>

      <h2 style="color: #1C3A2E; font-size: 24px; margin: 8px 0 20px; text-align: center; font-weight: 600; letter-spacing: -0.01em;">
        Вітаємо, ${esc(name)}!
      </h2>

      <p style="font-size: 15px; line-height: 1.65; margin: 0 0 20px; text-align: center; color: #374151;">
        ${achievement}
      </p>

      <div style="margin: 28px 0; padding: 20px 24px; background: linear-gradient(135deg, #fafaf7 0%, #f5f0e4 100%); border: 1px solid rgba(212,160,23,0.18); border-radius: 14px;">
        <div style="font-size: 12px; color: #6b7280; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Номер сертифіката</div>
        <div style="font-size: 15px; color: #1C3A2E; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 0.04em;">${esc(args.certNumber)}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 12px;">Рік видачі: <strong style="color: #1C3A2E;">${args.issueYear}</strong></div>
      </div>

      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 18px; text-align: center; color: #4b5563;">
        Оригінал сертифіката у форматі PDF додано до цього листа.<br>
        Справжність можна перевірити онлайн за посиланням нижче.
      </p>

      <p style="margin: 28px 0 24px; text-align: center;">
        <a href="${args.verificationUrl}"
           style="display: inline-block; background: linear-gradient(135deg, #D4A017 0%, #B88B3C 100%); color: #fff; padding: 14px 34px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 6px 20px -8px rgba(212,160,23,0.6);">
          Переглянути онлайн
        </a>
      </p>

      <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin: 20px 0 12px; text-align: center;">
        Ми щиро раді, що ви обрали UIMP для свого професійного розвитку. Бажаємо подальших успіхів на обраному шляху.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 18px;" />
      <p style="font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.55;">
        Український інститут Душеопіки та Психотерапії (UIMP) · uimp.com.ua<br>
        Цей лист надіслано автоматично. Якщо у вас є питання — напишіть на edu@uimp.com.ua
      </p>
    </div>
  `;
}
