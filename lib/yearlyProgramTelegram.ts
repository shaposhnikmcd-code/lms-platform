/// Сервісний шар для Telegram-каналу/групи Річної програми.
/// — getSettings / saveSettings / validateAndSaveSettings — працюють з singleton-таблицею
///   YearlyProgramTelegramSetting.
/// — generateInviteForSubscription — генерує одноразовий invite-link і зберігає у subscription.
/// — renderTelegramInviteEmailBlock — HTML-блок для append у листи.

import prisma from '@/lib/prisma';
import { esc } from '@/lib/mailer';
import {
  banChatMember,
  createChatInviteLink,
  getChat,
  normalizeChatId,
  revokeChatInviteLink,
  TelegramApiError,
  unbanChatMember,
} from '@/lib/telegram';

const SINGLETON_ID = 'singleton';

export interface YearlyProgramTelegramSettings {
  chatId: string | null;
  chatTitle: string | null;
  chatType: string | null;
  autoAdd: boolean;
  joinRequestMode: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
}

/// Дефолти — використовуються коли запис у БД ще не створений.
/// autoAdd + joinRequestMode за замовчуванням ON: пара працює разом — генерувати
/// invite автоматично + фільтрувати чужих по заявках на вступ. Менеджер може
/// вимкнути будь-який toggle, якщо канал тимчасово приймає всіх.
const DEFAULTS: YearlyProgramTelegramSettings = {
  chatId: null,
  chatTitle: null,
  chatType: null,
  autoAdd: true,
  joinRequestMode: true,
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
    joinRequestMode: row.joinRequestMode,
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
    joinRequestMode: row.joinRequestMode,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/// Зберігає тільки joinRequestMode. Менеджер вмикає його коли в каналі/групі
/// активований режим "Заявки на вступ" (Approve new members).
export async function setJoinRequestModeFlag(joinRequestMode: boolean, updatedBy: string | null): Promise<YearlyProgramTelegramSettings> {
  const row = await prisma.yearlyProgramTelegramSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, joinRequestMode, updatedBy },
    update: { joinRequestMode, updatedBy },
  });
  return {
    chatId: row.chatId,
    chatTitle: row.chatTitle,
    chatType: row.chatType,
    autoAdd: row.autoAdd,
    joinRequestMode: row.joinRequestMode,
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
      joinRequestMode: row.joinRequestMode,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    },
  };
}

