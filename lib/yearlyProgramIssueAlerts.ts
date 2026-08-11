/// Push критичних проблем Річної програми менеджерам (email + Telegram).
///
/// Навіщо: вкладка «Помилки» показує все чесно, але вона pull-only — треба відкрити
/// адмінку і подивитись. Для кейсів, де ціна мовчання — гроші клієнта (списання після
/// закриття підписки, незняте автосписання, незарахований callback) або цілий набір без
/// доступу (прострочений запуск), цього замало: про них треба дізнаватись самому.
///
/// Канал — той самий, що в `lib/paymentAlerts.ts`: Resend + бот @connectorgame_bot,
/// одержувачі з реєстру `KonektorManager` плюс env `PAYMENT_ALERT_EMAILS`.
///
/// Дедуп: на кожен надісланий issue лишається маркер у `AppSetting`
/// (`ypIssueAlert:<KIND>:<subscriptionId|sourceId>`). Поки issue висить активним —
/// маркер живий і повторний push не йде. Коли issue зникає з активних (полагодили або
/// заглушили) — маркер видаляється, тож рецидив тієї самої проблеми знову дасть сигнал.
/// Окремої таблиці під це не заводимо: рядків стільки ж, скільки живих критичних проблем
/// (у нормі — нуль), а `AppSetting` ніде не перелічується цілком.
///
/// Функція НІКОЛИ не кидає нагору сама по собі не-критичні збої: викликається з cron-а,
/// один недоступний Telegram не має валити денний прохід.

import prisma from '@/lib/prisma';
import { sendEmail, esc } from '@/lib/mailer';
import { sendConnectorMessage, escapeHtml, isConnectorBotConfigured } from '@/lib/telegramConnector';
import {
  collectAllIssues,
  ISSUE_KIND_LABELS,
  PUSHED_ISSUE_KINDS,
  type IssueRecord,
} from '@/lib/yearlyProgramIssues';

const ALERT_KEY_PREFIX = 'ypIssueAlert:';

/// Скільки issue-ів максимум перелічуємо в тілі листа/повідомлення. Решта — числом.
const MAX_LISTED = 12;

export interface YearlyIssueAlertResult {
  /// Активних issue-ів «пушних» типів усього.
  candidates: number;
  /// З них нових (маркера ще не було) — саме вони пішли менеджерам.
  fresh: number;
  /// Маркерів прибрано (issue більше не активний).
  cleared: number;
  recipients: number;
  emailsSent: number;
  /// Resend не сконфігурований (dev без ключа) — доставкою НЕ рахується.
  emailsSkipped: number;
  emailsFailed: number;
  telegramSent: number;
  telegramFailed: number;
  errors: string[];
}

function alertKey(rec: IssueRecord): string {
  return `${ALERT_KEY_PREFIX}${rec.kind}:${rec.subscriptionId ?? rec.sourceId ?? 'unknown'}`;
}

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL || 'https://uimp.com.ua').replace(/\/+$/, '');
}

function whoOf(rec: IssueRecord): string {
  const name = rec.user.name?.trim();
  const email = rec.user.email && rec.user.email !== '—' ? rec.user.email : null;
  if (name && email) return `${name} · ${email}`;
  return name || email || '—';
}

