/// Webhook бота Річної програми (TELEGRAM_BOT_TOKEN).
/// Обробляє два типи update-ів:
///
///   1. `chat_join_request` — клієнт натиснув invite-link (з `creates_join_request=true`)
///      і чекає підтвердження.
///        • Якщо invite_link збігається з telegramInviteLink якоїсь підписки →
///          `approveChatJoinRequest` + `telegramJoinedAt = now` + `telegramLeftAt = null`
///          + лог події.
///        • Інакше (рандомна людина не з Річної) → `declineChatJoinRequest`.
///
///   2. `chat_member` — статус учасника каналу змінився (приєднався/вийшов/кікнутий).
///      Дозволяє трекати lifecycle:
///        • member → left/kicked/restricted: `telegramLeftAt = now`. Підпискою
///          ідентифікуємо за userId (нам потрібен зв'язок tgUserId → sub).
///        • left/kicked → member (rejoin без join-request, наприклад primary-link
///          у режимі без approval): `telegramJoinedAt = now`, `telegramLeftAt = null`.
///        Без створення подій якщо ми не маємо поточної прив'язки до підписки.
///
/// Endpoint URL (зареєструвати разово через scripts/setup-yearly-program-telegram-webhook.mjs):
///   https://uimp.com.ua/api/telegram/yearly-program-webhook
///
/// Telegram повторно надсилає update-и при 5xx → завжди повертаємо 200, помилки логуємо.
///
/// ⚠️ Не плутати з `/api/telegram/connector-webhook` — то інший бот (@connectorgame_bot).

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  approveChatJoinRequest,
  declineChatJoinRequest,
  TelegramApiError,
} from '@/lib/telegram';
import { getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';

const LOG_PREFIX = '[yearly-tg-webhook]';

interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TgChat {
  id: number;
  type: 'group' | 'supergroup' | 'channel' | 'private';
  title?: string;
}

interface TgChatJoinRequest {
  chat: TgChat;
  from: TgUser;
  date: number;
  invite_link?: { invite_link: string; name?: string; creates_join_request?: boolean };
}

type TgChatMemberStatus = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';

interface TgChatMember {
  user: TgUser;
  status: TgChatMemberStatus;
}

interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  date: number;
  old_chat_member: TgChatMember;
  new_chat_member: TgChatMember;
  invite_link?: { invite_link: string; name?: string; creates_join_request?: boolean };
}

interface TgUpdate {
  update_id?: number;
  chat_join_request?: TgChatJoinRequest;
  chat_member?: TgChatMemberUpdated;
}

function describeUser(user: TgUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const handle = user.username ? `@${user.username}` : null;
  return [name, handle, `id=${user.id}`].filter(Boolean).join(' · ');
}

function isInChat(status: TgChatMemberStatus): boolean {
  return status === 'creator' || status === 'administrator' || status === 'member';
}

function leftChat(status: TgChatMemberStatus): boolean {
  return status === 'left' || status === 'kicked' || status === 'restricted';
}