/// Очищає chatId / chatTitle / chatType (autoAdd і joinRequestMode теж скидаються у false
/// щоб уникнути "auto-add ON, але каналу немає" неконсистентного стану).
export async function clearChatId(updatedBy: string | null): Promise<YearlyProgramTelegramSettings> {
  const row = await prisma.yearlyProgramTelegramSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, chatId: null, chatTitle: null, chatType: null, autoAdd: false, joinRequestMode: false, updatedBy },
    update: { chatId: null, chatTitle: null, chatType: null, autoAdd: false, joinRequestMode: false, updatedBy },
  });
  return {
    chatId: row.chatId,
    chatTitle: row.chatTitle,
    chatType: row.chatType,
    autoAdd: row.autoAdd,
    joinRequestMode: row.joinRequestMode,
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

  // Якщо студент був раніше забанений у каналі (через permanent-kick) — знімаємо
  // бан, інакше будь-який invite-link не дасть йому увійти. only_if_banned=true →
  // no-op якщо юзер не у бані (учасник каналу або ще не приєднувався). Best-effort:
  // помилка зняття бана не блокує генерацію invite, лише логується в подіях.
  const tgUser = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    select: { telegramTgUserId: true },
  });
  if (tgUser?.telegramTgUserId) {
    try {
      await unbanChatMember(settings.chatId, tgUser.telegramTgUserId, true);
    } catch (e) {
      const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId,
          type: 'admin_action',
          message: `TG unban skipped before invite (${triggeredBy}): ${msg.slice(0, 200)}`,
          metadata: { error: msg, triggeredBy },
        },
      });
    }
  }

  try {
    const link = await createChatInviteLink({
      chatId: settings.chatId,
      // Назва бачиться лише адмінам каналу — для diagnostics.
      name: sub.userEmail ? `UIMP ${sub.userEmail}`.slice(0, 32) : 'UIMP yearly',
      // joinRequestMode → invite з creates_join_request=true (без member_limit, бо
      // API їх не дозволяє разом). Webhook потім робить approve/decline.
      // Стандарт → member_limit=1, миттєвий вступ.
      ...(settings.joinRequestMode
        ? { createsJoinRequest: true }
        : { memberLimit: 1 }),
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

export type KickMode = 'returnable' | 'permanent';

export interface KickFromChannelResult {
  ok: boolean;
  /// `true` якщо ми реально викликали banChatMember для існуючого tgUserId.
  kicked: boolean;
  /// `true` якщо invite-link відкликано (тільки для permanent).
  inviteRevoked: boolean;
  /// Skip-причина (немає chatId / немає tgUserId / нічого робити).
  skipped: string | null;
  error: string | null;
}

/// Вилучає юзера з ТГ-каналу Річної програми.
///   • `returnable`: ban + одразу unban → користувач видалений з чату, але не у бані.
///     Може повернутись по існуючому invite-link (якщо він ще валідний) або по новому.
///   • `permanent`: ban (без unban) + revokeChatInviteLink. Користувач не може повернутись
///     навіть якщо десь зберіг посилання — бан блокує rejoin, а лінк знечинений.
///
/// Best-effort: у разі будь-якої проміжної помилки повертає {ok:false, error}, але
/// часткові побічні ефекти (вже виконаний ban або revoke) зберігаються. Використовується
/// як з прямих admin-actions, так і з інтегрованих флоу (close_access, delete).
export async function kickSubscriptionFromChannel(args: {
  subscriptionId: string;
  mode: KickMode;
  triggeredBy: string;
}): Promise<KickFromChannelResult> {
  const { subscriptionId, mode, triggeredBy } = args;

  const settings = await getYearlyProgramTelegramSettings();
  if (!settings.chatId) {
    return { ok: false, kicked: false, inviteRevoked: false, skipped: 'tg-not-configured', error: 'Telegram-канал не налаштовано' };
  }

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      telegramTgUserId: true,
      telegramInviteLink: true,
      telegramJoinedAt: true,
      telegramLeftAt: true,
    },
  });
  if (!sub) {
    return { ok: false, kicked: false, inviteRevoked: false, skipped: null, error: 'Підписку не знайдено' };
  }

  const errors: string[] = [];
  let kicked = false;
  let inviteRevoked = false;

  // 1) Якщо є tgUserId — банимо.
  if (sub.telegramTgUserId) {
    try {
      await banChatMember(settings.chatId, sub.telegramTgUserId);
      kicked = true;
    } catch (e) {
      const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
      errors.push(`ban: ${msg}`);
    }

    // returnable → знімаємо бан, щоб юзер міг повернутись по invite.
    if (kicked && mode === 'returnable') {
      try {
        await unbanChatMember(settings.chatId, sub.telegramTgUserId);
      } catch (e) {
        const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
        errors.push(`unban: ${msg}`);
      }
    }
  }

  // 2) Permanent → відкликаємо invite-link якщо є.
  if (mode === 'permanent' && sub.telegramInviteLink) {
    try {
      await revokeChatInviteLink(settings.chatId, sub.telegramInviteLink);
      inviteRevoked = true;
    } catch (e) {
      const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
      errors.push(`revoke: ${msg}`);
    }
  }

  const skipped = !sub.telegramTgUserId && !inviteRevoked
    ? (sub.telegramInviteLink ? 'no-tg-user-id' : 'no-tg-data')
    : null;

  // 3) Оновлюємо БД. telegramLeftAt — момент кіку (якщо до того не було).
  //    При permanent чистимо invite-link щоб не показувався в адмінці як активний.
  const dbUpdate: Record<string, unknown> = {};
  if (kicked && !sub.telegramLeftAt) dbUpdate.telegramLeftAt = new Date();
  if (mode === 'permanent' && inviteRevoked) dbUpdate.telegramInviteLink = null;
  if (Object.keys(dbUpdate).length > 0) {
    await prisma.yearlyProgramSubscription.update({
      where: { id: subscriptionId },
      data: dbUpdate,
    });
  }

  // 4) Лог події.
  const summary = [
    `mode=${mode}`,
    kicked ? 'kicked=yes' : 'kicked=no',
    mode === 'permanent' ? `revoked=${inviteRevoked ? 'yes' : 'no'}` : null,
    errors.length > 0 ? `errors=${errors.join(' | ')}` : null,
    skipped ? `skipped=${skipped}` : null,
  ].filter(Boolean).join(' · ');
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId,
      type: 'admin_action',
      message: `TG kick (${triggeredBy}) — ${summary}`,
      metadata: { mode, kicked, inviteRevoked, errors, skipped, triggeredBy },
    },
  });

  if (errors.length > 0) {
    return { ok: false, kicked, inviteRevoked, skipped, error: errors.join(' | ') };
  }
  return { ok: true, kicked, inviteRevoked, skipped, error: null };
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
