/// Синхронізація WFP-графіка автосписань підписки Річної з датами cohort-у.
///
/// Навіщо: графік створюється у WFP один раз у момент покупки. Якщо після цього
/// змінились дати cohort-у (або покупка була до старту зі старими датами) — WFP
/// продовжує списувати за старим розкладом. Цей модуль знаходить живі правила
/// регулярки через regularApi STATUS і переносить їх дати через CHANGE так, щоб:
/// — наступне списання = кінець уже оплаченого періоду (перерахований expiresAt),
/// — разом з уже сплаченими вийшло РІВНО totalMonthlyPayments (9) списань.
///
/// Запобіжники:
/// — суму/mode ніколи не змінюємо (callback відкидає списання з іншою сумою);
/// — дата наступного списання ніколи не ставиться в минуле (мінімум завтра);
/// — CHANGE шлеться лише якщо розбіжність ≥ 1 дня;
/// — повністю оплачені (9/9): активне правило знімається (REMOVE), більше списань не треба;
/// — видалене правило відновити неможливо → outcome 'no_rule', без тихих провалів;
/// — кожен apply-виклик пише подію в лог підписки.
///
/// Виклики: PATCH дат cohort-у (після коміту транзакції!), запуск програми
/// (executeLaunchLoop / runExtraLaunchForSubscription), кнопка в адмін-панелі підписки,
/// щоденний cron і callback — у режимі checkOnly (тільки кеш wfpNextChargeAt, без CHANGE).

import prisma from '@/lib/prisma';
import {
  changeRegularSchedule,
  getRegularStatus,
  getWayforpayCreds,
  removeRegularSchedule,
} from '@/lib/wayforpay';
import { addCalendarMonths, calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/// Той самий буфер, що й у buildRegularPurchaseFlags: dateEnd ставимо на 10 днів пізніше
/// за останнє списання, щоб WFP його не зрізав. Без цього кожна перша звірка після покупки
/// бачила б «дрейф» у 10 днів і слала зайвий CHANGE.
const REGULAR_DATE_END_BUFFER_DAYS = 10;

/// Подія «графік WFP розійшовся з розкладом набору» — пишеться read-only звіркою, коли
/// вона бачить дрейф, але сама нічого не змінює. Її ловить детектор «Помилок»
/// (`WFP_SCHEDULE_DRIFT`), щоб менеджер міг натиснути ручний sync.
export const WFP_SCHEDULE_DRIFT_EVENT = 'wfp_schedule_drift';
/// Подія «у WFP є правило, але воно не Active» (Suspended/Paused/…). Теж read-only сигнал:
/// автоматично таке правило ми не чіпаємо — статус міняється тільки в кабінеті WFP.
export const WFP_RULE_NOT_ACTIVE_EVENT = 'wfp_rule_not_active';

/// Дрейф, з якого попереджаємо менеджера. 1 день вважаємо шумом (WFP округляє дати
/// по добі, банківські затримки), тому поріг вищий за той, що вмикає CHANGE.
const DRIFT_ALERT_DAYS = 2;

/// Не частіше однієї події на добу на підписку: read-only звірка ходить і з cron-а,
/// і з кожного callback-а — без дедупу журнал підписки заріс би дублями, а лічильник
/// у «Помилках» показував би десятки «проявів» однієї й тієї ж проблеми.
const ALERT_EVENT_DEDUP_MS = 20 * 60 * 60 * 1000;

export interface ScheduleSyncResult {
  /// synced — CHANGE відправлено (або знято правило для 9/9); checked — звірено, змін не треба;
  /// no_rule — жодного живого правила у WFP; rule_inactive — правило у WFP Є, але не Active
  /// (Suspended/Paused): міняти його не можна, потрібне рішення в кабінеті WFP;
  /// skipped — підписка не підлягає синку; error — WFP/мережа/конфіг.
  outcome: 'synced' | 'checked' | 'no_rule' | 'rule_inactive' | 'skipped' | 'error';
  reason: string | null;
  /// orderReference живого правила (перший Active).
  ruleRef: string | null;
  /// Дата наступного списання у WFP ПІСЛЯ синку (кеш wfpNextChargeAt).
  nextChargeAt: Date | null;
  /// Бажана дата (перерахований кінець оплаченого періоду). null коли не рахували.
  desiredNextAt: Date | null;
  changed: boolean;
}

/// Пише подію-сигнал не частіше ніж раз на `ALERT_EVENT_DEDUP_MS`. Best-effort:
/// провал запису журналу не має валити саму звірку (вона й так нічого не змінює).
async function recordAlertOnce(args: {
  subscriptionId: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const recent = await prisma.yearlyProgramSubscriptionEvent.findFirst({
      where: {
        subscriptionId: args.subscriptionId,
        type: args.type,
        createdAt: { gte: new Date(Date.now() - ALERT_EVENT_DEDUP_MS) },
      },
      select: { id: true },
    });
    if (recent) return false;
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: args.subscriptionId,
        type: args.type,
        message: args.message.slice(0, 500),
        metadata: args.metadata as never,
      },
    });
    return true;
  } catch (e) {
    console.error('⚠️ Не вдалося записати подію звірки графіка:', args.subscriptionId, args.type, e);
    return false;
  }
}

