/// Webhook бота Річної програми (TELEGRAM_BOT_TOKEN).
/// Обробляє два типи update-ів:
///
///   1. `chat_join_request` — клієнт натиснув invite-link (з `creates_join_request=true`)
///      і чекає підтвердження. Лінк у цьому режимі НЕ одноразовий (Telegram забороняє
///      `member_limit` разом з `creates_join_request`), тому він каже лише «яка підписка»,
///      а особу звіряємо окремо:
///        • invite_link → ЧИННА (ACTIVE/GRACE) підписка. Не знайшли — заявку НЕ чіпаємо
///          (лишається висіти на ручний розгляд менеджера, decline знищив би її назавжди);
///        • автор заявки має збігтись із підпискою (`telegramTgUserId`, а якщо він ще
///          порожній — `telegramUsername` з форми оплати). Не збігся → decline + подія
///          у підписку (тобто переслав лінк другові — друг не зайде);
///        • approve → `telegramJoinedAt` + `telegramTgUserId` (тільки якщо був null!)
///          + best-effort `revokeChatInviteLink` (робить лінк реально одноразовим)
///          + лог події. Фейл approve теж лишає подію з текстом помилки.
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
  revokeChatInviteLink,
  TelegramApiError,
} from '@/lib/telegram';
import { ensureNumericChatId, getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';

const LOG_PREFIX = '[yearly-tg-webhook]';

/// Маркер у `metadata.kind` для подій «заявку відхилено через невідповідність особи».
/// Використовується для дедупу повторних кліків по тому самому лінку.
const JOIN_DECLINED_EVENT_KIND = 'tg_join_declined_identity';

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

  const settingsChatId = await resolveConfiguredChatId();
  if (!settingsChatId) {
    console.warn(`${LOG_PREFIX} chat_join_request: канал не налаштовано (або не резолвиться), ігнор`);
    return;
  }
  if (!chatMatches(settingsChatId, chatId)) {
    console.warn(`${LOG_PREFIX} chat_join_request: chat_id mismatch settings=${settingsChatId} update=${chatId}, ігнор`);
    return;
  }

  // Шукаємо ЧИННУ підписку за invite_link. Фільтр статусу ACTIVE/GRACE — захист від
  // витоку: якщо підписку скасовано/протерміновано (EXPIRED/CANCELLED/ARCHIVED), її старий
  // invite-лінк уже НЕ має пускати в канал (ні власника, ні того, кому переслали). Це і є
  // суть join-request режиму, як описано у «Флоу Річної програми».
  const sub = inviteUrl
    ? await prisma.yearlyProgramSubscription.findFirst({
        where: { telegramInviteLink: inviteUrl, status: { in: ['ACTIVE', 'GRACE'] } },
        select: {
          id: true,
          userId: true,
          telegramJoinedAt: true,
          telegramTgUserId: true,
          telegramUsername: true,
        },
      })
    : null;

  if (!sub) {
    // Заявку по невідомому лінку НЕ декліняємо: decline знищує її остаточно, і адмін уже
    // не зможе підтвердити людину вручну (напр. лектор, партнер, або студент, чия підписка
    // тимчасово не ACTIVE через збій платежу). Лишаємо висіти в «Запити на вступ» —
    // у канал вона сама по собі не пускає, рішення за менеджером.
    console.log(
      `${LOG_PREFIX} невідома заявка — розглянути вручну: user=(${userDesc}) invite=${inviteUrl ?? 'none'} chat=${chatId}`,
    );
    // Найімовірніший власник заявки — студент з таким же username у чинній підписці
    // (лінк протермінувався, або він зайшов через primary-лінк каналу). Це лише здогад,
    // тому НІЧОГО не підтверджуємо і не прив'язуємо `telegramTgUserId` — просто лишаємо
    // слід у «Помилках», щоб менеджер побачив висячу заявку і розглянув її вручну.
    await flagPendingJoinRequest(joinReq.from);
    return;
  }

  // === Перевірка «це справді власник підписки?» ===
  // Invite-link у режимі заявок НЕ одноразовий (Telegram не дозволяє member_limit разом з
  // creates_join_request), тож студент може переслати його комусь. Тому лінк — це лише
  // «яка підписка», а не «хто саме»; особу звіряємо окремо.
  const identity = checkJoinIdentity(sub, joinReq.from);
  if (!identity.ok) {
    await declineJoin(chatId, userId, `identity mismatch sub=${sub.id} · ${identity.reason}`);

    // Дедуп: людина може тиснути «Приєднатись» десятки разів поспіль — не засмічуємо
    // ні стрічку подій, ні БД зайвими UPDATE-ами. Одна подія + один запис помилки
    // на (підписка, tg-користувач) за годину.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const dupe = await prisma.yearlyProgramSubscriptionEvent.findFirst({
      where: {
        subscriptionId: sub.id,
        type: 'admin_action',
        createdAt: { gte: hourAgo },
        AND: [
          { metadata: { path: ['kind'], equals: JOIN_DECLINED_EVENT_KIND } },
          { metadata: { path: ['tgUserId'], equals: String(userId) } },
        ],
      },
      select: { id: true },
    });
    if (dupe) {
      console.log(`${LOG_PREFIX} decline event deduped sub=${sub.id} user=${userId}`);
      return;
    }

    // Найчастіша причина mismatch — не витік лінка, а друкарська помилка в username
    // на платіжній формі. Без сліду в адмінці студент клікав би вічно і мовчки.
    // `telegramInviteError` показується у вкладці «Помилки» → менеджер бачить і виправляє.
    // Очищається сам при наступній успішній генерації інвайта (generateInviteForSubscription).
    await prisma.yearlyProgramSubscription.update({
      where: { id: sub.id },
      data: {
        telegramInviteError: `Заявка від ${joinReq.from.username ? `@${joinReq.from.username}` : `id=${userId}`} відхилена: ${identity.reason} — ${
          identity.kind === 'username'
            ? 'перевір username у підписці (можлива друкарська помилка у формі оплати)'
            : 'посиланням скористалась інша людина; згенеруй новий інвайт для студента'
        }`.slice(0, 500),
      },
    });

    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `Telegram: заявка відхилена — ${identity.reason}`,
        metadata: {
          kind: JOIN_DECLINED_EVENT_KIND,
          tgUserId: String(userId),
          tgUserDesc: userDesc,
          tgUsername: joinReq.from.username ? `@${joinReq.from.username}` : null,
          expectedUsername: sub.telegramUsername,
          expectedTgUserId: sub.telegramTgUserId ? String(sub.telegramTgUserId) : null,
          inviteLink: inviteUrl,
          chatId: String(chatId),
          reason: identity.reason,
        },
      },
    });
    return;
  }

  // === Approve ===
  // Помилка approve (людина вже в каналі, 429 flood-wait тощо) НЕ має лишати нас без сліду:
  // прив'язку tgUserId + подію пишемо в обох випадках, у метадані — текст помилки.
  let approveError: string | null = null;
  try {
    await approveChatJoinRequest(chatId, userId);
    console.log(`${LOG_PREFIX} approved sub=${sub.id} user=${userId}`);
  } catch (e) {
    approveError = e instanceof TelegramApiError ? `[${e.errorCode}] ${e.message}` : (e instanceof Error ? e.message : String(e));
    console.error(`${LOG_PREFIX} approve failed sub=${sub.id} user=${userId}: ${approveError}`);
  }

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      telegramJoinedAt: sub.telegramJoinedAt ?? new Date(),
      // Скидаємо «вийшов» тільки коли approve справді пройшов.
      ...(approveError ? {} : { telegramLeftAt: null }),
      // Пишемо ТІЛЬКИ якщо порожньо: перезапис чужим id зламав би «Вилучити з каналу»
      // (забанили б не ту людину). Якщо вже заповнено — воно вже звірене вище.
      ...(sub.telegramTgUserId === null ? { telegramTgUserId: BigInt(userId) } : {}),
    },
  });

  // Робимо лінк реально одноразовим — саме це обіцяє welcome-лист («діє лише для вас»).
  // Best-effort: фейл revoke не скасовує вдалий approve. При невдалому approve лінк НЕ
  // чіпаємо — інакше студент після 429 лишився б і без каналу, і без робочого посилання.
  let inviteRevoked = false;
  let revokeError: string | null = null;
  if (inviteUrl && !approveError) {
    try {
      await revokeChatInviteLink(settingsChatId, inviteUrl);
      inviteRevoked = true;
      // Відкликаний лінк мертвий — прибираємо з БД, інакше ідемпотентний
      // generateInviteForSubscription віддав би його у наступні листи, а «повернути
      // в канал» з адмінки обіцяло б вхід по посиланню, яке вже не працює.
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { telegramInviteLink: null },
      });
    } catch (e) {
      revokeError = e instanceof TelegramApiError ? `[${e.errorCode}] ${e.message}` : (e instanceof Error ? e.message : String(e));
      console.warn(`${LOG_PREFIX} revoke failed sub=${sub.id} invite=${inviteUrl}: ${revokeError}`);
    }
  }

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: approveError
        ? `Telegram: approve заявки не вдався — ${approveError}`
        : `Telegram: клієнт приєднався в канал (auto-approved)${identity.unverified ? ' · username у підписці не вказано, приналежність не перевірена' : ''}`,
      metadata: {
        tgUserId: String(userId),
        tgUserDesc: userDesc,
        inviteLink: inviteUrl,
        chatId: String(chatId),
        approveError,
        inviteRevoked,
        revokeError,
        identityUnverified: identity.unverified,
      },
    },
  });
}

