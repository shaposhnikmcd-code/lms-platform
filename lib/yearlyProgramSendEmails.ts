/// Shared логіка bulk-розсилки welcome-листа cohort-у.
///
/// Викликається з трьох місць:
///   1. POST /api/admin/yearly-program/cohorts/[id]/send-emails — кнопка "Дослати лист"
///      у CohortActions (per-recipient resend або повторна bulk-розсилка).
///   2. POST /api/admin/yearly-program/cohorts/[id]/launch — режим "запустити зараз"
///      з опцією `sendEmailsTogether=true` (default ON у LaunchProgramModal).
///   3. /api/cron/yearly-subscriptions — щоденний обхід (a) запланованих launch-ів,
///      які мають `emailScheduledFor` на ту ж дату, (b) самостійних запланованих розсилок.
///
/// Dedup-контракт: для кожного успішно надісланого листа створюється
/// `YearlyProgramSubscriptionEvent { type: 'launch_email_sent', metadata.cohortId }`.
/// Перед надсиланням перевіряємо, чи такий event уже існує — якщо так, пропускаємо.
/// `force=true` ігнорує dedup (per-recipient resend або bulk-override від менеджера).
///
/// Telegram: якщо канал налаштований і autoAdd увімкнено, до кожного листа додається блок
/// з invite-кнопкою (`renderTelegramInviteEmailBlock`). Лінк перегенеровується, якщо його
/// немає або він старший за 25 днів — інакше покупці, що оплатили за місяці до запуску,
/// отримали б протермінований (30 днів) лінк.
///
/// Контракт `emailSentAt`: семантика — «масову розсилку по набору РОЗПОЧАТО». Ставиться
/// перед першим реальним надсиланням (без `targetIds`), а не після повного проходу.
/// Причина: `heal_missing_welcome_email` у нічному cron-і вимагає `emailSentAt != null`,
/// тож при обриві посеред розсилки (таймаут функції) частина людей лишалась без листа
/// НАЗАВЖДИ — планова розсилка вже не спрацює, а heal їх не бачить. Тепер обрив штатний:
/// прапорець стоїть, і heal досилає пропущених.
/// Набір без жодного кваліфікованого одержувача таймстемп НЕ отримує — інакше запланована
/// розсилка «згоріла» б, нічого не надіславши.
/// Per-recipient resend не зачіпає cohort-таймстемп — він репрезентує "коли по cohort-у
/// пройшла масова розсилка".

import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';
import { sleep } from '@/lib/telegram';
import {
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
  recordInviteFailure,
  renderTelegramInviteEmailBlock,
} from '@/lib/yearlyProgramTelegram';

/// Invite-лінк живе 30 днів (`createChatInviteLink`, expireSeconds). Все, що старше 25 днів,
/// у масовій розсилці перегенеровуємо: покупці квітня–червня інакше отримали б на дату
/// запуску мертве посилання.
const INVITE_MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000;

/// Пауза між послідовними спробами генерації invite-лінка в масовій розсилці —
/// щадить rate-limit Bot API (heal-крок і масовий launch добивають десятки інвайтів
/// підряд). `createChatInviteLinkWithRetry` уже ретраїть одиничний 429, ця пауза
/// зменшує сам шанс на нього при пачковій генерації.
const INVITE_GENERATION_PACE_MS = 1200;

/// Скільки часу до `deadlineAt` треба лишати НЕ зайнятим генерацією invite-а. Один виклик
/// може всередині ретраїти 429 і чекати до `(CREATE_INVITE_MAX_RETRY_WAIT_SECONDS + 1)с`
/// (≈31с) — без запасу такий ретрай сам зжер би м'який дедлайн проходу і забрав час у
/// решти підписок черги (чи навіть у листа цієї самої людини).
const INVITE_GENERATION_DEADLINE_GUARD_MS = 45 * 1000;

export interface SendLaunchEmailsCohort {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  launchEmailSubject: string | null;
  launchEmailBody: string | null;
}

