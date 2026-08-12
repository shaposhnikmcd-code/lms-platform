/// Алерт менеджерам «гроші є, доступу немає».
///
/// Раніше провал провіжинінгу був німим: `Payment.provisionError` заповнювався, recon-cron
/// щодоби фіксував `stillBroken`, і на цьому все — ніхто про це не дізнавався, поки не
/// напише сам клієнт. Тут той самий канал, що й у нотифікацій «Конектора»: email через
/// Resend + Telegram через @connectorgame_bot.
///
/// Одержувачі:
///   — `KonektorManager` з `enabled=true` і `notifyOnPaid=true` (той самий реєстр менеджерів,
///     який уже стежить за оплатами; окремої таблиці під платіжні алерти не заводимо);
///   — плюс адреси з env `PAYMENT_ALERT_EMAILS` (comma-separated) — щоб можна було
///     підписати техпідтримку, не додаючи її в менеджери гри.
///
/// Функція НІКОЛИ не кидає: викликається з cron-а, її падіння не має валити прохід.
/// Дедуплікацію (щоб не слати той самий платіж щодоби) робить викликач через
/// `Payment.provisionAlertedAt` / `PaymentCallbackLog.alertedAt`.

import prisma from '@/lib/prisma';
import { sendEmail, esc } from '@/lib/mailer';
import { sendConnectorMessage, escapeHtml, isConnectorBotConfigured } from '@/lib/telegramConnector';

export interface StuckPaymentAlertItem {
  /// 'provision_failed' — Payment є, гроші є, доступи не видані.
  /// 'payment_not_found' — WFP підтвердив оплату, а Payment із таким orderReference немає.
  /// 'order_ref_conflict' — зовнішній продаж не записався: номер замовлення вже зайнятий
  ///   чужим платежем (у нашій базі під цим ref-ом лежить не той запис).
  kind: 'provision_failed' | 'payment_not_found' | 'order_ref_conflict';
  orderReference: string;
  amount: number | null;
  currency: string;
  clientEmail: string | null;
  productLabel: string;
  /// Текст помилки / skipReason — коротко, для листа.
  reason: string;
  paidAt: Date | null;
}

export interface PaymentAlertResult {
  recipients: number;
  emailsSent: number;
  /// Лист не пішов, бо Resend не сконфігуровано (dev без ключа). НЕ рахується доставкою —
  /// інакше локальний прогін «погасив» би алерт, який ніхто не бачив.
  emailsSkipped: number;
  emailsFailed: number;
  telegramSent: number;
  telegramFailed: number;
}

const KIND_LABEL: Record<StuckPaymentAlertItem['kind'], string> = {
  provision_failed: 'Оплачено, доступ НЕ видано',
  payment_not_found: 'Оплата без замовлення в базі',
  order_ref_conflict: 'Зовнішній продаж не записано (номер зайнятий)',
};

