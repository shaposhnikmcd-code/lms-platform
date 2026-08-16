/// Маркери, якими Telegram-шар Річної програми підписує текст у
/// `YearlyProgramSubscription.telegramInviteError`, і розбір цього поля назад на складові.
///
/// Навіщо: у полі лежать ТРИ різні за суттю ситуації, які раніше зливались в один issue
/// «Telegram API відмовив» з однією кнопкою «Спробувати ще»:
///   1. справжня відмова Bot API (бот не адмін, rate-limit, канал видалено) — invite
///      реально не створений, регенерація доречна;
///   2. заявку на вступ відхилено (лінк спрацював, але особа не збіглася з підпискою) —
///      спершу треба виправити username, регенерація нічого не лікує;
///   3. висяча заявка, яку нікому звірити — рішення ухвалюється в самому каналі.
/// Webhook дописує свої мітки до наявного тексту через `·`, тому поле може містити
/// кілька ситуацій одночасно — звідси split, а не «одна мітка на поле».
///
/// Модуль свідомо без залежностей (ні prisma, ні Bot API): його імпортують і сервісний
/// шар, і webhook, і колектор issue-ів.

/// Незмінна частина мітки про висячу заявку.
export const TG_PENDING_JOIN_MARK = 'Є нерозглянута заявка на вступ';

/// Незмінна частина мітки про відхилену заявку.
export const TG_JOIN_DECLINED_MARK = 'Заявку на вступ відхилено';

/// Історичний формат мітки про відхилену заявку (`Заявка від @x відхилена: …`), яким
/// підписані рядки, записані до введення `TG_JOIN_DECLINED_MARK`. Потрібен, щоб уже
/// наявні в базі помилки теж розкладались по правильних issue-ах.
const TG_JOIN_DECLINED_LEGACY = /Заявка від .{1,80} відхилена:/;

/// Роздільник, яким webhook склеює кілька міток в одному полі.
export const TG_ERROR_SEGMENT_SEPARATOR = ' · ';

/// Тип події, яку пише сервісний шар при невдалій генерації invite-лінка.
/// Колектор бере `createdAt` наймолодшої такої події як час помилки: саме поле
/// `telegramInviteError` часу не зберігає, а `updatedAt` підписки щоночі зсуває
/// синхронізація прогресу SendPulse (заглушений issue «оживав» щоранку).
export const TG_INVITE_FAILED_EVENT_TYPE = 'tg_invite_failed';

/// `metadata.kind` подій webhook-а про заявку на вступ. Пишуться з типом `admin_action`
/// (щоб лягати у стрічку підписки), а колектор бере з них час двох issue-ів — так само,
/// як з `TG_INVITE_FAILED_EVENT_TYPE`.
export const TG_JOIN_DECLINED_EVENT_KIND = 'tg_join_declined_identity';
export const TG_JOIN_PENDING_EVENT_KIND = 'tg_join_pending_identity';

export interface TelegramInviteErrorParts {
  /// Відмова Bot API або наша власна помітка (напр. «username не вказано») — без міток заявок.
  apiError: string | null;
  /// Текст про відхилену заявку.
  declined: string | null;
  /// Текст про висячу заявку.
  pending: string | null;
}

/// Розкладає `telegramInviteError` на три складові за мітками. Сегменти без жодної мітки
/// вважаються відмовою Bot API і склеюються назад у тому ж порядку.
export function splitTelegramInviteError(raw: string | null | undefined): TelegramInviteErrorParts {
  const empty: TelegramInviteErrorParts = { apiError: null, declined: null, pending: null };
  if (!raw || !raw.trim()) return empty;

  const apiParts: string[] = [];
  const declinedParts: string[] = [];
  const pendingParts: string[] = [];
  for (const segment of raw.split(TG_ERROR_SEGMENT_SEPARATOR)) {
    const seg = segment.trim();
    if (!seg) continue;
    if (seg.includes(TG_JOIN_DECLINED_MARK) || TG_JOIN_DECLINED_LEGACY.test(seg)) {
      declinedParts.push(seg);
    } else if (seg.includes(TG_PENDING_JOIN_MARK)) {
      pendingParts.push(seg);
    } else {
      apiParts.push(seg);
    }
  }

  const join = (parts: string[]) => (parts.length > 0 ? parts.join(TG_ERROR_SEGMENT_SEPARATOR) : null);
  return {
    apiError: join(apiParts),
    declined: join(declinedParts),
    pending: join(pendingParts),
  };
}
