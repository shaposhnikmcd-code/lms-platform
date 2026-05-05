/// Сповіщення менеджерам про замовлення гри «Конектор» — email (через Resend) + Telegram (через @connectorgame_bot).
///
/// Дві події:
///   "new"   — нова заявка створена (PENDING). Тригериться у POST /api/connector.
///   "paid"  — замовлення успішно оплачено (PAID). Тригериться у WFP callback (Approved).
///
/// Логіка:
///   1. Беремо всіх `KonektorManager` з `enabled = true`, які підписані на цю подію (notifyOnNew/notifyOnPaid).
///   2. Для кожного менеджера паралельно: якщо є `email` — шлемо лист; якщо є `telegramChatId` — шлемо TG-повідомлення.
///   3. Помилки одного каналу/менеджера НЕ блокують інших — кожен виклик завернутий у try/catch.
///   4. Функція `notifyManagers` НІКОЛИ не кидає — повертає підсумок. Виклик безпечно робити з API-обробників.

import prisma from '@/lib/prisma';
import { sendEmail, esc } from '@/lib/mailer';
import { sendConnectorMessage, escapeHtml, isConnectorBotConfigured } from '@/lib/telegramConnector';

export type ConnectorNotificationEvent = 'new' | 'paid';

export interface ConnectorOrderForNotify {
  id: string;
  orderReference: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  postOffice: string;
  amount: number;
  gamePrice: number | null;
  shippingCost: number | null;
  callMe: boolean;
  paidAt: Date | null;
  createdAt: Date;
}

interface NotifyResult {
  managersTried: number;
  emailsSent: number;
  emailsFailed: number;
  telegramSent: number;
  telegramFailed: number;
}

const EVENT_LABEL: Record<ConnectorNotificationEvent, string> = {
  new: '🆕 Нова заявка на «Конектор»',
  paid: '✅ Оплачено замовлення «Конектор»',
};