export async function POST(req: NextRequest) {
  // === 1. Верифікація секрета ===
  const expectedSecret = process.env.TELEGRAM_YEARLY_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error(`${LOG_PREFIX} TELEGRAM_YEARLY_WEBHOOK_SECRET не заданий`);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  const got = req.headers.get('x-telegram-bot-api-secret-token');
  if (got !== expectedSecret) {
    console.warn(`${LOG_PREFIX} Невірний secret token`);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch (e) {
    console.error(`${LOG_PREFIX} JSON parse failed:`, e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Сортуємо update-и за типом — для кожного окрема логіка.
  if (update.chat_join_request) {
    await handleChatJoinRequest(update.chat_join_request);
  } else if (update.chat_member) {
    await handleChatMemberUpdated(update.chat_member);
  } else {
    // Інші типи update-ів зараз не обробляємо. Telegram буде надсилати тільки
    // ті що в allowed_updates (chat_join_request + chat_member).
    console.log(`${LOG_PREFIX} ignoring unknown update type, keys=${Object.keys(update).join(',')}`);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

/// === Handler 1: Запит на приєднання (creates_join_request invite click) ===
async function handleChatJoinRequest(joinReq: TgChatJoinRequest): Promise<void> {
  const chatId = joinReq.chat.id;
  const userId = joinReq.from.id;
  const inviteUrl = joinReq.invite_link?.invite_link ?? null;
  const userDesc = describeUser(joinReq.from);

  console.log(`${LOG_PREFIX} chat_join_request received: chat=${chatId} user=(${userDesc}) invite=${inviteUrl ?? 'none'}`);

  const settings = await getYearlyProgramTelegramSettings();
  if (!settings.chatId) {
    console.warn(`${LOG_PREFIX} chat_join_request: канал не налаштовано, ігнор`);
    return;
  }
  if (!chatMatches(settings.chatId, chatId)) {
    console.warn(`${LOG_PREFIX} chat_join_request: chat_id mismatch settings=${settings.chatId} update=${chatId}, ігнор`);
    return;
  }

  // Шукаємо ЧИННУ підписку за invite_link. Фільтр статусу ACTIVE/GRACE — захист від
  // витоку: якщо підписку скасовано/протерміновано (EXPIRED/CANCELLED/ARCHIVED), її старий
  // invite-лінк уже НЕ має пускати в канал (ні власника, ні того, кому переслали). Це і є
  // суть join-request режиму, як описано у «Флоу Річної програми».
  const sub = inviteUrl
    ? await prisma.yearlyProgramSubscription.findFirst({
        where: { telegramInviteLink: inviteUrl, status: { in: ['ACTIVE', 'GRACE'] } },
        select: { id: true, userId: true, telegramJoinedAt: true },
      })
    : null;

  if (sub) {
    try {
      await approveChatJoinRequest(chatId, userId);
      console.log(`${LOG_PREFIX} approved sub=${sub.id} user=${userId}`);
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: {
          telegramJoinedAt: sub.telegramJoinedAt ?? new Date(),
          telegramLeftAt: null,
          telegramTgUserId: BigInt(userId),
        },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: 'Telegram: клієнт приєднався в канал (auto-approved)',
          metadata: {
            tgUserId: String(userId),
            tgUserDesc: userDesc,
            inviteLink: inviteUrl,
            chatId: String(chatId),
          },
        },
      });
    } catch (e) {
      const msg = e instanceof TelegramApiError ? `[${e.errorCode}] ${e.message}` : (e instanceof Error ? e.message : String(e));
      console.error(`${LOG_PREFIX} approve failed sub=${sub.id} user=${userId}: ${msg}`);
    }
    return;
  }

  // Не знайшли ЧИННОЇ підписки — або стороння людина, або підписка вже неактивна
  // (скасована/протермінована). Канал тільки для активної Річної → decline.
  try {
    await declineChatJoinRequest(chatId, userId);
    console.log(`${LOG_PREFIX} declined (no active sub) user=(${userDesc}) invite=${inviteUrl ?? 'none'}`);
  } catch (e) {
    const msg = e instanceof TelegramApiError ? `[${e.errorCode}] ${e.message}` : (e instanceof Error ? e.message : String(e));
    console.error(`${LOG_PREFIX} decline failed user=${userId}: ${msg}`);
  }
}

/// === Handler 2: Зміна статусу учасника (chat_member) ===
/// Telegram присилає це коли users joins/leaves/gets-kicked у каналах де бот адмін.
/// Дозволяє трекати leave для статусу в адмінці.
async function handleChatMemberUpdated(upd: TgChatMemberUpdated): Promise<void> {
  const chatId = upd.chat.id;
  const oldStatus = upd.old_chat_member.status;
  const newStatus = upd.new_chat_member.status;
  const targetUser = upd.new_chat_member.user;
  const userDesc = describeUser(targetUser);

  // Боти-учасники нас не цікавлять.
  if (targetUser.is_bot) return;

  // Перехід без зміни (admin promotion etc) — пропускаємо.
  if (oldStatus === newStatus) return;

  const settings = await getYearlyProgramTelegramSettings();
  if (!settings.chatId) return;
  if (!chatMatches(settings.chatId, chatId)) return;

  // Знаходимо підписку трьома lookup-ами в порядку спадання надійності:
  //   1. telegramTgUserId — найточніше (тільки в нас, точно за TG ID).
  //   2. invite_link з update-у — якщо клієнт зайшов саме через наш link.
  //   3. telegramUsername — fallback, коли клієнт клікнув старий лист або зайшов
  //      через primary link каналу. Username клієнт указував у payment-формі.
  const sub = await findSubscriptionForMember(
    targetUser.id,
    upd.invite_link?.invite_link ?? null,
    targetUser.username ?? null,
  );

  if (!sub) {
    // Сторонній учасник (admin додав вручну, чи власник). Логуємо коротко.
    if (leftChat(newStatus) && isInChat(oldStatus)) {
      console.log(`${LOG_PREFIX} chat_member: non-tracked user left (${userDesc}) ${oldStatus}→${newStatus}`);
    } else if (isInChat(newStatus) && leftChat(oldStatus)) {
      console.log(`${LOG_PREFIX} chat_member: non-tracked user joined (${userDesc}) ${oldStatus}→${newStatus}`);
    }
    return;
  }

  // === Випадок: вийшов або був виключений ===
  if (isInChat(oldStatus) && leftChat(newStatus)) {
    console.log(`${LOG_PREFIX} chat_member: tracked user LEFT sub=${sub.id} (${userDesc}) ${oldStatus}→${newStatus}`);
    await prisma.yearlyProgramSubscription.update({
      where: { id: sub.id },
      data: { telegramLeftAt: new Date() },
    });
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `Telegram: клієнт ${newStatus === 'kicked' ? 'виключений' : newStatus === 'restricted' ? 'обмежений' : 'покинув канал'}`,
        metadata: {
          tgUserId: String(targetUser.id),
          tgUserDesc: userDesc,
          oldStatus,
          newStatus,
          chatId: String(chatId),
        },
      },
    });
    return;
  }

  // === Випадок: повернувся (без проходження через approve, наприклад через primary link) ===
  if (leftChat(oldStatus) && isInChat(newStatus)) {
    console.log(`${LOG_PREFIX} chat_member: tracked user REJOINED sub=${sub.id} (${userDesc}) ${oldStatus}→${newStatus}`);
    await prisma.yearlyProgramSubscription.update({
      where: { id: sub.id },
      data: {
        telegramJoinedAt: new Date(),
        telegramLeftAt: null,
        telegramTgUserId: BigInt(targetUser.id),
      },
    });
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: 'Telegram: клієнт знову у каналі',
        metadata: {
          tgUserId: String(targetUser.id),
          tgUserDesc: userDesc,
          oldStatus,
          newStatus,
          chatId: String(chatId),
        },
      },
    });
  }
}