/// Звіряє автора заявки з даними підписки.
///   • `telegramTgUserId` заповнений → це єдиний авторитетний критерій (id незмінний,
///     на відміну від username, який людина може перейменувати).
///   • інакше → порівнюємо username із форми оплати (без `@`, case-insensitive).
///   • username у підписці порожній (legacy/manual-add без handle) → перевірити нічим,
///     пропускаємо, але помічаємо `unverified` для сліду в подіях.
function checkJoinIdentity(
  sub: { telegramTgUserId: bigint | null; telegramUsername: string | null },
  from: TgUser,
): { ok: true; unverified: boolean } | { ok: false; reason: string; kind: 'tg_id' | 'username' } {
  const fromHandle = (from.username ?? '').replace(/^@/, '').toLowerCase();

  if (sub.telegramTgUserId !== null) {
    if (sub.telegramTgUserId === BigInt(from.id)) return { ok: true, unverified: false };
    return {
      ok: false,
      kind: 'tg_id',
      reason: `tg id не збігається (підписка: ${sub.telegramTgUserId}, заявка: ${from.id}${fromHandle ? `, @${fromHandle}` : ''})`,
    };
  }

  const expected = (sub.telegramUsername ?? '').replace(/^@/, '').toLowerCase();
  if (!expected) return { ok: true, unverified: true };
  if (expected === fromHandle) return { ok: true, unverified: false };
  return {
    ok: false,
    kind: 'username',
    reason: `username не збігається (очікували @${sub.telegramUsername?.replace(/^@/, '')}, заявка від ${fromHandle ? `@${fromHandle}` : `id=${from.id} без username`})`,
  };
}