export interface SendLaunchEmailsResult {
  subscriptionId: string;
  email: string;
  sent: boolean;
  /// Set коли стався справжній збій SMTP/Resend (counter `failed`).
  error?: string;
  /// Set коли підписку свідомо пропущено — НЕ помилка (counter `skipped`).
  ///   no_email          → у юзера відсутній email
  ///   already_sent      → welcome-лист цього cohort-у вже надсилався (dedup)
  ///   no_paid_payments  → підписка є, але платіж ще не пройшов
  ///   no_access_opened  → доступ у SendPulse ще не відкрито (лист стверджує зворотнє)
  skipped?: 'no_email' | 'already_sent' | 'no_paid_payments' | 'no_access_opened';
  /// `true` якщо в лист вкладено кнопку Telegram-каналу зі свіжим invite-лінком.
  telegramInvite?: boolean;
}

export interface SendLaunchEmailsSummary {
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  results: SendLaunchEmailsResult[];
  /// Розсилку зупинено штатно за м'яким дедлайном (ліміт функції). `remaining` — скільки
  /// підписок реально отримали б лист (без тих, кого скіп-чеки все одно відсіяли б).
  /// Решту добирає нічний `heal_missing_welcome_email` — саме тому `emailSentAt`
  /// виставляється на СТАРТІ розсилки.
  interrupted?: { reason: 'deadline'; remaining: number };
}

export interface SendLaunchEmailsOptions {
  /// Ігнорує dedup-перевірку (повторна відправка тим, хто вже отримав).
  /// Set автоматично якщо передані `targetIds` — per-recipient resend завжди явний вибір.
  force?: boolean;
  /// Якщо передано — шлемо тільки цим підпискам (для per-recipient resend).
  /// `null`/`undefined` — bulk-розсилка всім PENDING/ACTIVE/GRACE підпискам cohort-у.
  targetIds?: string[] | null;
  /// Лейбл актора для логу events (email менеджера, "scheduled-cron", "auto-launch").
  actorLabel: string;
  /// Звідки прийшла розсилка — записується у `event.metadata.source` для аудиту.
  /// "manager" (через UI кнопкою), "launch" (одночасно з запуском), "cron" (scheduled).
  source: 'manager' | 'launch' | 'cron';
  /// М'який дедлайн: коли час вийшов, цикл зупиняється ШТАТНО з partial-звітом замість
  /// того, щоб платформа зарубала функцію посеред відправки. Той самий дедлайн, що й у
  /// циклі запуску — обидва живуть у спільному ліміті одного HTTP-виклику / cron-проходу.
  deadlineAt?: Date | null;
}

