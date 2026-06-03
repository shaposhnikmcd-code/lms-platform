/// Issue tracker для Річної програми.
///
/// Архітектура:
///   - `YearlyProgramSubscriptionEvent` — immutable audit-лог (вже існує).
///   - `YearlyProgramIssueDismissal` — менеджер може заглушити issue (subId, kind).
///   - Цей модуль агрегує все в один типізований view: bins per (subId, kind) з
///     `lastOccurredAt` + `occurrenceCount` + paired auto-resolution.
///
/// Source-of-truth — БД. Issue не зберігається як окремий рядок: він обчислюється з
/// failure-подій / state-полів. Це гарантує, що list завжди свіжий і не може
/// розійтися з реальністю. Заглушення — окремий механізм для випадків коли
/// failure залишається в історії, але адмін підтвердив, що проблема вирішена.
///
/// Про перформанс: для ~500 підписок повний скан < 100ms на одному запиті, тому
/// кешування поки не потрібне. Якщо база зросте — додати materialized view
/// або таблицю-cache з recompute через cron.

import prisma from '@/lib/prisma';

/// Стабільний enum типів issue. Не перейменовуй значення — вони зберігаються
/// у `YearlyProgramIssueDismissal.kind` як рядки (історичні dismissal-и зламаються).
/// Додавати нові — можна. Видаляти — лише з міграцією, що чистить старі dismissal-и.
/// «Помилки» — це ТЕХНІЧНІ збої системи (SP API не відповів, Telegram bot не зміг
/// створити invite, шаблон листа не відрендерився). НЕ бізнес-події типу
/// «студентська картка не пройшла» — це нормальне життя автоплатежів, видно у
/// розділі підписки expand, не варто рахувати як «помилку».
export type IssueKind =
  | 'LAUNCH_ACCESS_FAILED'
  | 'LAUNCH_EMAIL_FAILED'
  | 'TG_INVITE_FAILED'
  | 'TG_KICK_FAILED'
  | 'SP_CLOSE_FAILED'
  | 'SP_REOPEN_FAILED'
  | 'ORPHAN_NO_PAYMENT';

export const ISSUE_KIND_VALUES: IssueKind[] = [
  'LAUNCH_ACCESS_FAILED',
  'LAUNCH_EMAIL_FAILED',
  'TG_INVITE_FAILED',
  'TG_KICK_FAILED',
  'SP_CLOSE_FAILED',
  'SP_REOPEN_FAILED',
  'ORPHAN_NO_PAYMENT',
];

export type IssueSeverity = 'critical' | 'warning' | 'info';

/// Severity per kind. Має 1-в-1 збігатись з CATALOG у IssuesModal.tsx (UI-каталог).
/// Дублюється свідомо: UI-каталог тримає тексти/іконки/дії (client-only), а ця мапа
/// потрібна на сервері для агрегації «highest severity per subscription» без тягнення
/// клієнтського модуля у server bundle.
export const ISSUE_KIND_SEVERITY: Record<IssueKind, IssueSeverity> = {
  LAUNCH_ACCESS_FAILED: 'critical',
  LAUNCH_EMAIL_FAILED: 'warning',
  TG_INVITE_FAILED: 'warning',
  TG_KICK_FAILED: 'info',
  SP_CLOSE_FAILED: 'info',
  SP_REOPEN_FAILED: 'warning',
  ORPHAN_NO_PAYMENT: 'critical',
};

const SEVERITY_RANK: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

/// Будує мапу `subscriptionId → найвища severity активних issue-ів + кількість`.
/// Використовується для бейджа на рядку таблиці підписок.
export function buildSubscriptionSeverityMap(payload: IssuesPayload): Record<string, { severity: IssueSeverity; count: number }> {
  const acc: Record<string, { severity: IssueSeverity; count: number }> = {};
  for (const rec of payload.active) {
    const sev = ISSUE_KIND_SEVERITY[rec.kind];
    const prev = acc[rec.subscriptionId];
    if (!prev) {
      acc[rec.subscriptionId] = { severity: sev, count: 1 };
    } else {
      prev.count += 1;
      if (SEVERITY_RANK[sev] < SEVERITY_RANK[prev.severity]) prev.severity = sev;
    }
  }
  return acc;
}