/// Read-only слід про висячу заявку: шукає ЧИННУ підписку за username автора і пише їй
/// `telegramInviteError` (видно у вкладці «Помилки»). Нічого не підтверджує і не прив'язує.
/// `updateMany` з `not: message` — щоб десяток повторних кліків не давав десяток UPDATE-ів.
async function flagPendingJoinRequest(from: TgUser): Promise<void> {
  const handle = (from.username ?? '').replace(/^@/, '');
  if (!handle) return;

  const sub = await prisma.yearlyProgramSubscription.findFirst({
    where: {
      status: { in: ['ACTIVE', 'GRACE'] },
      OR: [
        { telegramUsername: { equals: `@${handle}`, mode: 'insensitive' } },
        { telegramUsername: { equals: handle, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!sub) return;

  const message = `Є нерозглянута заявка на вступ від @${handle} — перевірте вручну в каналі`;
  const res = await prisma.yearlyProgramSubscription.updateMany({
    where: {
      id: sub.id,
      // `not` на nullable-полі не ловить NULL — тому NULL перелічений окремо.
      OR: [{ telegramInviteError: null }, { telegramInviteError: { not: message } }],
    },
    data: { telegramInviteError: message },
  });
  if (res.count > 0) {
    console.log(`${LOG_PREFIX} висяча заявка позначена у підписці sub=${sub.id} (@${handle})`);
  }
}

async function declineJoin(chatId: number, userId: number, context: string): Promise<void> {
  try {
    await declineChatJoinRequest(chatId, userId);
    console.log(`${LOG_PREFIX} declined — ${context}`);
  } catch (e) {
    const msg = e instanceof TelegramApiError ? `[${e.errorCode}] ${e.message}` : (e instanceof Error ? e.message : String(e));
    console.error(`${LOG_PREFIX} decline failed user=${userId} (${context}): ${msg}`);
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

  const settingsChatId = await resolveConfiguredChatId();
  if (!settingsChatId) return;
  if (!chatMatches(settingsChatId, chatId)) return;

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
        // Тільки якщо порожньо — прив'язку, зроблену раніше, не перетираємо (див. findSubscriptionForMember).
        ...(sub.telegramTgUserId === null ? { telegramTgUserId: BigInt(targetUser.id) } : {}),
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
///
/// Lookup-и 2 і 3 не ідентифікують людину напряму (лінк можна переслати, username —
/// перейменувати), тому підписку з уже прив'язаним ЧУЖИМ `telegramTgUserId` вони не
/// повертають: інакше подія «вийшов з каналу» від сторонньої людини приписалась би студенту.
async function findSubscriptionForMember(
  tgUserId: number,
  inviteUrl: string | null,
  tgUsername: string | null,
): Promise<{ id: string; userId: string; telegramTgUserId: bigint | null } | null> {
  const byTgId = await prisma.yearlyProgramSubscription.findFirst({
    where: { telegramTgUserId: BigInt(tgUserId) },
    select: { id: true, userId: true, telegramTgUserId: true },
  });
  if (byTgId) return byTgId;

  // Сюди дійшли → підписки з таким tgUserId немає, отже будь-яка знайдена нижче
  // з непорожнім telegramTgUserId прив'язана до ІНШОЇ людини.
  if (inviteUrl) {
    const byInvite = await prisma.yearlyProgramSubscription.findFirst({
      where: { telegramInviteLink: inviteUrl, telegramTgUserId: null },
      select: { id: true, userId: true, telegramTgUserId: true },
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
        telegramTgUserId: null,
        OR: [
          { telegramUsername: { equals: handleWithAt, mode: 'insensitive' } },
          { telegramUsername: { equals: handleNoAt, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, telegramTgUserId: true },
    });
  }

  return null;
}

/// Повертає numeric chat_id налаштованого каналу (або null, якщо канал не заданий /
/// не резолвиться). `@username` у settings резолвиться у число разово і перезаписується —
/// без цього ми не могли б відрізнити наш канал від будь-якого іншого чату, де бот адмін.
async function resolveConfiguredChatId(): Promise<string | null> {
  const settings = await getYearlyProgramTelegramSettings();
  return ensureNumericChatId(settings.chatId);
}

/// Строге порівняння numeric chat_id з update-у зі збереженим у settings.
/// Не-numeric значення сюди вже не доходять (див. `resolveConfiguredChatId`).
function chatMatches(settingsChatId: string, updateChatId: number): boolean {
  return settingsChatId === String(updateChatId);
}
