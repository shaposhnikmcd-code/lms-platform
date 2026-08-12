/// Централізована відправка листів через Resend. Єдина точка виходу для всіх
/// outbound emails — contact form, password reset, invite, certificate, cron-нагадування,
/// масові розсилки Річної програми.
///
/// Конвенція:
/// - Якщо `RESEND_API_KEY` не заданий (dev без .env) — лист НЕ шлеться,
///   а логується в консоль (разом з `devPreviewHint`, якщо є). Це дозволяє
///   тестувати password-reset локально без справжніх листів.
/// - `from` беремо з `RESEND_FROM_EMAIL`, fallback — інститутська адреса
///   `UIMP Education <edu@uimp.com.ua>`. Це наша головна адреса для масових
///   розсилок, сертифікатів та системних сповіщень. Reply-to листів про
///   сертифікати теж edu@uimp.com.ua (lib/certificates/service.ts).
///
/// ⚠️ Гард середовища (як у SendPulse/Telegram): реальний лист реальному отримувачу
/// йде ТІЛЬКИ на проді (`VERCEL_ENV === 'production'`). На pre (preview) і localhost
/// (VERCEL_ENV не заданий) ключ RESEND_API_KEY той самий, що й на проді, тож без гарда
/// будь-який e2e-тест шле справжні листи живим людям. На не-проді:
///   - є `MAILER_OVERRIDE_TO` → лист іде на цю тест-скриньку, тема з префіксом
///     `[DEV→оригінальний_to]`, справжня адреса в `to` НЕ потрапляє;
///   - нема `MAILER_OVERRIDE_TO` → лист не шлеться взагалі, лише console.warn.
/// На проді `MAILER_OVERRIDE_TO` ігнорується навіть якщо випадково заданий.

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/// Адреса відправника усіх системних листів інституту. Експортується щоб UI
/// міг показати її в адмінках перед відправкою (прозорість для менеджера).
export const MAILER_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'UIMP Education <edu@uimp.com.ua>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/// Чи реально сконфігуровано Resend (є API key). Якщо false — листи лише в консолі.
export function isMailerConfigured(): boolean {
  return resend !== null;
}

/// Прод — єдине середовище, де лист іде реальному отримувачу. Читаємо env на кожен
/// виклик (а не на import), щоб гард працював і в тестах, які підміняють process.env.
function isProductionEnv(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

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

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; error?: string; messageId?: string; skipped?: boolean }> {
  const { to, subject, html, devPreviewHint, attachments, replyTo } = args;

  if (!resend) {
    console.warn('📧 [mailer] RESEND_API_KEY не заданий — лист НЕ відправлено.');
    console.warn('📧 [mailer] to:', to, '| subject:', subject);
    if (attachments?.length) {
      console.warn('📧 [mailer] attachments:', attachments.map((a) => `${a.filename} (${a.content.byteLength}B)`).join(', '));
    }
    if (devPreviewHint) console.warn('📧 [mailer] preview:', devPreviewHint);
    // skipped:true — лист НЕ пішов (немає ключа). Виклики можуть це залогувати чесно,
    // щоб не показувати оманливе «надіслано».
    return { ok: true, skipped: true };
  }

  // Гард середовища: на не-проді реальному отримувачу не пишемо ніколи.
  let effectiveTo = to;
  let effectiveSubject = subject;
  if (!isProductionEnv()) {
    const overrideTo = process.env.MAILER_OVERRIDE_TO?.trim();
    if (!overrideTo) {
      console.warn('📧 [mailer] non-production env — лист НЕ відправлено (MAILER_OVERRIDE_TO не заданий).');
      console.warn('📧 [mailer] to:', to, '| subject:', subject);
      if (attachments?.length) {
        console.warn('📧 [mailer] attachments:', attachments.map((a) => `${a.filename} (${a.content.byteLength}B)`).join(', '));
      }
      if (devPreviewHint) console.warn('📧 [mailer] preview:', devPreviewHint);
      return { ok: true, skipped: true };
    }
    effectiveTo = overrideTo;
    effectiveSubject = `[DEV→${to}] ${subject}`;
    console.warn(`📧 [mailer] non-production env — лист перенаправлено на ${overrideTo} (оригінальний отримувач: ${to}).`);
  }

  try {
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: MAILER_FROM_EMAIL,
      to: effectiveTo,
      subject: effectiveSubject,
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
/// яка вже задана на dev/prod для NextAuth).
///
/// Fallback — саме `www.uimp.com.ua`, а не голий домен: канонічний хост сайту — www
/// (apex віддає 307 на www, туди ж ведуть QR-коди сертифікатів і канонічні URL для SEO).
/// З голим доменом кожне посилання в листі коштувало клієнту зайвий редірект-хоп, а
/// поштові сканери іноді «спалюють» одноразові токени саме на редіректі.
export function appBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || 'https://www.uimp.com.ua';
  return url.replace(/\/+$/, '');
}