export const ISSUE_KIND_LABELS: Record<IssueKind, string> = {
  LAUNCH_ACCESS_FAILED: 'Запуск: SP-доступ не відкрито',
  LAUNCH_EMAIL_FAILED: 'Запуск: welcome-лист не доставлено',
  TG_INVITE_FAILED: 'Telegram: invite-link не згенеровано',
  TG_KICK_FAILED: 'Telegram: вилучення/ban не виконано',
  SP_CLOSE_FAILED: 'SendPulse: close-access помилка',
  SP_REOPEN_FAILED: 'SendPulse: reopen-access помилка',
  ORPHAN_NO_PAYMENT: 'Цілісність: активна підписка без жодної оплати',
};

/// Чи є retry-action для kind-у — впливає на UI (показ кнопки «Спробувати ще»).
/// Auto-retry-кнопки відомі: invite-link generation, cohort launch retry.
export const ISSUE_HAS_RETRY: Record<IssueKind, boolean> = {
  LAUNCH_ACCESS_FAILED: true,   // POST /cohorts/[id]/launch?retry=1
  LAUNCH_EMAIL_FAILED: false,   // через окрему "Дослати лист" модалку (per-recipient)
  TG_INVITE_FAILED: true,       // POST /yearly-program/[id]/telegram-invite (force=true)
  TG_KICK_FAILED: false,        // одноразова дія, повторювати не варто
  SP_CLOSE_FAILED: false,       // менеджер натискає "Закрити доступ" знову вручну
  SP_REOPEN_FAILED: false,      // менеджер натискає "Відкрити доступ" знову вручну
  ORPHAN_NO_PAYMENT: false,     // ручний розбір: видалити сироту або знайти втрачений платіж
};

export interface IssueRecord {
  subscriptionId: string;
  kind: IssueKind;
  /// Час останнього прояву (для event-based: createdAt останнього failure;
  /// для state-based: updatedAt підписки).
  lastOccurredAt: string;
  /// Кількість failure-подій для цієї пари (для state-based — 1).
  occurrenceCount: number;
  /// Excerpt помилки (до 200 символів) для UI. Повний текст — у "Подіях" підписки.
  errorExcerpt: string | null;
  /// Метадані останнього failure (для UI).
  user: { id: string; name: string | null; email: string };
  plan: 'YEARLY' | 'MONTHLY';
  cohortName: string | null;
  /// Якщо заглушено — повертаємо в окремому масиві `dismissed`.
  dismissedAt: string | null;
  dismissedBy: string | null;
  dismissedReason: string | null;
}

export interface IssuesPayload {
  active: IssueRecord[];
  dismissed: IssueRecord[];
  /// Лічильники активних по kind — для badge у toolbar.
  activeCounts: Record<IssueKind, number>;
  /// Сумарний лічильник активних — для red-dot.
  activeTotal: number;
}

interface RawSubscription {
  id: string;
  plan: 'YEARLY' | 'MONTHLY';
  status: string;
  updatedAt: Date;
  telegramInviteError: string | null;
  telegramInvitedAt: Date | null;
  lastChargeError: string | null;
  failedChargeCount: number;
  lastChargeAttemptAt: Date | null;
  manuallyAddedAt: Date | null;
  user: { id: string; name: string | null; email: string } | null;
  cohort: { name: string } | null;
}

interface RawEvent {
  id: string;
  subscriptionId: string;
  type: string;
  message: string | null;
  metadata: unknown;
  createdAt: Date;
}

interface RawDismissal {
  subscriptionId: string;
  kind: string;
  dismissedAt: Date;
  dismissedBy: string;
  reason: string | null;
}

