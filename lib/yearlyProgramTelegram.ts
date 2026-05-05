/// Сервісний шар для Telegram-каналу/групи Річної програми.
/// — getSettings / saveSettings / validateAndSaveSettings — працюють з singleton-таблицею
///   YearlyProgramTelegramSetting.
/// — generateInviteForSubscription — генерує одноразовий invite-link і зберігає у subscription.
/// — renderTelegramInviteEmailBlock — HTML-блок для append у листи.

import prisma from '@/lib/prisma';
import { esc } from '@/lib/mailer';
import {
  createChatInviteLink,
  getChat,
  normalizeChatId,
  TelegramApiError,
} from '@/lib/telegram';

const SINGLETON_ID = 'singleton';

export interface YearlyProgramTelegramSettings {
  chatId: string | null;
  chatTitle: string | null;
  chatType: string | null;
  autoAdd: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
}

/// Дефолти — використовуються коли запис у БД ще не створений.
const DEFAULTS: YearlyProgramTelegramSettings = {
  chatId: null,
  chatTitle: null,
  chatType: null,
  autoAdd: false,
  updatedAt: null,
  updatedBy: null,
};

export async function getYearlyProgramTelegramSettings(): Promise<YearlyProgramTelegramSettings> {
  const row = await prisma.yearlyProgramTelegramSetting.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) return DEFAULTS;
  return {
    chatId: row.chatId,
    chatTitle: row.chatTitle,
    chatType: row.chatType,
    autoAdd: row.autoAdd,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export interface ValidateAndSaveResult {
  ok: boolean;
  settings?: YearlyProgramTelegramSettings;
  error?: string;
}

/// Зберігає тільки autoAdd (без зміни chatId). Використовується для toggle-чекбокса.
export async function setAutoAddFlag(autoAdd: boolean, updatedBy: string | null): Promise<YearlyProgramTelegramSettings> {
  const row = await prisma.yearlyProgramTelegramSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, autoAdd, updatedBy },
    update: { autoAdd, updatedBy },
  });
  return {
    chatId: row.chatId,
    chatTitle: row.chatTitle,
    chatType: row.chatType,
    autoAdd: row.autoAdd,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/// Валідує chatId через Bot API getChat (бот має бути учасником каналу/групи)
/// і зберігає в settings разом з friendly title/type. Повертає помилку для UI
/// якщо resolve падає (бот не доданий, неправильний username, токена немає).
export async function validateAndSaveChatId(
  rawChatId: string,
  updatedBy: string | null,
): Promise<ValidateAndSaveResult> {
  const normalized = normalizeChatId(rawChatId);
  if (!normalized) {
    return {
      ok: false,
      error: 'Невалідний формат. Вкажіть @username каналу/групи або numeric chat_id (-100…).',
    };
  }

  let chat;
  try {
    chat = await getChat(normalized);
  } catch (e) {
    if (e instanceof TelegramApiError) {
      // Типові помилки: "chat not found" (бот не доданий), "bot was kicked", "Unauthorized" (немає токена).
      return {
        ok: false,
        error: `Telegram API: ${e.message}. Перевірте, що бот доданий до каналу/групи як адміністратор.`,
      };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const row = await prisma.yearlyProgramTelegramSetting.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      chatId: normalized,
      chatTitle: chat.title ?? chat.username ?? null,
      chatType: chat.type,
      updatedBy,
    },
    update: {
      chatId: normalized,
      chatTitle: chat.title ?? chat.username ?? null,
      chatType: chat.type,
      updatedBy,
    },
  });
  return {
    ok: true,
    settings: {
      chatId: row.chatId,
      chatTitle: row.chatTitle,
      chatType: row.chatType,
      autoAdd: row.autoAdd,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    },
  };
}