function fmtMoney(value: number | null, currency: string): string {
  if (value === null) return '—';
  return `${value.toLocaleString('uk-UA')} ${currency === 'UAH' ? '₴' : currency}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' });
}

function adminPaymentsLink(ref: string): string {
  const base = (process.env.NEXTAUTH_URL || 'https://uimp.com.ua').replace(/\/+$/, '');
  return `${base}/dashboard/admin/payments?ref=${encodeURIComponent(ref)}`;
}

function buildHtml(items: StuckPaymentAlertItem[]): string {
  const rows = items
    .map((it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px;vertical-align:top">
          <div style="font-weight:600;color:#991b1b">${esc(KIND_LABEL[it.kind])}</div>
          <div style="color:#78716c;font-size:12px;margin-top:2px">${esc(it.productLabel)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px;vertical-align:top">
          <div><strong>${esc(fmtMoney(it.amount, it.currency))}</strong></div>
          <div style="color:#78716c;font-size:12px">${esc(fmtDate(it.paidAt))}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px;vertical-align:top">
          <div>${esc(it.clientEmail ?? '—')}</div>
          <div style="margin-top:4px"><code style="font-size:11px;color:#57534e">${esc(it.orderReference)}</code></div>
          <div style="margin-top:4px;color:#b91c1c;font-size:12px">${esc(it.reason)}</div>
          <div style="margin-top:6px"><a href="${esc(adminPaymentsLink(it.orderReference))}" style="color:#1d4ed8;font-size:12px">Відкрити в «Платежах» →</a></div>
        </td>
      </tr>`)
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#1c1917">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">
        <div style="background:#dc2626;color:#fff;padding:18px 24px">
          <div style="font-size:18px;font-weight:600">🚨 Платежі без виданого доступу — ${items.length}</div>
          <div style="font-size:13px;opacity:.9;margin-top:4px">Гроші отримані, автоматична видача не спрацювала. Потрібне ручне втручання.</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:0">${rows}</table>
        <div style="padding:16px 24px;background:#fafaf9;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c">
          Кожен платіж у цьому листі згадується один раз: повторний алерт піде, тільки якщо після
          полагодження виникне новий збій.
        </div>
      </div>
    </div>`;
}

function buildTelegramText(items: StuckPaymentAlertItem[]): string {
  const lines = items.slice(0, 10).map((it) =>
    [
      `• <b>${escapeHtml(KIND_LABEL[it.kind])}</b> — ${escapeHtml(it.productLabel)}`,
      `  💰 ${escapeHtml(fmtMoney(it.amount, it.currency))} · ✉️ ${escapeHtml(it.clientEmail ?? '—')}`,
      `  🧾 <code>${escapeHtml(it.orderReference)}</code>`,
      `  ⚠️ ${escapeHtml(it.reason.slice(0, 160))}`,
    ].join('\n'),
  );
  const tail = items.length > 10 ? [`… і ще ${items.length - 10}`] : [];
  const base = (process.env.NEXTAUTH_URL || 'https://uimp.com.ua').replace(/\/+$/, '');
  return [
    `<b>🚨 Платежі без виданого доступу — ${items.length}</b>`,
    '',
    ...lines,
    ...tail,
    '',
    `<a href="${escapeHtml(`${base}/dashboard/admin/payments`)}">Відкрити «Платежі» →</a>`,
  ].join('\n');
}

export async function alertStuckPayments(items: StuckPaymentAlertItem[]): Promise<PaymentAlertResult> {
  const result: PaymentAlertResult = {
    recipients: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emailsFailed: 0,
    telegramSent: 0,
    telegramFailed: 0,
  };
  if (items.length === 0) return result;

  let managers: Array<{ email: string | null; telegramChatId: string | null; emailEnabled: boolean; telegramEnabled: boolean }> = [];
  try {
    managers = await prisma.konektorManager.findMany({
      where: { enabled: true, notifyOnPaid: true },
      select: { email: true, telegramChatId: true, emailEnabled: true, telegramEnabled: true },
    });
  } catch (e) {
    console.error('❌ [paymentAlerts] не вдалося отримати менеджерів:', e);
  }

  const extraEmails = (process.env.PAYMENT_ALERT_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));

  const emailTargets = new Set<string>(extraEmails);
  for (const m of managers) {
    if (m.email && m.emailEnabled) emailTargets.add(m.email);
  }
  const tgTargets = isConnectorBotConfigured()
    ? [...new Set(managers.filter((m) => m.telegramChatId && m.telegramEnabled).map((m) => m.telegramChatId!))]
    : [];

  result.recipients = emailTargets.size + tgTargets.length;
  if (result.recipients === 0) return result;

  const subject = `🚨 UIMP: ${items.length} ${items.length === 1 ? 'платіж' : 'платежів'} без виданого доступу`;
  const html = buildHtml(items);
  const tgText = buildTelegramText(items);

  await Promise.allSettled([
    ...[...emailTargets].map(async (to) => {
      try {
        const r = await sendEmail({ to, subject, html });
        if (r.skipped) result.emailsSkipped += 1;
        else if (r.ok) result.emailsSent += 1;
        else {
          result.emailsFailed += 1;
          console.error(`❌ [paymentAlerts] email→${to} failed:`, r.error);
        }
      } catch (e) {
        result.emailsFailed += 1;
        console.error(`❌ [paymentAlerts] email→${to} threw:`, e);
      }
    }),
    ...tgTargets.map(async (chatId) => {
      try {
        await sendConnectorMessage({ chatId, text: tgText });
        result.telegramSent += 1;
      } catch (e) {
        result.telegramFailed += 1;
        console.error(`❌ [paymentAlerts] telegram→${chatId} failed:`, e);
      }
    }),
  ]);

  return result;
}