/// Одне місце, де failure-подія мапиться у IssueKind. Якщо в коді з'являється новий
/// тип failure-події — додай тут, щоб він автоматично підхопився trekker-ом.
function classifyEvent(e: RawEvent): {
  kind: IssueKind | null;
  /// Чи це success-подія, що "закриває" issue. Повертаємо kind, який вона resolve-ить.
  resolvesKind?: IssueKind;
} {
  // Success events (resolve відповідного failure):
  if (e.type === 'access_opened') return { kind: null, resolvesKind: 'LAUNCH_ACCESS_FAILED' };
  if (e.type === 'launch_email_sent') return { kind: null, resolvesKind: 'LAUNCH_EMAIL_FAILED' };

  // Failure events (видні в активних):
  if (e.type === 'access_open_failed') return { kind: 'LAUNCH_ACCESS_FAILED' };
  if (e.type === 'launch_email_failed') return { kind: 'LAUNCH_EMAIL_FAILED' };

  // Legacy: до явних `*_failed` типів ми писали failure-події з type='admin_action'
  // або 'access_opened' з мітками FAILED у message. Ловимо їх по тексту.
  if (e.message) {
    if (/Cohort launch · access open FAILED/i.test(e.message)) return { kind: 'LAUNCH_ACCESS_FAILED' };
    if (/Extra-launch FAILED \(SendPulse\)/i.test(e.message)) return { kind: 'LAUNCH_ACCESS_FAILED' };
    if (/Extra-launch email FAILED/i.test(e.message)) return { kind: 'LAUNCH_EMAIL_FAILED' };
  }

  // TG-kick events із масивом помилок у metadata.errors:
  if (e.type === 'admin_action' && e.metadata && typeof e.metadata === 'object') {
    const meta = e.metadata as { mode?: string; errors?: unknown };
    if ((meta.mode === 'returnable' || meta.mode === 'permanent') && Array.isArray(meta.errors) && meta.errors.length > 0) {
      return { kind: 'TG_KICK_FAILED' };
    }
  }

  return { kind: null };
}

/// Зчитує stateful-issue-и з полів підписки (без потреби в подіях).
function stateBasedIssues(sub: RawSubscription): { kind: IssueKind; errorExcerpt: string; lastOccurredAt: Date }[] {
  const out: { kind: IssueKind; errorExcerpt: string; lastOccurredAt: Date }[] = [];
  if (sub.telegramInviteError) {
    out.push({
      kind: 'TG_INVITE_FAILED',
      errorExcerpt: sub.telegramInviteError.slice(0, 200),
      // Best approximation: останнє ненульове `telegramInvitedAt`, інакше updatedAt.
      lastOccurredAt: sub.telegramInvitedAt ?? sub.updatedAt,
    });
  }
  return out;
}

