/// Централізована відправка листів через Resend. Зараз єдина точка виходу —
/// треба було б, щоб усі місця (contact form, password reset, invite, cron-нагадування)
/// йшли сюди і щоб ми могли легко поміняти провайдера чи додати From-домен.
///
/// Конвенція:
/// - Якщо `RESEND_API_KEY` не заданий (dev без .env) — лист НЕ шлеться,
///   а логується в консоль (разом з `devPreviewHint`, якщо є). Це дозволяє
///   тестувати password-reset локально без справжніх листів.
/// - `from` беремо з `RESEND_FROM_EMAIL`, fallback — sandbox-дефолт Resend.

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'UIMP <onboarding@resend.dev>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface EmailAttachment {
  filename: string;
  /// PDF/бінарний контент у вигляді Buffer або Uint8Array.
  content: Buffer | Uint8Array;
  contentType?: string;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  /// Якщо в dev нема RESEND_API_KEY — цей рядок йде в консоль (наприклад, сам reset-link).
  devPreviewHint?: string;
  attachments?: EmailAttachment[];
  /// Опційний reply-to (для листів, на які юзер може відповісти — напр. сертифікат → edu@).
  replyTo?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const { to, subject, html, devPreviewHint, attachments, replyTo } = args;

  if (!resend) {
    console.warn('📧 [mailer] RESEND_API_KEY не заданий — лист НЕ відправлено.');
    console.warn('📧 [mailer] to:', to, '| subject:', subject);
    if (attachments?.length) {
      console.warn('📧 [mailer] attachments:', attachments.map((a) => `${a.filename} (${a.content.byteLength}B)`).join(', '));
    }
    if (devPreviewHint) console.warn('📧 [mailer] preview:', devPreviewHint);
    return { ok: true };
  }

  try {
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: FROM_EMAIL,
      to,
      subject,
      html,
    };
    if (replyTo) (payload as { replyTo?: string }).replyTo = replyTo;
    if (attachments?.length) {
      (payload as { attachments?: Array<{ filename: string; content: Buffer; contentType?: string }> }).attachments =
        attachments.map((a) => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
          contentType: a.contentType,
        }));
    }
    const result = await resend.emails.send(payload);
    if (result.error) {
      console.error('❌ [mailer] Resend error:', result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, messageId: result.data?.id };
  } catch (error) {
    console.error('❌ [mailer] send failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/// Escape HTML для безпечного вставляння user-controlled значень у темплейти.
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/// Базовий URL для посилань у листах. Беремо з NEXTAUTH_URL (це стандартна змінна,
/// яка вже задана на dev/prod для NextAuth). Fallback — прод uimp.com.ua.
export function appBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || 'https://uimp.com.ua';
  return url.replace(/\/+$/, '');
}