/// Очищає chatId / chatTitle / chatType (autoAdd теж скидається у false щоб уникнути
/// "auto-add ON, але каналу немає" неконсистентного стану).
export async function clearChatId(updatedBy: string | null): Promise<YearlyProgramTelegramSettings> {
  const row = await prisma.yearlyProgramTelegramSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, chatId: null, chatTitle: null, chatType: null, autoAdd: false, updatedBy },
    update: { chatId: null, chatTitle: null, chatType: null, autoAdd: false, updatedBy },
  });
  return {
    chatId: row.chatId,
    chatTitle: row.chatTitle,
    chatType: row.chatType,
    autoAdd: row.autoAdd,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export interface GenerateInviteResult {
  ok: boolean;
  inviteLink: string | null;
  error: string | null;
  /// Повертаємо subscription.id для зручності callsite-ів (admin UI оновлює стан після виклику).
  subscriptionId: string;
}

/// Генерує одноразовий invite-link для конкретної підписки і зберігає його у БД.
/// Idempotent: якщо в підписки вже є telegramInviteLink — повертає існуючий без створення
/// нового (бот API повертає різні links для кожного виклику; ми не хочемо створювати десятки).
/// Передавай force=true щоб перегенерувати.
export async function generateInviteForSubscription(args: {
  subscriptionId: string;
  /// Передаємо вже завантажену підписку якщо вона вже в руках — щоб не робити зайвий запит.
  prefetched?: { id: string; telegramInviteLink: string | null; userEmail?: string | null; userName?: string | null };
  force?: boolean;
  triggeredBy?: string;
}): Promise<GenerateInviteResult> {
  const { subscriptionId, force = false, triggeredBy = 'system' } = args;

  let sub = args.prefetched;
  if (!sub) {
    const fetched = await prisma.yearlyProgramSubscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        telegramInviteLink: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!fetched) {
      return { ok: false, inviteLink: null, error: 'Підписку не знайдено', subscriptionId };
    }
    sub = {
      id: fetched.id,
      telegramInviteLink: fetched.telegramInviteLink,
      userEmail: fetched.user?.email ?? null,
      userName: fetched.user?.name ?? null,
    };
  }

  // Idempotent — повертаємо існуючий, якщо не force.
  if (!force && sub.telegramInviteLink) {
    return { ok: true, inviteLink: sub.telegramInviteLink, error: null, subscriptionId };
  }

  const settings = await getYearlyProgramTelegramSettings();
  if (!settings.chatId) {
    const err = 'Telegram-канал не налаштовано в адмінці';
    await prisma.yearlyProgramSubscription.update({
      where: { id: subscriptionId },
      data: { telegramInviteError: err },
    });
    return { ok: false, inviteLink: null, error: err, subscriptionId };
  }

  try {
    const link = await createChatInviteLink({
      chatId: settings.chatId,
      // Назва бачиться лише адмінам каналу — для diagnostics.
      name: sub.userEmail ? `UIMP ${sub.userEmail}`.slice(0, 32) : 'UIMP yearly',
      memberLimit: 1,
      expireSeconds: 30 * 24 * 60 * 60,
    });
    await prisma.yearlyProgramSubscription.update({
      where: { id: subscriptionId },
      data: {
        telegramInviteLink: link.invite_link,
        telegramInvitedAt: new Date(),
        telegramInviteError: null,
      },
    });
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId,
        type: 'admin_action',
        message: `Telegram invite згенеровано (${triggeredBy})`,
        metadata: { inviteLink: link.invite_link, chatId: settings.chatId, triggeredBy },
      },
    });
    return { ok: true, inviteLink: link.invite_link, error: null, subscriptionId };
  } catch (e) {
    const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
    await prisma.yearlyProgramSubscription.update({
      where: { id: subscriptionId },
      data: { telegramInviteError: msg.slice(0, 500) },
    });
    return { ok: false, inviteLink: null, error: msg, subscriptionId };
  }
}

/// HTML-блок з invite-кнопкою у Telegram-канал. Додається в кінець будь-якого
/// транзакційного листа Річної програми (welcome / cohort-launch). Inline-styles —
/// сумісно з email-клієнтами. Якщо `inviteUrl` відсутній — повертає пустий рядок,
/// тож callsite-и можуть безпечно append-нути результат без перевірки.
export function renderTelegramInviteEmailBlock(inviteUrl: string | null | undefined): string {
  if (!inviteUrl) return '';
  const safeUrl = esc(inviteUrl);
  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 8px auto 0; padding: 20px 24px; border-top: 1px solid #e6e0cf; color: #1a1a1a; line-height: 1.6;">
  <h3 style="margin: 0 0 8px; color: #1a1a1a;">📣 Telegram-канал Річної програми</h3>
  <p style="margin: 0 0 14px; color: #444;">Долучайтесь до нашого Telegram-каналу — там ми ділимось новинами, нагадуваннями та відповідаємо на питання щодо організації навчання.</p>
  <p style="margin: 0 0 8px;">
    <a href="${safeUrl}" style="display: inline-block; padding: 10px 20px; background: #229ED9; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Долучитись у Telegram</a>
  </p>
  <p style="margin: 8px 0 0; color: #888; font-size: 12px;">Посилання одноразове — діє лише для вас.</p>
</div>
`.trim();
}