/// Збирає всі issue-и (active + dismissed) для всіх підписок. Ефективно: один батч
/// запитів, далі агрегація в пам'яті. Не залежить від адмін-сесії — викликається з API
/// route, який сам гейтується isAdmin.
export async function collectAllIssues(): Promise<IssuesPayload> {
  const [subs, events, dismissals, paidRows] = await Promise.all([
    prisma.yearlyProgramSubscription.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        plan: true,
        status: true,
        updatedAt: true,
        telegramInviteError: true,
        telegramInvitedAt: true,
        lastChargeError: true,
        failedChargeCount: true,
        lastChargeAttemptAt: true,
        manuallyAddedAt: true,
        user: { select: { id: true, name: true, email: true } },
        cohort: { select: { name: true } },
      },
    }),
    /// Тягнемо тільки потенційно-релевантні події: failure-типи + success-типи
    /// для resolve-логіки. Інші типи (created/charge_success/cancelled тощо) пропускаємо.
    prisma.yearlyProgramSubscriptionEvent.findMany({
      where: {
        OR: [
          { type: { in: ['access_open_failed', 'launch_email_failed', 'access_opened', 'launch_email_sent'] } },
          { type: 'admin_action' },
        ],
      },
      select: {
        id: true,
        subscriptionId: true,
        type: true,
        message: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.yearlyProgramIssueDismissal.findMany({
      select: {
        subscriptionId: true,
        kind: true,
        dismissedAt: true,
        dismissedBy: true,
        reason: true,
      },
    }),
    /// Для детектора цілісності ORPHAN_NO_PAYMENT — множина підписок, що мають
    /// хоч один PAID-платіж. Підписка в «оплаченому» статусі поза цією множиною = аномалія.
    prisma.payment.findMany({
      where: { yearlyProgramSubscriptionId: { not: null }, status: 'PAID' },
      select: { yearlyProgramSubscriptionId: true },
      distinct: ['yearlyProgramSubscriptionId'],
    }),
  ]);

  const paidSubIds = new Set(paidRows.map((r) => r.yearlyProgramSubscriptionId).filter(Boolean) as string[]);

  const subById = new Map<string, RawSubscription>(subs.map((s) => [s.id, s]));

  // Мапа: subId → kind → найсвіжіший resolved-час (з success-events).
  const resolvedAt = new Map<string, Map<IssueKind, Date>>();
  // Мапа: subId → kind → { latestFailureAt, occurrenceCount, latestErrorExcerpt }
  const failureAgg = new Map<string, Map<IssueKind, { latestAt: Date; count: number; excerpt: string | null }>>();

  for (const e of events) {
    const c = classifyEvent(e);
    if (c.resolvesKind) {
      let map = resolvedAt.get(e.subscriptionId);
      if (!map) { map = new Map(); resolvedAt.set(e.subscriptionId, map); }
      const prev = map.get(c.resolvesKind);
      if (!prev || e.createdAt > prev) map.set(c.resolvesKind, e.createdAt);
    }
    if (c.kind) {
      let map = failureAgg.get(e.subscriptionId);
      if (!map) { map = new Map(); failureAgg.set(e.subscriptionId, map); }
      const prev = map.get(c.kind);
      const excerpt = e.message?.slice(0, 200) ?? null;
      if (!prev) {
        map.set(c.kind, { latestAt: e.createdAt, count: 1, excerpt });
      } else {
        prev.count += 1;
        if (e.createdAt > prev.latestAt) {
          prev.latestAt = e.createdAt;
          prev.excerpt = excerpt;
        }
      }
    }
  }

  // Мапа дисмісалів для швидкого lookup.
  const dismissalKey = (subId: string, kind: string) => `${subId}::${kind}`;
  const dismissalMap = new Map<string, RawDismissal>();
  for (const d of dismissals) {
    dismissalMap.set(dismissalKey(d.subscriptionId, d.kind), d);
  }

  // Збираємо event-based issues.
  const records: IssueRecord[] = [];
  for (const [subId, kindMap] of failureAgg) {
    const sub = subById.get(subId);
    if (!sub || !sub.user) continue;
    for (const [kind, agg] of kindMap) {
      // Resolve check: якщо є success-подія цього kind після останнього failure → пропускаємо.
      const successAt = resolvedAt.get(subId)?.get(kind);
      if (successAt && successAt > agg.latestAt) continue;

      const dismissal = dismissalMap.get(dismissalKey(subId, kind));
      records.push({
        subscriptionId: subId,
        kind,
        lastOccurredAt: agg.latestAt.toISOString(),
        occurrenceCount: agg.count,
        errorExcerpt: agg.excerpt,
        user: sub.user,
        plan: sub.plan,
        cohortName: sub.cohort?.name ?? null,
        dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
        dismissedBy: dismissal?.dismissedBy ?? null,
        dismissedReason: dismissal?.reason ?? null,
      });
    }
  }

  // Збираємо state-based issues. Уникнення дублів: якщо вже є event-based record
  // того ж kind для цієї sub — пропускаємо state-based (event є точнішим джерелом).
  const recordKey = (r: IssueRecord) => `${r.subscriptionId}::${r.kind}`;
  const haveEventRecord = new Set(records.map(recordKey));
  for (const sub of subs) {
    if (!sub.user) continue;
    for (const stateIssue of stateBasedIssues(sub)) {
      if (haveEventRecord.has(`${sub.id}::${stateIssue.kind}`)) continue;
      const dismissal = dismissalMap.get(dismissalKey(sub.id, stateIssue.kind));
      records.push({
        subscriptionId: sub.id,
        kind: stateIssue.kind,
        lastOccurredAt: stateIssue.lastOccurredAt.toISOString(),
        occurrenceCount: 1,
        errorExcerpt: stateIssue.errorExcerpt,
        user: sub.user,
        plan: sub.plan,
        cohortName: sub.cohort?.name ?? null,
        dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
        dismissedBy: dismissal?.dismissedBy ?? null,
        dismissedReason: dismissal?.reason ?? null,
      });
    }
  }

  // Детектор цілісності ORPHAN_NO_PAYMENT: підписка в «оплаченому» статусі
  // (ACTIVE/GRACE/EXPIRED/CANCELLED) без жодного PAID-платежу — це порушення інваріанта
  // (втрачений платіж / тестовий залишок / ручна правка БД). PENDING сюди НЕ входить —
  // там відсутність оплати нормальна (незавершений чекаут, його архівує cron).
  const ORPHAN_PAID_STATUSES = new Set(['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED']);
  for (const sub of subs) {
    if (!sub.user) continue;
    if (!ORPHAN_PAID_STATUSES.has(sub.status)) continue;
    if (paidSubIds.has(sub.id)) continue;
    // Ручне додавання без оплати (перенесення з минулорічного набору) — легітимно
    // безплатна підписка. НЕ вважаємо її «сиротою»/порушенням інваріанта.
    if (sub.manuallyAddedAt) continue;
    if (haveEventRecord.has(`${sub.id}::ORPHAN_NO_PAYMENT`)) continue;
    const dismissal = dismissalMap.get(dismissalKey(sub.id, 'ORPHAN_NO_PAYMENT'));
    records.push({
      subscriptionId: sub.id,
      kind: 'ORPHAN_NO_PAYMENT',
      lastOccurredAt: sub.updatedAt.toISOString(),
      occurrenceCount: 1,
      errorExcerpt: `Статус ${sub.status}, але жодного PAID-платежу не знайдено.`,
      user: sub.user,
      plan: sub.plan,
      cohortName: sub.cohort?.name ?? null,
      dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
      dismissedBy: dismissal?.dismissedBy ?? null,
      dismissedReason: dismissal?.reason ?? null,
    });
  }

  // Розділяємо active vs dismissed. Issue active якщо:
  //   - dismissal відсутній, АБО
  //   - lastOccurredAt > dismissedAt (нова failure після заглушення → знову вилазить).
  const active: IssueRecord[] = [];
  const dismissed: IssueRecord[] = [];
  for (const r of records) {
    if (r.dismissedAt && new Date(r.lastOccurredAt) <= new Date(r.dismissedAt)) {
      dismissed.push(r);
    } else {
      active.push(r);
    }
  }

  // Сортуємо: active за lastOccurredAt desc, dismissed за dismissedAt desc.
  active.sort((a, b) => new Date(b.lastOccurredAt).getTime() - new Date(a.lastOccurredAt).getTime());
  dismissed.sort((a, b) => {
    const aAt = a.dismissedAt ? new Date(a.dismissedAt).getTime() : 0;
    const bAt = b.dismissedAt ? new Date(b.dismissedAt).getTime() : 0;
    return bAt - aAt;
  });

  const activeCounts = ISSUE_KIND_VALUES.reduce(
    (acc, k) => ({ ...acc, [k]: active.filter((r) => r.kind === k).length }),
    {} as Record<IssueKind, number>,
  );

  return {
    active,
    dismissed,
    activeCounts,
    activeTotal: active.length,
  };
}