function buildHtml(items: IssueRecord[]): string {
  const rows = items
    .slice(0, MAX_LISTED)
    .map((it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px;vertical-align:top">
          <div style="font-weight:600;color:#991b1b">${esc(ISSUE_KIND_LABELS[it.kind])}</div>
          <div style="color:#78716c;font-size:12px;margin-top:2px">${esc(it.cohortName ?? '—')} · ${esc(it.plan === 'YEARLY' ? 'Річна' : 'Місячна')}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px;vertical-align:top">
          <div>${esc(whoOf(it))}</div>
          <div style="margin-top:4px;color:#b91c1c;font-size:12px">${esc(it.errorExcerpt ?? '—')}</div>
        </td>
      </tr>`)
    .join('');

  const tail = items.length > MAX_LISTED
    ? `<div style="padding:12px 24px;font-size:12px;color:#78716c">… і ще ${items.length - MAX_LISTED} — повний список у вкладці «Помилки».</div>`
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#1c1917">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">
        <div style="background:#dc2626;color:#fff;padding:18px 24px">
          <div style="font-size:18px;font-weight:600">🚨 Річна програма: ${items.length} ${items.length === 1 ? 'критична проблема' : 'критичних проблем'}</div>
          <div style="font-size:13px;opacity:.9;margin-top:4px">Система сама їх не виправить — потрібне ручне рішення менеджера.</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:0">${rows}</table>
        ${tail}
        <div style="padding:16px 24px;background:#fafaf9;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c">
          <a href="${esc(`${baseUrl()}/dashboard/admin/yearly-program`)}" style="color:#1d4ed8">Відкрити «Річну програму» →</a><br/>
          Кожна проблема згадується в листі один раз. Повторний лист піде, тільки якщо після
          полагодження вона виникне знову.
        </div>
      </div>
    </div>`;
}

function buildTelegramText(items: IssueRecord[]): string {
  const lines = items.slice(0, MAX_LISTED).map((it) =>
    [
      `• <b>${escapeHtml(ISSUE_KIND_LABELS[it.kind])}</b>`,
      `  👤 ${escapeHtml(whoOf(it))}`,
      `  ⚠️ ${escapeHtml((it.errorExcerpt ?? '—').slice(0, 160))}`,
    ].join('\n'),
  );
  const tail = items.length > MAX_LISTED ? [`… і ще ${items.length - MAX_LISTED}`] : [];
  return [
    `<b>🚨 Річна програма — ${items.length} критичних проблем</b>`,
    '',
    ...lines,
    ...tail,
    '',
    `<a href="${escapeHtml(`${baseUrl()}/dashboard/admin/yearly-program`)}">Відкрити «Річну програму» →</a>`,
  ].join('\n');
}

export async function alertCriticalYearlyIssues(): Promise<YearlyIssueAlertResult> {
  const result: YearlyIssueAlertResult = {
    candidates: 0, fresh: 0, cleared: 0, recipients: 0,
    emailsSent: 0, emailsSkipped: 0, emailsFailed: 0,
    telegramSent: 0, telegramFailed: 0, errors: [],
  };

  const payload = await collectAllIssues();
  const alertable = payload.active.filter((r) => PUSHED_ISSUE_KINDS.includes(r.kind));
  result.candidates = alertable.length;

  const liveKeys = new Set(alertable.map(alertKey));
  const stored = await prisma.appSetting.findMany({
    where: { key: { startsWith: ALERT_KEY_PREFIX } },
    select: { key: true },
  });
  const storedKeys = new Set(stored.map((r) => r.key));

  // Прибираємо маркери проблем, яких більше немає в активних: полагоджену проблему
  // «забуваємо», щоб рецидив знову дав сигнал, а не потонув у старому дедупі.
  const staleKeys = [...storedKeys].filter((k) => !liveKeys.has(k));
  if (staleKeys.length > 0) {
    const del = await prisma.appSetting.deleteMany({ where: { key: { in: staleKeys } } });
    result.cleared = del.count;
  }

  const fresh = alertable.filter((r) => !storedKeys.has(alertKey(r)));
  result.fresh = fresh.length;
  if (fresh.length === 0) return result;

  let managers: Array<{ email: string | null; telegramChatId: string | null; emailEnabled: boolean; telegramEnabled: boolean }> = [];
  try {
    managers = await prisma.konektorManager.findMany({
      where: { enabled: true, notifyOnPaid: true },
      select: { email: true, telegramChatId: true, emailEnabled: true, telegramEnabled: true },
    });
  } catch (e) {
    result.errors.push(`managers: ${(e as Error).message.slice(0, 160)}`);
  }

  const emailTargets = new Set<string>(
    (process.env.PAYMENT_ALERT_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.includes('@')),
  );
  for (const m of managers) {
    if (m.email && m.emailEnabled) emailTargets.add(m.email);
  }
  const tgTargets = isConnectorBotConfigured()
    ? [...new Set(managers.filter((m) => m.telegramChatId && m.telegramEnabled).map((m) => m.telegramChatId!))]
    : [];

  result.recipients = emailTargets.size + tgTargets.length;
  // Нема кому слати — маркери НЕ ставимо: інакше проблема тихо «згорить» і про неї не
  // дізнаються навіть після того, як менеджерів налаштують.
  if (result.recipients === 0) return result;

  const subject = `🚨 UIMP Річна: ${fresh.length} ${fresh.length === 1 ? 'критична проблема' : 'критичних проблем'}`;
  const html = buildHtml(fresh);
  const tgText = buildTelegramText(fresh);

  await Promise.allSettled([
    ...[...emailTargets].map(async (to) => {
      try {
        const r = await sendEmail({ to, subject, html });
        if (r.skipped) result.emailsSkipped += 1;
        else if (r.ok) result.emailsSent += 1;
        else {
          result.emailsFailed += 1;
          result.errors.push(`email→${to}: ${(r.error ?? 'unknown').slice(0, 120)}`);
        }
      } catch (e) {
        result.emailsFailed += 1;
        result.errors.push(`email→${to}: ${(e as Error).message.slice(0, 120)}`);
      }
    }),
    ...tgTargets.map(async (chatId) => {
      try {
        await sendConnectorMessage({ chatId, text: tgText });
        result.telegramSent += 1;
      } catch (e) {
        result.telegramFailed += 1;
        result.errors.push(`telegram→${chatId}: ${(e as Error).message.slice(0, 120)}`);
      }
    }),
  ]);

  // Маркер ставимо лише коли сигнал реально кудись дійшов. Якщо все впало (Resend лежить,
  // ключа немає) — завтрашній прохід спробує ще раз, а не вважатиме проблему озвученою.
  if (result.emailsSent + result.telegramSent > 0) {
    for (const rec of fresh) {
      const key = alertKey(rec);
      const value = Math.floor(Date.now() / 1000);
      try {
        await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      } catch (e) {
        result.errors.push(`mark ${key}: ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }

  return result;
}