/// Виконує bulk-розсилку welcome-листа всім кваліфікованим підпискам cohort-у.
/// Sequential через Resend API rate limit; повертає підсумок з per-recipient результатами.
export async function sendCohortLaunchEmails(
  cohort: SendLaunchEmailsCohort,
  opts: SendLaunchEmailsOptions,
): Promise<SendLaunchEmailsSummary> {
  const force = opts.force === true || (Array.isArray(opts.targetIds) && opts.targetIds.length > 0);
  const targetIds = Array.isArray(opts.targetIds) && opts.targetIds.length > 0 ? opts.targetIds : null;

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
      ...(targetIds ? { id: { in: targetIds } } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      // Тягнемо payments щоб у per-sub циклі скіпнути тих, хто ще не оплатив
      // (симетрично з executeLaunchLoop). Welcome-лист "вітаємо у програмі" не має
      // йти неоплаченим — навіть якщо менеджер натиснув "Дослати лист".
      payments: { select: { status: true } },
      events: {
        where: { type: 'launch_email_sent' },
        select: { id: true, metadata: true },
      },
    },
  });

  const subjectTpl = cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const bodyTpl = cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;

  // Telegram-налаштування читаємо один раз на всю розсилку (singleton-рядок).
  const tgSettings = await getYearlyProgramTelegramSettings();
  const tgActive = Boolean(tgSettings.autoAdd && tgSettings.chatId);

  const results: SendLaunchEmailsResult[] = [];
  let interrupted: SendLaunchEmailsSummary['interrupted'];
  // Пауза між генераціями має сенс лише при пачковій обробці — одиничний
  // per-recipient resend («Дослати лист» на одну людину) не має чекати зайву секунду.
  const shouldPaceInvites = subs.length > 1;

  const hasLaunchEmailEvent = (s: (typeof subs)[number]) =>
    s.events.some((ev) => (ev.metadata as { cohortId?: string } | null)?.cohortId === cohort.id);

  /// Чи підписка реально отримала б лист — дзеркалить скіп-чеки нижче. Потрібно, щоб
  /// `interrupted.remaining` показував роботу, а не кількість необійдених рядків.
  const wouldBeSent = (s: (typeof subs)[number]) => {
    if (!s.user?.email) return false;
    if (!s.payments.some((p) => p.status === 'PAID')) return false;
    if (!s.sendpulseAccessOpenedAt) return false;
    if (!force && hasLaunchEmailEvent(s)) return false;
    return true;
  };

  // «Масову розсилку розпочато» — ставиться перед ПЕРШИМ реальним надсиланням (див.
  // контракт `emailSentAt` у шапці файлу). Прапорець у пам'яті, щоб не бити в БД на
  // кожній ітерації.
  let bulkStartMarked = false;
  const markBulkStarted = async () => {
    if (targetIds || bulkStartMarked) return;
    bulkStartMarked = true;
    await prisma.yearlyProgramCohort.update({
      where: { id: cohort.id },
      data: { emailSentAt: new Date(), emailScheduledFor: null },
    });
  };

  for (const [idx, s] of subs.entries()) {
    // М'який дедлайн: віддати чесний partial-звіт краще, ніж бути зарубаним посеред
    // відправки. Ті, кому не встигли, лишаються без події `launch_email_sent` — їх
    // добирає нічний `heal_missing_welcome_email`.
    if (opts.deadlineAt && Date.now() >= opts.deadlineAt.getTime()) {
      const remaining = subs.slice(idx).filter(wouldBeSent).length;
      interrupted = { reason: 'deadline', remaining };
      console.warn(`[yearly-launch-email] cohort ${cohort.id}: м'який дедлайн, оброблено ${idx}/${subs.length}, лишилось у роботі ${remaining}`);
      break;
    }
    if (!s.user?.email) {
      results.push({ subscriptionId: s.id, email: '', sent: false, skipped: 'no_email' });
      continue;
    }

    // Skip-чек № 1: підписка без PAID-платежу. Welcome-лист про "ви в програмі"
    // не має йти неоплаченим — навіть на manager-trigger. Targeted resend (`force`)
    // НЕ обходить це: відправити лист тому, хто не платив, було б помилкою UX.
    const hasPaid = s.payments.some((p) => p.status === 'PAID');
    if (!hasPaid) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'no_paid_payments' });
      continue;
    }

    // Skip-чек № 2: доступ у SendPulse ще не відкрито. Текст листа стверджує «доступ
    // відкрито» і веде на платформу — відправити його раніше за реальне відкриття означає
    // послати людину в нікуди. Force (targeted resend) це НЕ обходить: спершу треба
    // полагодити відкриття доступу («Екстра Запуск»), потім слати лист.
    if (!s.sendpulseAccessOpenedAt) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'no_access_opened' });
      continue;
    }

    if (hasLaunchEmailEvent(s) && !force) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'already_sent' });
      continue;
    }

    // Одержувач кваліфікований — з цієї миті розсилка вважається розпочатою.
    await markBulkStarted();

    const { subject, body } = renderLaunchEmailTemplate({
      subject: subjectTpl,
      body: bodyTpl,
      variables: {
        name: s.user.name,
        email: s.user.email,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        cohortName: cohort.name,
      },
    });

    // Telegram-кнопка у лист. Лінк має бути ЖИВИЙ на момент відправки: якщо його немає
    // або він старший за 25 днів — перегенеровуємо (force сам відкликає старий).
    // Жодна проблема з Telegram не має валити розсилку: `generateInviteForSubscription`
    // повертає {ok:false} на помилки Bot API, але може й кинути (збій БД при записі
    // події/лінка) — тоді без catch обірвалась би вся ітерація по підписках.
    // Будь-який збій → лист іде без кнопки, причина осідає в `telegramInviteError`.
    let telegramInviteLink: string | null = null;
    if (tgActive && s.telegramUsername) {
      const stale =
        !s.telegramInviteLink ||
        !s.telegramInvitedAt ||
        Date.now() - s.telegramInvitedAt.getTime() > INVITE_MAX_AGE_MS;
      // Лише коли реально збираємось іти в Bot API (stale/force): ідемпотентне повернення
      // вже наявного лінка виклику не робить, дедлайн йому не заважає.
      const msLeftToDeadline = opts.deadlineAt ? opts.deadlineAt.getTime() - Date.now() : null;
      const tooCloseToDeadline =
        stale && msLeftToDeadline != null && msLeftToDeadline < INVITE_GENERATION_DEADLINE_GUARD_MS;

      if (tooCloseToDeadline) {
        // До дедлайну проходу лишилось замало, щоб безпечно пережити можливий ретрай на
        // 429 усередині createChatInviteLinkWithRetry (до ~31с). Лист іде без кнопки —
        // той самий слід, що лишає звичайна відмова Bot API, тож TG_INVITE_FAILED
        // підніметься однаково і менеджер побачить причину.
        const err = 'Пропущено — до дедлайну проходу лишалось < 45с';
        try {
          await prisma.yearlyProgramSubscription.update({
            where: { id: s.id },
            data: { telegramInviteError: err },
          });
          await recordInviteFailure(s.id, err, `cohort-launch-email:${opts.actorLabel}`);
        } catch (e) {
          console.error(`[yearly-launch-email] deadline-guard event write failed sub=${s.id}:`, e);
        }
      } else {
        try {
          const invite = await generateInviteForSubscription({
            subscriptionId: s.id,
            prefetched: {
              id: s.id,
              telegramInviteLink: s.telegramInviteLink,
              userEmail: s.user.email,
              userName: s.user.name,
            },
            force: stale,
            triggeredBy: `cohort-launch-email:${opts.actorLabel}`,
          });
          telegramInviteLink = invite.inviteLink;
        } catch (e) {
          console.error(`[yearly-launch-email] invite generation threw sub=${s.id}:`, e);
        }
        // Пауза лише коли справді ходили в Bot API (stale/force) — ідемпотентне повернення
        // вже наявного лінка жодного виклику не робить, чекати після нього нема сенсу.
        if (shouldPaceInvites && stale) await sleep(INVITE_GENERATION_PACE_MS);
      }
    }

    try {
      const html = body + renderTelegramInviteEmailBlock(telegramInviteLink);
      const res = await sendEmail({ to: s.user.email, subject, html });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      // `skipped:true` — мейлер не сконфігурований (немає RESEND_API_KEY або не-прод-середовище
      // без override-адреси): лист лише в консолі. Це НЕ доставка — рахуємо як failed і НЕ
      // пишемо `launch_email_sent`, інакше вся розсилка звітувала б «надіслано», а дедуп
      // назавжди закрив би цим людям і повторну спробу, і нічний heal. Так само поводяться
      // cron-нагадування (`sendReminderOnce`).
      if (res.skipped) throw new Error('mailer_not_configured');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'launch_email_sent',
          message: `Welcome email sent by ${opts.actorLabel}`,
          metadata: {
            cohortId: cohort.id,
            messageId: res.messageId,
            source: opts.source,
            telegramInvite: Boolean(telegramInviteLink),
          },
        },
      });
      results.push({ subscriptionId: s.id, email: s.user.email, sent: true, telegramInvite: Boolean(telegramInviteLink) });
    } catch (e) {
      const errMsg = (e as Error).message.slice(0, 200);
      // Persistent failure event — потрібно для issue-tracker-а, щоб збій дійшов
      // у вкладку "Помилки", а не зник у тому самому HTTP-respnse-і.
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'launch_email_failed',
          message: `Welcome email FAILED: ${errMsg}`,
          metadata: { cohortId: cohort.id, source: opts.source, error: errMsg },
        },
      });
      results.push({
        subscriptionId: s.id,
        email: s.user.email,
        sent: false,
        error: errMsg,
      });
    }
  }

  const sentCount = results.filter((r) => r.sent).length;

  // `emailSentAt`/`emailScheduledFor` виставлені у `markBulkStarted()` — перед першим
  // реальним надсиланням, а не тут. Набір, у якому жоден одержувач не пройшов скіп-чеки
  // (доступ ще не відкрито, немає оплати), таймстемпів не отримує взагалі: запланована
  // розсилка має спробувати ще раз завтра, а не «згоріти» мовчки.
  return {
    total: results.length,
    sent: sentCount,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.sent && !r.skipped).length,
    results,
    ...(interrupted ? { interrupted } : {}),
  };
}