/// Заглушити issue. Idempotent: якщо вже заглушено — оновлюємо `reason`/`dismissedBy`/`dismissedAt`.
export async function dismissIssue(args: {
  subscriptionId: string;
  kind: IssueKind;
  dismissedBy: string;
  reason?: string | null;
}): Promise<void> {
  const { subscriptionId, kind, dismissedBy, reason } = args;
  await prisma.yearlyProgramIssueDismissal.upsert({
    where: { subscriptionId_kind: { subscriptionId, kind } },
    create: { subscriptionId, kind, dismissedBy, reason: reason ?? null },
    update: { dismissedBy, reason: reason ?? null, dismissedAt: new Date() },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId,
      type: 'admin_action',
      message: `Issue dismissed [${kind}] by ${dismissedBy}${reason ? `: ${reason}` : ''}`,
      metadata: { issueDismissed: true, kind, reason: reason ?? null, dismissedBy },
    },
  });
}

/// Повернути dismissed issue в active (видаляє dismissal-запис).
export async function undismissIssue(args: {
  subscriptionId: string;
  kind: IssueKind;
  undismissedBy: string;
}): Promise<void> {
  const { subscriptionId, kind, undismissedBy } = args;
  await prisma.yearlyProgramIssueDismissal.deleteMany({
    where: { subscriptionId, kind },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId,
      type: 'admin_action',
      message: `Issue un-dismissed [${kind}] by ${undismissedBy}`,
      metadata: { issueUndismissed: true, kind, undismissedBy },
    },
  });
}