function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('uk-UA')} ₴`;
}

function fmtDate(d: Date): string {
  return d.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
}

function buildAdminLink(): string {
  const base = process.env.NEXTAUTH_URL || 'https://uimp.com.ua';
  return `${base.replace(/\/+$/, '')}/dashboard/admin/connector`;
}

function buildEmailHtml(event: ConnectorNotificationEvent, order: ConnectorOrderForNotify): string {
  const title = EVENT_LABEL[event];
  const isPaid = event === 'paid';
  const accent = isPaid ? '#16a34a' : '#D4A017';
  const adminLink = buildAdminLink();

  const rows: Array<[string, string]> = [
    ['Замовлення', `<code>${esc(order.orderReference)}</code>`],
    ['Клієнт', esc(order.fullName)],
    ['Email', `<a href="mailto:${esc(order.email)}">${esc(order.email)}</a>`],
    ['Телефон', `<a href="tel:${esc(order.phone)}">${esc(order.phone)}</a>${order.callMe ? ' <span style="color:#b45309">📞 просив передзвонити</span>' : ''}`],
    ['Адреса', esc(`${order.city}, ${order.postOffice}`)],
    ['Сума', `<strong>${esc(fmtMoney(order.amount))}</strong>${order.gamePrice !== null ? ` <span style="color:#78716c">(гра ${esc(fmtMoney(order.gamePrice))}${order.shippingCost ? ` + доставка ${esc(fmtMoney(order.shippingCost))}` : ''})</span>` : ''}`],
    [isPaid ? 'Оплачено' : 'Створено', esc(fmtDate(isPaid ? (order.paidAt ?? order.createdAt) : order.createdAt))],
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 12px;color:#78716c;font-size:13px;border-bottom:1px solid #f5f5f4;white-space:nowrap;vertical-align:top">${esc(k)}</td>
          <td style="padding:8px 12px;color:#1c1917;font-size:14px;border-bottom:1px solid #f5f5f4">${v}</td>
        </tr>`,
    )
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#1c1917">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">
        <div style="background:${accent};color:#fff;padding:18px 24px">
          <div style="font-size:18px;font-weight:600">${esc(title)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:0">
          ${rowsHtml}
        </table>
        <div style="padding:18px 24px;background:#fafaf9;border-top:1px solid #e7e5e4">
          <a href="${esc(adminLink)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">Відкрити в адмінці</a>
        </div>
      </div>
      <div style="text-align:center;color:#a8a29e;font-size:11px;margin-top:16px">
        UIMP · автоматичне сповіщення менеджеру
      </div>
    </div>
  `;
}

function buildTelegramText(event: ConnectorNotificationEvent, order: ConnectorOrderForNotify): string {
  const title = EVENT_LABEL[event];
  const isPaid = event === 'paid';
  const adminLink = buildAdminLink();

  const callMeBadge = order.callMe ? '\n📞 <i>клієнт просив передзвонити</i>' : '';
  const priceBreakdown =
    order.gamePrice !== null
      ? ` <i>(гра ${escapeHtml(fmtMoney(order.gamePrice))}${order.shippingCost ? ` + дост. ${escapeHtml(fmtMoney(order.shippingCost))}` : ''})</i>`
      : '';

  return [
    `<b>${escapeHtml(title)}</b>`,
    '',
    `👤 <b>${escapeHtml(order.fullName)}</b>`,
    `✉️ ${escapeHtml(order.email)}`,
    `📱 ${escapeHtml(order.phone)}${callMeBadge}`,
    `📍 ${escapeHtml(`${order.city}, ${order.postOffice}`)}`,
    `💰 <b>${escapeHtml(fmtMoney(order.amount))}</b>${priceBreakdown}`,
    `🧾 <code>${escapeHtml(order.orderReference)}</code>`,
    `🕐 ${escapeHtml(fmtDate(isPaid ? (order.paidAt ?? order.createdAt) : order.createdAt))}`,
    '',
    `<a href="${escapeHtml(adminLink)}">Відкрити в адмінці →</a>`,
  ].join('\n');
}

/// Шле сповіщення усім підписаним менеджерам. Безпечна для виклику з критичних
/// шляхів (POST /api/connector, WFP callback) — не кидає, повертає підсумок.
export async function notifyManagers(
  event: ConnectorNotificationEvent,
  order: ConnectorOrderForNotify,
): Promise<NotifyResult> {
  const result: NotifyResult = {
    managersTried: 0,
    emailsSent: 0,
    emailsFailed: 0,
    telegramSent: 0,
    telegramFailed: 0,
  };

  let managers: Array<{
    id: string;
    label: string;
    email: string | null;
    telegramChatId: string | null;
    notifyOnNew: boolean;
    notifyOnPaid: boolean;
  }>;
  try {
    managers = await prisma.konektorManager.findMany({
      where: {
        enabled: true,
        ...(event === 'new' ? { notifyOnNew: true } : { notifyOnPaid: true }),
      },
      select: {
        id: true,
        label: true,
        email: true,
        telegramChatId: true,
        notifyOnNew: true,
        notifyOnPaid: true,
      },
    });
  } catch (e) {
    console.error('❌ [connectorNotify] не вдалося отримати менеджерів:', e);
    return result;
  }

  if (managers.length === 0) return result;
  result.managersTried = managers.length;

  const subject = `${EVENT_LABEL[event]} — ${order.fullName} (${fmtMoney(order.amount)})`;
  const html = buildEmailHtml(event, order);
  const tgText = buildTelegramText(event, order);
  const tgEnabled = isConnectorBotConfigured();

  await Promise.allSettled(
    managers.flatMap((m) => {
      const tasks: Array<Promise<void>> = [];

      if (m.email) {
        tasks.push(
          (async () => {
            try {
              const r = await sendEmail({ to: m.email!, subject, html });
              if (r.ok) result.emailsSent += 1;
              else {
                result.emailsFailed += 1;
                console.error(`❌ [connectorNotify] email→${m.email} failed:`, r.error);
              }
            } catch (e) {
              result.emailsFailed += 1;
              console.error(`❌ [connectorNotify] email→${m.email} threw:`, e);
            }
          })(),
        );
      }

      if (m.telegramChatId && tgEnabled) {
        tasks.push(
          (async () => {
            try {
              await sendConnectorMessage({ chatId: m.telegramChatId!, text: tgText });
              result.telegramSent += 1;
            } catch (e) {
              result.telegramFailed += 1;
              console.error(`❌ [connectorNotify] telegram→${m.telegramChatId} failed:`, e);
            }
          })(),
        );
      }

      return tasks;
    }),
  );

  return result;
}