export async function syncAutopaySchedule(
  subscriptionId: string,
  opts: { apply: boolean; source: string },
): Promise<ScheduleSyncResult> {
  const skip = (reason: string): ScheduleSyncResult => ({
    outcome: 'skipped', reason, ruleRef: null, nextChargeAt: null, desiredNextAt: null, changed: false,
  });

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      cohort: { select: { startDate: true, endDate: true } },
      payments: {
        // `excludedFromAccess` не рахуємо: це списання, які ми не зарахували в доступ
        // (orphan / понад ліміт / розбіжність суми). Інакше `paidCount` завищувався б і
        // звірка знімала б живе правило регулярки як «повна оплата 9/9».
        where: { status: 'PAID', excludedFromAccess: false },
        select: { orderReference: true, amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!sub) return skip('sub_not_found');
  if (sub.plan !== 'MONTHLY') return skip('not_autopay');
  // autoRenew=false і apply — нічого міняти не можна (підписка формально разова).
  // Але READ-ONLY звірка (apply:false) дозволена: прапорець міг збрехати, а живе
  // правило у WFP треба побачити, а не приховати за раннім виходом.
  if (!sub.autoRenew && opts.apply) return skip('not_autopay');
  if (['CANCELLED', 'EXPIRED', 'ARCHIVED'].includes(sub.status)) return skip(`status_${sub.status.toLowerCase()}`);
  if (!sub.cohort) return skip('no_cohort');
  if (sub.payments.length === 0) return skip('no_paid_payments');

  const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
  if (!merchantPassword) {
    return { outcome: 'error', reason: 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано', ruleRef: null, nextChargeAt: null, desiredNextAt: null, changed: false };
  }
  const creds = getWayforpayCreds();
  const now = new Date();
  const paidCount = sub.payments.length;
  const fullyPaid = paidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;

  // ── Крок 1: знайти живі правила серед PAID orderRef-ів (їх може бути кілька:
  // картка + Apple Pay, апгрейд разова→автоплатіж; child-refs WFPREG дадуть 4102 = not found).
  //
  // Швидкий шлях: якщо кеш уже знає живе правило (`wfpRegularRef`) — робимо STATUS ТІЛЬКИ
  // по ньому. Інакше нічна звірка била по одному запиту на кожен платіж кожної підписки
  // (з ростом платежів — сотні запитів за прогін). Повний перебір лишається, коли:
  //   • ref порожній (перша звірка / правило щойно знято);
  //   • STATUS по ref дав ЧЕСНУ відповідь «правила нема/не активне» (4102) — кеш застарів;
  //   • підписка вже 9/9 — там треба зняти ВСІ правила, тож маємо знати про кожне.
  const activeRules: { ref: string; amount: number; currency: string; mode: string; nextPaymentAt: Date | null; dateEndAt: Date | null }[] = [];
  /// Правила, які WFP ЗНАЙШОВ, але їхній статус не 'Active' (Suspended, Paused, ...).
  /// Це НЕ «правила немає»: воно живе в кабінеті мерчанта і може відновитись, тому
  /// ref такої підписки не можна занулювати — інакше вона зникає з нічної звірки і з
  /// колонки «Наступний платіж», а списання одного дня повертаються без попередження.
  const inactiveRules: { ref: string; status: string; nextPaymentAt: Date | null }[] = [];
  const statusErrors: string[] = [];
  /// Хоч один STATUS не дав чесної відповіді (5xx/timeout/битий JSON) → ми НЕ знаємо,
  /// чи є правило. Кеш у такому разі не чіпаємо взагалі.
  let inconclusive = false;
  const amountByRef = new Map(sub.payments.map((p) => [p.orderReference, p.amount]));
  const fallbackAmount = sub.payments[sub.payments.length - 1]!.amount;
  const probed = new Set<string>();

  const probeRefs = async (refs: string[]) => {
    for (const ref of refs) {
      if (probed.has(ref)) continue;
      probed.add(ref);
      try {
        const st = await getRegularStatus({
          merchantAccount: creds.merchantAccount,
          merchantPassword,
          orderReference: ref,
        });
        if (st.inconclusive) {
          inconclusive = true;
          statusErrors.push(`${ref}: невизначена відповідь WFP (reasonCode=${String(st.raw.reasonCode ?? '—')})`);
        } else if (st.found && st.status === 'Active') {
          activeRules.push({
            ref,
            amount: st.amount ?? amountByRef.get(ref) ?? fallbackAmount,
            currency: st.currency ?? 'UAH',
            mode: st.mode ?? 'monthly',
            nextPaymentAt: st.nextPaymentAt,
            dateEndAt: st.dateEndAt,
          });
        } else if (st.found) {
          // Правило існує, але не Active. Раніше ця гілка була невідрізненна від «нема
          // правила» → wfpRegularRef обнулявся, і призупинена регулярка ставала невидимою.
          inactiveRules.push({ ref, status: st.status ?? 'unknown', nextPaymentAt: st.nextPaymentAt });
        }
      } catch (e) {
        inconclusive = true;
        statusErrors.push(`${ref}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
  };

  const allRefs = sub.payments.map((p) => p.orderReference);
  const cachedRef = !fullyPaid && sub.wfpRegularRef ? sub.wfpRegularRef : null;
  if (cachedRef) {
    await probeRefs([cachedRef]);
    // Правило чесно померло (без жодної невизначеної відповіді) → кеш застарів,
    // добираємо решту orderRef-ів: могло лишитись інше живе правило.
    if (activeRules.length === 0 && !inconclusive) {
      await probeRefs(allRefs);
    }
  } else {
    await probeRefs(allRefs);
  }

  const cacheUpdate = async (ruleRef: string | null, nextChargeAt: Date | null) => {
    await prisma.yearlyProgramSubscription.update({
      where: { id: sub.id },
      data: { wfpRegularRef: ruleRef, wfpNextChargeAt: nextChargeAt, wfpScheduleCheckedAt: new Date() },
    });
  };

  if (activeRules.length === 0) {
    // Живих правил не знайшли. Якщо хоч одна відповідь була невизначеною — це може бути
    // просто збій WFP: НЕ занулюємо wfpRegularRef/wfpNextChargeAt (інакше 15 хвилин
    // недоступності API стерли б графіки всіх підписок в адмінці) і віддаємо помилку,
    // щоб cron порахував це як помилку й повторив звірку.
    if (inconclusive) {
      return {
        outcome: 'error',
        reason: `STATUS inconclusive (кеш збережено): ${statusErrors.join(' | ').slice(0, 300)}`,
        ruleRef: sub.wfpRegularRef,
        nextChargeAt: sub.wfpNextChargeAt,
        desiredNextAt: null,
        changed: false,
      };
    }
    // Живого (Active) правила немає, але WFP знайшов правило в іншому статусі —
    // Suspended/Paused/etc. Кеш зберігаємо (підписка лишається у звірці й у колонці
    // «Наступний платіж»), нічого не міняємо — CHANGE по неактивному правилу WFP
    // не приймає, а рішення «відновити чи зняти» ухвалюється в кабінеті мерчанта.
    if (inactiveRules.length > 0) {
      const stale = inactiveRules[0]!;
      await cacheUpdate(stale.ref, stale.nextPaymentAt);
      const statuses = inactiveRules.map((r) => `${r.ref}: ${r.status}`).join(' | ');
      await recordAlertOnce({
        subscriptionId: sub.id,
        type: WFP_RULE_NOT_ACTIVE_EVENT,
        message: `Правило регулярки у WFP у статусі «${stale.status}» — списань не буде, поки його не відновлять. Перевірте правило у кабінеті WayForPay (${statuses}) · ${opts.source}`,
        metadata: {
          source: opts.source,
          rules: inactiveRules.map((r) => ({ ref: r.ref, status: r.status })),
        },
      });
      return {
        outcome: 'rule_inactive',
        reason: `WFP-правило у статусі ${stale.status}`,
        ruleRef: stale.ref,
        nextChargeAt: stale.nextPaymentAt,
        desiredNextAt: null,
        changed: false,
      };
    }
    await cacheUpdate(null, null);
    return { outcome: 'no_rule', reason: null, ruleRef: null, nextChargeAt: null, desiredNextAt: null, changed: false };
  }
  const primary = activeRules[0]!;

  // ── Крок 2: повністю оплачена (9/9) — списань більше не має бути. Живе правило знімаємо.
  if (fullyPaid) {
    if (!opts.apply) {
      await cacheUpdate(primary.ref, primary.nextPaymentAt);
      return { outcome: 'checked', reason: 'fully_paid_rule_still_active', ruleRef: primary.ref, nextChargeAt: primary.nextPaymentAt, desiredNextAt: null, changed: false };
    }
    let removedErr: string | null = null;
    for (const rule of activeRules) {
      const r = await removeRegularSchedule({ merchantAccount: creds.merchantAccount, merchantPassword, orderReference: rule.ref });
      if (!r.ok && r.raw.reasonCode !== 4102) removedErr = `REMOVE ${rule.ref}: code=${r.raw.reasonCode}`;
    }
    await cacheUpdate(null, null);
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: removedErr ? 'wfp_schedule_sync_failed' : 'wfp_schedule_synced',
        message: removedErr ?? `Повна оплата ${paidCount}/${YEARLY_PROGRAM_CONFIG.totalMonthlyPayments} — активне правило знято (${opts.source})`,
        metadata: { source: opts.source, rules: activeRules.map((r) => r.ref) },
      },
    });
    return { outcome: removedErr ? 'error' : 'synced', reason: removedErr, ruleRef: null, nextChargeAt: null, desiredNextAt: null, changed: !removedErr };
  }

  // ── Крок 3: бажаний графік. Наступне списання = кінець оплаченого періоду
  // (та сама cohort-aware логіка, що рахує «Доступ до»), але не раніше завтра.
  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const recomputedExpires = calculateAccessUntil({
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    cohort: { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate },
    payments: sub.payments,
    postAccessMonths,
  });
  if (!recomputedExpires) return skip('no_recomputed_expiry');
  const tomorrow = new Date(now.getTime() + MS_PER_DAY);
  const desiredNext = recomputedExpires > tomorrow ? recomputedExpires : tomorrow;
  const remaining = YEARLY_PROGRAM_CONFIG.totalMonthlyPayments - paidCount;
  const desiredEnd = new Date(
    addCalendarMonths(desiredNext, remaining - 1).getTime()
    + REGULAR_DATE_END_BUFFER_DAYS * MS_PER_DAY,
  );

  const driftDays = (a: Date | null, b: Date) => (a ? Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY : Infinity);
  const needsChange = activeRules.some(
    (r) => driftDays(r.nextPaymentAt, desiredNext) >= 1 || driftDays(r.dateEndAt, desiredEnd) >= 1.5,
  );

  if (!opts.apply || !needsChange) {
    await cacheUpdate(primary.ref, primary.nextPaymentAt);
    // Дрейф побачила READ-ONLY звірка (нічний cron, callback, адмін-перегляд без права
    // на CHANGE). Раніше він лишався всередині `reason` і не доходив нікуди: графік
    // тихо розходився з розкладом набору, а списання йшли за старими датами.
    // Авто-виправлення свідомо НЕ вмикаємо (CHANGE — це гроші клієнта): пишемо подію
    // + піднімаємо issue у «Помилках», щоб менеджер натиснув ручну синхронізацію.
    if (needsChange) {
      const nextDrift = driftDays(primary.nextPaymentAt, desiredNext);
      if (nextDrift > DRIFT_ALERT_DAYS) {
        const fmt = (d: Date | null) => d?.toISOString().slice(0, 10) ?? '—';
        const driftLabel = Number.isFinite(nextDrift) ? `${Math.round(nextDrift)} дн` : 'дата невідома';
        await recordAlertOnce({
          subscriptionId: sub.id,
          type: WFP_SCHEDULE_DRIFT_EVENT,
          message: `Графік WFP розійшовся з розкладом набору: наступне списання ${fmt(primary.nextPaymentAt)}, має бути ${fmt(desiredNext)} (розбіжність ${driftLabel}). Натисніть «Синхронізувати графік» у панелі підписки · ${opts.source}`,
          metadata: {
            source: opts.source,
            ruleRef: primary.ref,
            wfpNextAt: primary.nextPaymentAt?.toISOString() ?? null,
            desiredNext: desiredNext.toISOString(),
            desiredEnd: desiredEnd.toISOString(),
            driftDays: Number.isFinite(nextDrift) ? Math.round(nextDrift) : null,
          },
        });
      }
    }
    return {
      outcome: 'checked',
      reason: needsChange ? 'drift_detected' : null,
      ruleRef: primary.ref,
      nextChargeAt: primary.nextPaymentAt,
      desiredNextAt: desiredNext,
      changed: false,
    };
  }

  // ── Крок 4: CHANGE кожного живого правила (сума/mode — ті самі, тільки дати).
  const changeErrors: string[] = [];
  for (const rule of activeRules) {
    try {
      const r = await changeRegularSchedule({
        merchantAccount: creds.merchantAccount,
        merchantPassword,
        orderReference: rule.ref,
        currentAmount: rule.amount,
        currentCurrency: rule.currency,
        currentMode: rule.mode,
        nextPaymentAt: desiredNext,
        dateEndAt: desiredEnd,
      });
      if (!r.ok) changeErrors.push(`${rule.ref}: code=${r.raw.reasonCode} ${String(r.raw.reason ?? '').slice(0, 60)}`);
    } catch (e) {
      changeErrors.push(`${rule.ref}: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  // ── Крок 5: контрольний STATUS головного правила → кеш реальним значенням WFP.
  let confirmedNext: Date | null = desiredNext;
  try {
    const confirm = await getRegularStatus({ merchantAccount: creds.merchantAccount, merchantPassword, orderReference: primary.ref });
    if (confirm.found) confirmedNext = confirm.nextPaymentAt;
  } catch {
    // залишаємо desiredNext — наступна cron-звірка поправить кеш
  }
  await cacheUpdate(primary.ref, confirmedNext);

  const failed = changeErrors.length > 0;
  const fmtD = (d: Date | null) => d?.toISOString().slice(0, 10) ?? '—';
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: failed ? 'wfp_schedule_sync_failed' : 'wfp_schedule_synced',
      message: failed
        ? `CHANGE errors: ${changeErrors.join(' | ').slice(0, 300)}`
        : `Графік WFP: наступне списання ${fmtD(primary.nextPaymentAt)} → ${fmtD(confirmedNext)}, кінець ${fmtD(desiredEnd)} · сплачено ${paidCount}/${YEARLY_PROGRAM_CONFIG.totalMonthlyPayments} (${opts.source})`,
      metadata: {
        source: opts.source,
        rules: activeRules.map((r) => r.ref),
        desiredNext: desiredNext.toISOString(),
        desiredEnd: desiredEnd.toISOString(),
      },
    },
  });

  return {
    outcome: failed ? 'error' : 'synced',
    reason: failed ? changeErrors.join(' | ').slice(0, 300) : null,
    ruleRef: primary.ref,
    nextChargeAt: confirmedNext,
    desiredNextAt: desiredNext,
    changed: !failed,
  };
}