/// Знаходить підписку учасника каналу. Три послідовних lookup-и:
///   1. За `telegramTgUserId` — найшвидше і найточніше. Заповнюється при першому
///      approve або при rejoin-fallback тут.
///   2. За `telegramInviteLink` з update-у — спрацьовує коли учасник зайшов
///      саме через наш bot-generated invite (Telegram кладе link у update).
///   3. За `telegramUsername` — fallback: клієнт міг клікнути старий лист
///      (link уже не в DB) або зайти через primary link каналу. Username
///      клієнт сам вказав у payment-формі. Беремо найсвіжішу його підписку
///      (одна людина може мати кілька підписок історично).
async function findSubscriptionForMember(
  tgUserId: number,
  inviteUrl: string | null,
  tgUsername: string | null,
): Promise<{ id: string; userId: string } | null> {
  const byTgId = await prisma.yearlyProgramSubscription.findFirst({
    where: { telegramTgUserId: BigInt(tgUserId) },
    select: { id: true, userId: true },
  });
  if (byTgId) return byTgId;

  if (inviteUrl) {
    const byInvite = await prisma.yearlyProgramSubscription.findFirst({
      where: { telegramInviteLink: inviteUrl },
      select: { id: true, userId: true },
    });
    if (byInvite) return byInvite;
  }

  if (tgUsername) {
    // У DB зберігається з префіксом "@" (нормалізовано формою). Telegram update
    // присилає без "@". Тому шукаємо у двох форматах + case-insensitive.
    const handleWithAt = `@${tgUsername.replace(/^@/, '')}`;
    const handleNoAt = tgUsername.replace(/^@/, '');
    return prisma.yearlyProgramSubscription.findFirst({
      where: {
        OR: [
          { telegramUsername: { equals: handleWithAt, mode: 'insensitive' } },
          { telegramUsername: { equals: handleNoAt, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true },
    });
  }

  return null;
}

/// settings.chatId може бути numeric ("-100...") або "@username".
/// Update присилає numeric chat.id → порівнюємо обидва формати.
function chatMatches(settingsChatId: string, updateChatId: number): boolean {
  if (/^-?\d+$/.test(settingsChatId)) return settingsChatId === String(updateChatId);
  // @username: довіряємо Telegram (він не присилає update-и для каналів де бот не адмін).
  return settingsChatId.startsWith('@');
}
