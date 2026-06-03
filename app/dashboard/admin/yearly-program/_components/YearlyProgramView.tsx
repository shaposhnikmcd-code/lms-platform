'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  HiOutlineUserGroup,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineXCircle,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheck,
  HiOutlineCurrencyDollar,
  HiOutlineExclamationTriangle,
  HiOutlineNoSymbol,
  HiOutlineArchiveBoxXMark,
  HiOutlineInformationCircle,
} from 'react-icons/hi2';
import type { YearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import type { Row, SubStatus, Plan, SummaryData, CohortListItem } from './types';
import CohortHeader from './CohortHeader';
import CohortActions from './CohortActions';
import MoveCohortBtn from './MoveCohortBtn';
import { UIFeedbackProvider, useUIFeedback } from './UIFeedback';
import { SkeletonBox, SkeletonFooterTick } from './EmailEditorParts';
import { prewarmTemplateListCache, prewarmRecipientsCache, syncReminderListGraceDays } from './modalCaches';
import type { YearlyProgramAdminPrewarm } from '@/lib/yearlyProgramAdminPrefetch';

// Code-split важких модалок: TipTap-редактор + великі форми тягнуть ~200KB JS.
// Завантажуються тільки коли менеджер реально натискає кнопку → initial bundle сторінки менший.
// `ssr: false` — модалки використовують Portal/document, server render для них немає сенсу.
const CreateCohortModal = dynamic(() => import('./CreateCohortModal'), { ssr: false });
// Listи Платежів / Нагадування перенесено на /dashboard/admin/emails (картки-категорії).
// Звідси імпортувати модалки більше не потрібно — код модалок лишається у цій теці й
// підтягується з /emails-сторінки.
const IssuesModal = dynamic(() => import('./IssuesModal'), { ssr: false });
import ProgramSettingButton from './ProgramSettingButton';
import { type TelegramSettingsState } from './TelegramChannelButton';
import { getCountryName } from '@/lib/countries';
import { telegramProfileUrl } from '@/lib/telegramUsername';

export type { Row, SubStatus, Plan, SummaryData };

interface SubscriptionDetails {
  id: string;
  country: string | null;
  telegramUsername: string | null;
  telegramInviteLink: string | null;
  telegramInvitedAt: string | null;
  telegramInviteError: string | null;
  telegramJoinedAt: string | null;
  telegramLeftAt: string | null;
  user: { id: string; name: string | null; email: string } | null;
  plan: Plan;
  autoRenew: boolean;
  status: SubStatus;
  startDate: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelledReason: string | null;
  lastPaymentAt: string | null;
  lastChargeError: string | null;
  failedChargeCount: number;
  sendpulseStudentId: number | null;
  sendpulseAccessOpenedAt: string | null;
  sendpulseAccessClosedAt: string | null;
  reminderSent3d: boolean;
  reminderSentExpired: boolean;
  payments: Array<{
    id: string;
    orderReference: string;
    amount: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    message: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
}

type PlanFilter = 'ALL' | 'YEARLY' | 'MONTHLY_AUTO' | 'MONTHLY_ONCE';

const PLAN_OPTIONS: { value: PlanFilter; label: string }[] = [
  { value: 'ALL', label: 'Всі' },
  { value: 'YEARLY', label: 'Річний' },
  { value: 'MONTHLY_AUTO', label: 'Місячний Автоплатіж' },
  { value: 'MONTHLY_ONCE', label: 'Місячний на 1 міс.' },
];

function buildStatusOptions(graceDays: number): { value: 'ALL' | SubStatus; label: string }[] {
  return [
    { value: 'ALL', label: 'Усі' },
    { value: 'ACTIVE', label: 'Активний' },
    { value: 'GRACE', label: `Grace (${graceDays} ${pluralizeDays(graceDays)})` },
    { value: 'EXPIRED', label: 'Доступ закрито' },
    { value: 'CANCELLED', label: 'Скасовано' },
    { value: 'PENDING', label: 'Очікує' },
    { value: 'ARCHIVED', label: 'Архів' },
  ];
}

interface ProgramDefaults {
  yearlyPrice: number;
  monthlyPrice: number;
  btnLabel: string;
  priceNote: string;
  duration: string;
  registrationOpen: boolean;
}

export default function YearlyProgramView(props: {
  rows: Row[];
  summary: SummaryData;
  telegramSettings: TelegramSettingsState;
  cohorts: CohortListItem[];
  graceDays: number;
  programSettings: YearlyProgramSettings;
  programDefaults: ProgramDefaults;
  /// SSR-prewarm-payload: templates lists і recipients для launched cohort-ів. Дозволяє
  /// відкривати модалки одразу без додаткового HTTP roundtrip і skeleton-у.
  prewarm: YearlyProgramAdminPrewarm;
  /// Чи поточний користувач — super-admin (env-allowlist). Розблоковує rare-операції
  /// типу «Відмінити Запуск програми» у CohortActions.
  isSuperAdmin: boolean;
  /// SSR-pre-computed загальна кількість активних issue-ів — для red-badge на кнопці
  /// «🚨 Помилки» без HTTP-roundtrip-у при першому render-і.
  initialIssuesTotal: number;
  /// SSR-pre-computed `subscriptionId → highest active issue severity + count`.
  /// Дозволяє рендерити ⚠️ severity-бейдж на рядку таблиці без HTTP-roundtrip-у.
  issueSeverityBySub: Record<string, { severity: 'critical' | 'warning' | 'info'; count: number }>;
}) {
  const { theme, setTheme } = useAdminTheme();

  // Записуємо SSR-prewarm у module-level кеші модалок.
  // Виконується синхронно на першому render-і, ДО того як CohortActions/toolbar монтуються,
  // тому до моменту першого кліку «Listі Платежів» / «Дослати лист» дані вже в кеші.
  // useState з ініціалізатором гарантує, що prewarm записується тільки один раз.
  useState(() => {
    prewarmTemplateListCache('payment', props.prewarm.templates.payment);
    prewarmTemplateListCache('reminder', props.prewarm.templates.reminder);
    for (const [cohortId, payload] of Object.entries(props.prewarm.recipientsByCohort)) {
      prewarmRecipientsCache(cohortId, payload);
    }
    return null;
  });

  // Re-sync currentGraceDays на reminder-кеш при кожному оновленні SSR-prewarm-у
  // (наприклад, після router.refresh() з GraceSettingsModal). Жорстко перезаписувати весь
  // кеш не можна — там зберігаються правки менеджера (isCustomized/updatedAt). Тому міняємо
  // тільки одне поле, яке гарантовано приходить зі server-side і не редагується клієнтом.
  const reminderGraceDays = props.prewarm.templates.reminder.currentGraceDays ?? null;
  useEffect(() => {
    syncReminderListGraceDays(reminderGraceDays);
  }, [reminderGraceDays]);

  return (
    <UIFeedbackProvider theme={theme}>
      <YearlyProgramViewInner {...props} theme={theme} setTheme={setTheme} />
    </UIFeedbackProvider>
  );
}

function YearlyProgramViewInner({
  rows,
  summary,
  cohorts,
  graceDays,
  programSettings,
  programDefaults,
  telegramSettings,
  theme,
  setTheme,
  isSuperAdmin,
  initialIssuesTotal,
  issueSeverityBySub,
}: {
  rows: Row[];
  summary: SummaryData;
  cohorts: CohortListItem[];
  graceDays: number;
  programSettings: YearlyProgramSettings;
  programDefaults: ProgramDefaults;
  telegramSettings: TelegramSettingsState;
  theme: Theme;
  setTheme: (t: Theme) => void;
  isSuperAdmin: boolean;
  initialIssuesTotal: number;
  issueSeverityBySub: Record<string, { severity: 'critical' | 'warning' | 'info'; count: number }>;
  // prewarm проходить через spread у props, але тут не використовується — кеш заповнюється
  // у YearlyProgramView (parent) до mount-у inner-а.
  prewarm?: YearlyProgramAdminPrewarm;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const { toast, confirm } = useUIFeedback();

  // Cohort UI: за замовчуванням обираємо поточний cohort, якщо є; інакше null = усі підписки.
  const initialCohortId = cohorts.find((c) => c.isCurrent)?.id ?? cohorts[0]?.id ?? null;
  const [activeCohortId, setActiveCohortId] = useState<string | null>(initialCohortId);
  const [createCohortOpen, setCreateCohortOpen] = useState(false);
  const activeCohort = cohorts.find((c) => c.id === activeCohortId) ?? null;

  const [planFilter, setPlanFilter] = useState<PlanFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubStatus>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SubscriptionDetails | 'loading' | 'error'>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [graceModalOpen, setGraceModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  /// Лічильник active issues — оновлюється при відкритті/закритті модалки помилок,
  /// показується як red-badge на кнопці. Initial = 0; перший fetch виконує модалка
  /// при відкритті, а потім callback оновлює badge для toolbar-а без відкриття модалки.
  const [issuesActiveTotal, setIssuesActiveTotal] = useState<number>(initialIssuesTotal);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Cohort filter: null = усі. Інакше показуємо тільки підписки активного cohort-у.
      if (activeCohortId !== null && r.cohortId !== activeCohortId) return false;
      if (planFilter === 'YEARLY' && r.plan !== 'YEARLY') return false;
      if (planFilter === 'MONTHLY_AUTO' && !(r.plan === 'MONTHLY' && r.autoRenew)) return false;
      if (planFilter === 'MONTHLY_ONCE' && !(r.plan === 'MONTHLY' && !r.autoRenew)) return false;
      // Архів сховано з дефолтного вигляду — показуємо лише коли явно обрано фільтр «Архів».
      if (statusFilter === 'ALL' && r.status === 'ARCHIVED') return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (q && !r.userEmail.toLowerCase().includes(q) && !(r.userName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, activeCohortId, planFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [planFilter, statusFilter, search, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (details[id] && details[id] !== 'error') return;
    setDetails((d) => ({ ...d, [id]: 'loading' }));
    try {
      const res = await fetch(`/api/admin/yearly-program/${id}/details`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as SubscriptionDetails;
      setDetails((d) => ({ ...d, [id]: data }));
    } catch {
      setDetails((d) => ({ ...d, [id]: 'error' }));
    }
  }

  async function runAction(id: string, action: string, payload?: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg) {
      const ok = await confirm({
        title: confirmMsg,
        destructive: action === 'cancel' || action === 'close_access' || action === 'delete',
      });
      if (!ok) return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/yearly-program/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
      } else {
        router.refresh();
        setDetails((d) => {
          const copy = { ...d };
          delete copy[id];
          return copy;
        });
        if (data.wfpError) {
          toast('info', `Виконано, але: ${data.wfpError}`);
        } else {
          toast('success', 'Дію виконано');
        }
      }
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Річна програма"
      title="Річна програма"
      subtitle="Платежі та доступ до Річної програми (SendPulse). Місячна підписка — з автосписанням, річна — одна оплата на рік."
      maxWidth="max-w-[1640px]"
    >
      {/* Workspace card: cohort header + actions + KPI strip — об'єднані в один блок з
          внутрішніми розділювачами, щоб не виглядали як 3 окремі картки. Program-налаштування
          (Вартість/Grace/Email) — в правому верхньому куті workspace, окремо від фільтрів таблиці. */}
      <AdminPanel theme={theme} padding="p-0" className="mb-5 w-fit max-w-5xl">
        <CohortHeader
          cohorts={cohorts}
          activeCohortId={activeCohortId}
          onSelect={setActiveCohortId}
          onCreate={() => setCreateCohortOpen(true)}
          theme={theme}
        />
        {activeCohort && (
          <>
            <div className={dark ? 'border-t border-white/[0.06]' : 'border-t border-stone-300/40'} />
            <CohortActions
              cohort={activeCohort}
              theme={theme}
              graceDays={graceDays}
              telegramSettings={telegramSettings}
              isSuperAdmin={isSuperAdmin}
            />
          </>
        )}
        <div className={dark ? 'border-t border-white/[0.06]' : 'border-t border-stone-300/40'} />
        <div className="px-5 py-3 flex items-center gap-x-6 gap-y-2 flex-wrap">
          <KpiInline theme={theme} icon={HiOutlineUserGroup} label="Активних" value={summary.active.toLocaleString()} tone="success" />
          <KpiInline
            theme={theme}
            icon={HiOutlineClock}
            label={`Grace (${graceDays} ${pluralizeDays(graceDays)})`}
            value={summary.grace.toLocaleString()}
            tone="warning"
          />
          <KpiInline
            theme={theme}
            icon={HiOutlineArchiveBoxXMark}
            label="Доступ закрито"
            value={summary.expired.toLocaleString()}
            hint="EXPIRED — термін підписки закінчився"
          />
          <KpiInline
            theme={theme}
            icon={HiOutlineNoSymbol}
            label="Скасовано"
            value={summary.cancelled.toLocaleString()}
            hint="CANCELLED — студент/адмін перервав підписку"
          />
          <KpiInline
            theme={theme}
            icon={HiOutlineBanknotes}
            label="Дохід"
            value={`${summary.revenueTotal.toLocaleString()} ₴`}
            tone="success"
            big
          />
        </div>
      </AdminPanel>
      {createCohortOpen && (
        <CreateCohortModal
          theme={theme}
          onClose={() => setCreateCohortOpen(false)}
          onCreated={(id) => setActiveCohortId(id)}
        />
      )}

      {/* Програмні налаштування: Вартість+GRACE та Листи/Пошук — один ряд, окремі підблоки. */}
      <div className="flex items-start gap-3 mb-5 flex-wrap">
        <AdminPanel theme={theme} padding="p-3" className="w-fit">
          <div className="flex items-center gap-1">
            <ProgramSettingButton
              theme={theme}
              icon={<HiOutlineCurrencyDollar className="text-base" />}
              label="Активація сторінки"
              title="Активувати сторінку: відкрити реєстрацію, ціни, текст кнопок та інформацію про програму"
              onClick={() => setPricingModalOpen(true)}
              badge={!programSettings.registrationOpen ? 'закрито' : null}
            />
            <ProgramSettingButton
              theme={theme}
              icon={<HiOutlineClock className="text-base" />}
              label={`GRACE · ${graceDays}д`}
              title="Налаштувати тривалість grace-періоду"
              onClick={() => setGraceModalOpen(true)}
            />
          </div>
        </AdminPanel>

        <AdminPanel theme={theme} padding="p-3" className="w-fit">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за email або імʼям"
              className={`w-[260px] px-3 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
                  : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
              }`}
            />
          </div>
        </AdminPanel>

        <AdminPanel theme={theme} padding="p-3" className="w-fit">
          <button
            type="button"
            onClick={() => setIssuesOpen(true)}
            title="Логи помилок Річної програми (запуски, листи, Telegram, автоплатіж, SP)"
            className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
              issuesActiveTotal > 0
                ? dark
                  ? 'bg-rose-500/12 border-rose-400/35 text-rose-200 hover:bg-rose-500/20'
                  : 'bg-rose-50 border-rose-300/60 text-rose-900 hover:bg-rose-100'
                : dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <HiOutlineExclamationTriangle className="text-base" />
            Помилки
            {issuesActiveTotal > 0 && (
              <span
                className={`ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold tabular-nums ${
                  dark ? 'bg-rose-500/30 text-rose-100' : 'bg-rose-600 text-white'
                }`}
                aria-label={`Активних помилок: ${issuesActiveTotal}`}
              >
                {issuesActiveTotal}
              </span>
            )}
          </button>
        </AdminPanel>
      </div>
      {graceModalOpen && (
        <GraceSettingsModal
          theme={theme}
          initialDays={graceDays}
          onClose={() => setGraceModalOpen(false)}
        />
      )}
      {pricingModalOpen && (
        <ProgramPricingModal
          theme={theme}
          initial={programSettings}
          defaults={programDefaults}
          onClose={() => setPricingModalOpen(false)}
        />
      )}
      {issuesOpen && (
        <IssuesModal
          theme={theme}
          onClose={async () => {
            setIssuesOpen(false);
            // Refresh badge-count після закриття модалки (у ній могли заглушити/повернути).
            try {
              const res = await fetch('/api/admin/yearly-program/issues', { cache: 'no-store' });
              if (res.ok) {
                const data = await res.json() as { activeTotal?: number };
                if (typeof data.activeTotal === 'number') setIssuesActiveTotal(data.activeTotal);
              }
            } catch { /* badge тимчасово не оновиться — некритично */ }
          }}
          onOpenSubscription={(subId) => {
            // Очищаємо всі фільтри щоб гарантовано вивести рядок у `filtered`.
            // Потім обчислюємо сторінку, на якій він знаходиться (rows впорядковані createdAt desc,
            // filtered зберігає цей порядок), і перемикаємось на неї.
            setSearch('');
            setPlanFilter('ALL');
            setStatusFilter('ALL');
            setActiveCohortId(null);
            const idx = rows.findIndex((row) => row.id === subId);
            if (idx >= 0) setPage(Math.floor(idx / pageSize) + 1);
            setExpandedId(subId);
            // Чекаємо два render-tick-и (стейт → filtered → paged → DOM) перед scrollIntoView.
            setTimeout(() => {
              const el = document.querySelector<HTMLElement>(`[data-sub-row="${subId}"]`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-amber-400/60');
                setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400/60'), 2000);
              }
            }, 150);
          }}
        />
      )}

      <AdminPanel theme={theme} padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
              <tr>
                <Th theme={theme}>{''}</Th>
                <Th theme={theme}>Створено</Th>
                <Th theme={theme}>Користувач</Th>
                <Th theme={theme}>Країна</Th>
                <Th theme={theme} align="center">
                  <ColumnFilter
                    theme={theme}
                    label="Підписка"
                    align="center"
                    options={PLAN_OPTIONS}
                    value={planFilter}
                    onChange={(v) => setPlanFilter(v as PlanFilter)}
                  />
                </Th>
                <Th theme={theme} align="center">
                  <span className="inline-flex items-center gap-1.5">
                    <ColumnFilter
                      theme={theme}
                      label="Статус"
                      align="center"
                      options={buildStatusOptions(graceDays)}
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as 'ALL' | SubStatus)}
                    />
                    <StatusInfoButton theme={theme} graceDays={graceDays} />
                  </span>
                </Th>
                <Th theme={theme}>Telegram</Th>
                <Th theme={theme}>Дата оплати</Th>
                <Th theme={theme}>Початок програми</Th>
                <Th theme={theme}>Доступ до</Th>
                <Th theme={theme} align="center" className="px-2">№</Th>
                <Th theme={theme}>Сплачено</Th>
                <Th theme={theme}>SendPulse</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    {rows.length === 0 ? 'Поки ніхто не підписався.' : 'Нічого не знайдено за фільтрами.'}
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <RowBlock
                    key={r.id}
                    r={r}
                    theme={theme}
                    graceDays={graceDays}
                    expanded={expandedId === r.id}
                    details={details[r.id]}
                    busy={busyId === r.id}
                    onToggle={() => toggleExpand(r.id)}
                    onAction={(action, payload, confirm) => runAction(r.id, action, payload, confirm)}
                    issueBadge={issueSeverityBySub[r.id]}
                    onOpenIssues={() => setIssuesOpen(true)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <PaginationBar
            theme={theme}
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageStart={pageStart}
            pageEnd={Math.min(pageStart + pageSize, filtered.length)}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        )}
      </AdminPanel>
    </AdminShell>
  );
}

function PaginationBar({
  theme,
  page,
  totalPages,
  total,
  pageStart,
  pageEnd,
  pageSize,
  onPage,
  onPageSize,
}: {
  theme: Theme;
  page: number;
  totalPages: number;
  total: number;
  pageStart: number;
  pageEnd: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const dark = theme === 'dark';
  const pages = computePageList(page, totalPages);
  const btnBase = 'inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-md text-[12px] tabular-nums transition-colors';
  const btnIdle = dark
    ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-white/[0.06]'
    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300/50';
  const btnActive = dark
    ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
    : 'bg-amber-100 text-amber-800 border border-amber-300/60';
  const btnDisabled = dark
    ? 'text-slate-600 border border-white/[0.04] cursor-not-allowed'
    : 'text-stone-300 border border-stone-200/60 cursor-not-allowed';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-[12px] ${
        dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-300/40 text-stone-600'
      }`}
    >
      <div className="tabular-nums">
        Показано <span className={dark ? 'text-slate-200' : 'text-stone-800'}>{pageStart + 1}–{pageEnd}</span> з{' '}
        <span className={dark ? 'text-slate-200' : 'text-stone-800'}>{total}</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span>На сторінці:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className={`h-7 px-2 rounded-md text-[12px] outline-none ${
              dark
                ? 'bg-white/[0.04] border border-white/[0.08] text-slate-200'
                : 'bg-white/80 border border-stone-300/60 text-stone-800'
            }`}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={`${btnBase} ${page <= 1 ? btnDisabled : btnIdle}`}
            aria-label="Попередня сторінка"
          >
            <HiOutlineChevronLeft className="text-sm" />
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`dots-${i}`} className={`${btnBase} ${dark ? 'text-slate-600' : 'text-stone-400'}`}>…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={`${btnBase} ${page >= totalPages ? btnDisabled : btnIdle}`}
            aria-label="Наступна сторінка"
          >
            <HiOutlineChevronRight className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

function computePageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push('…');
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

function RowBlock({
  r,
  theme,
  graceDays,
  expanded,
  details,
  busy,
  onToggle,
  onAction,
  issueBadge,
  onOpenIssues,
}: {
  r: Row;
  theme: Theme;
  graceDays: number;
  expanded: boolean;
  details: SubscriptionDetails | 'loading' | 'error' | undefined;
  busy: boolean;
  onToggle: () => void;
  onAction: (action: string, payload?: Record<string, unknown>, confirm?: string) => void;
  issueBadge?: { severity: 'critical' | 'warning' | 'info'; count: number };
  onOpenIssues: () => void;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <tr data-sub-row={r.id} className={`transition-shadow ${dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}`}>
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
              dark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200' : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800'
            }`}
            aria-label={expanded ? 'Сховати' : 'Показати деталі'}
          >
            {expanded ? <HiOutlineChevronUp className="text-base" /> : <HiOutlineChevronDown className="text-base" />}
          </button>
        </td>
        <td className={`px-4 py-2.5 whitespace-nowrap text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {fmtDate(r.createdAt)}
        </td>
        <td className="px-4 py-2.5">
          <div className={`text-[12px] font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{r.userName ?? '—'}</div>
          <div className={`text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.userEmail}</div>
          {r.phone && (
            <a
              href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}
              className={`mt-0.5 inline-flex items-center gap-1 text-[10px] tabular-nums ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-stone-600 hover:text-stone-900'}`}
              title={`Телефон: ${r.phone}`}
            >
              <span aria-hidden>📞</span>
              <span>{r.phone}</span>
            </a>
          )}
          {r.telegramUsername && (
            <a
              href={telegramProfileUrl(r.telegramUsername) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-0.5 inline-flex items-center gap-1 text-[10px] ${dark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-700 hover:text-sky-900'}`}
              title={`Telegram: ${r.telegramUsername}`}
            >
              <span aria-hidden>📨</span>
              <span className="tabular-nums">{r.telegramUsername}</span>
            </a>
          )}
          {r.manuallyAddedAt && (
            <span
              className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                dark ? 'bg-rose-500/12 text-rose-200 border border-rose-400/25' : 'bg-rose-50 text-rose-800 border border-rose-300/40'
              }`}
              title={`Додано вручну: ${new Date(r.manuallyAddedAt).toLocaleString('uk-UA')}${r.manuallyAddedBy ? ` · ${r.manuallyAddedBy}` : ''}`}
            >
              ✋ Додано вручну
            </span>
          )}
          {issueBadge && (
            <button
              type="button"
              onClick={onOpenIssues}
              className={`mt-1 ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                issueBadge.severity === 'critical'
                  ? dark ? 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25' : 'bg-rose-100 text-rose-900 border border-rose-300/60 hover:bg-rose-200'
                  : issueBadge.severity === 'warning'
                  ? dark ? 'bg-amber-500/15 text-amber-200 border border-amber-400/30 hover:bg-amber-500/25' : 'bg-amber-100 text-amber-900 border border-amber-300/60 hover:bg-amber-200'
                  : dark ? 'bg-white/[0.06] text-slate-300 border border-white/[0.1] hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 border border-stone-300/60 hover:bg-stone-200'
              }`}
              title={`Активних issue-ів: ${issueBadge.count}. Натисніть, щоб відкрити панель помилок.`}
            >
              ⚠ {issueBadge.severity === 'critical' ? 'Критична' : issueBadge.severity === 'warning' ? 'Увага' : 'Інфо'}
              {issueBadge.count > 1 && <span className="tabular-nums">· {issueBadge.count}</span>}
            </button>
          )}
        </td>
        <td className="px-4 py-2.5">
          {r.country ? (
            <span className={`text-[11px] ${dark ? 'text-slate-300' : 'text-stone-700'}`} title={r.country}>
              {getCountryName(r.country, 'uk', r.country)}
            </span>
          ) : (
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-center"><PlanBadge theme={theme} plan={r.plan} autoRenew={r.autoRenew} /></td>
        <td className="px-4 py-2.5 text-center"><StatusBadge theme={theme} status={r.status} graceDays={graceDays} /></td>
        <td className="px-4 py-2.5">
          <TelegramAccessBadge theme={theme} row={r} />
        </td>
        <td className={`px-4 py-2.5 text-[11px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {r.firstPaymentAt ? (
            <>
              <div>{fmtDateShort(r.firstPaymentAt)}</div>
              <div className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-500'}`}>{fmtTime(r.firstPaymentAt)}</div>
            </>
          ) : (
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
          )}
        </td>
        <td className={`px-4 py-2.5 text-[11px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {r.cohortStartDate ? (
            <>
              <div>{fmtDateShort(r.cohortStartDate)}</div>
              {r.cohortName && (
                <div className={`text-[10px] truncate max-w-[140px] ${dark ? 'text-slate-600' : 'text-stone-500'}`} title={r.cohortName}>
                  {r.cohortName}
                </div>
              )}
            </>
          ) : (
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
          )}
        </td>
        <td className={`px-4 py-2.5 text-[11px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {r.expiresAt ? (
            <>
              <div>{fmtDateShort(r.expiresAt)}</div>
              {r.daysLeft !== null && (
                <div className={`text-[10px] ${
                  r.daysLeft < 0 ? (dark ? 'text-rose-400' : 'text-rose-700')
                    : r.daysLeft <= 3 ? (dark ? 'text-amber-300' : 'text-amber-700')
                    : (dark ? 'text-slate-600' : 'text-stone-400')
                }`}>
                  {r.daysLeft < 0 ? `−${Math.abs(r.daysLeft)}д` : `${r.daysLeft}д залишилось`}
                </div>
              )}
            </>
          ) : (
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
          )}
        </td>
        <td className={`px-2 py-2.5 text-[12px] tabular-nums text-center ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{r.paymentsCount}</td>
        <td className={`px-4 py-2.5 text-[12px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
          {r.totalPaid.toLocaleString()} ₴
        </td>
        <td className="px-4 py-2.5">
          <SendpulseBadge theme={theme} openedAt={r.sendpulseAccessOpenedAt} closedAt={r.sendpulseAccessClosedAt} studentId={r.sendpulseStudentId} />
        </td>
      </tr>

      {expanded && (
        <tr className={dark ? 'bg-black/20' : 'bg-stone-50/80'}>
          <td colSpan={12} className="px-6 py-5">
            <ExpandedRowContent
              theme={theme}
              graceDays={graceDays}
              details={details}
              row={r}
              busy={busy}
              onAction={onAction}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedRowContent({
  details,
  row,
  theme,
  graceDays,
  busy,
  onAction,
}: {
  details: SubscriptionDetails | 'loading' | 'error' | undefined;
  row: Row;
  theme: Theme;
  graceDays: number;
  busy: boolean;
  onAction: (action: string, payload?: Record<string, unknown>, confirm?: string) => void;
}) {
  const dark = theme === 'dark';
  const { toast, confirm, prompt } = useUIFeedback();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [extraLaunching, setExtraLaunching] = useState(false);
  const [tgInviting, setTgInviting] = useState(false);

  async function sendTelegramInvite(force: boolean) {
    const studentLabel = row.userEmail ?? row.userName ?? 'цього студента';
    if (force) {
      const ok = await confirm({
        title: 'Перегенерувати запрошення?',
        description: `Існуюче посилання залишиться діючим, але буде створено нове для ${studentLabel}.`,
      });
      if (!ok) return;
    }
    setTgInviting(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/${row.id}/telegram-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, sendEmail: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      const emailNote = data.email?.sent
        ? ' · лист надіслано'
        : data.email?.error
          ? ` · лист FAILED: ${data.email.error}`
          : '';
      toast('success', `Telegram-запрошення згенеровано${emailNote}`);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setTgInviting(false);
    }
  }

  async function runExtraLaunch() {
    const cohortName = row.cohortName ?? 'поточну програму';
    const studentLabel = row.userEmail ?? row.userName ?? 'цього студента';
    const ok = await confirm({
      title: 'Екстра Запуск нового студента?',
      description: `Додасть студента ${studentLabel} у програму "${cohortName}". Виконує те саме, що 🚀 Запустити програму, але точково для цієї підписки.`,
      bullets: [
        { icon: '🔓', text: `Відкриває доступ у SendPulse до курсу "${cohortName}"` },
        { icon: '📅', text: 'Розраховує "Доступ до" по cohort-логіці' },
        { icon: '✉️', text: 'Шле welcome-лист (той самий шаблон cohort-у)' },
      ],
      confirmLabel: 'Запустити',
    });
    if (!ok) return;
    setExtraLaunching(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/${row.id}/extra-launch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      const emailNote = data.email?.sent
        ? ' · welcome-лист надіслано'
        : data.email?.skipped
          ? ' · лист уже відправлявся раніше'
          : data.email?.error
            ? ` · лист FAILED: ${data.email.error}`
            : '';
      toast('success', `🎯 Екстра Запуск виконано${emailNote}`);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setExtraLaunching(false);
    }
  }

  if (details === 'loading' || !details) {
    return <SubscriptionDetailsSkeleton dark={dark} />;
  }
  if (details === 'error') {
    return <div className={`text-[12px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>Не вдалося завантажити деталі.</div>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-5">
      {helpOpen && <HelpModal theme={theme} graceDays={graceDays} onClose={() => setHelpOpen(false)} />}
      <div className="md:col-span-1">
        <div className="flex items-center gap-2 mb-2">
          <SectionTitle theme={theme} className="!mb-0">Дії</SectionTitle>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Що означають статуси та дії"
            title="Що означають статуси та дії"
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors ${
              dark
                ? 'border-white/20 text-slate-400 hover:bg-white/10 hover:text-white'
                : 'border-stone-300 text-stone-500 hover:bg-stone-200 hover:text-stone-800'
            }`}
          >
            i
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {row.cohortLaunched && !row.sendpulseAccessOpenedAt && row.status !== 'ARCHIVED' && row.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={runExtraLaunch}
              disabled={busy || extraLaunching}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center gap-2 ${
                dark
                  ? 'bg-sky-500/10 border-sky-400/30 text-sky-200 hover:bg-sky-500/20 hover:border-sky-400/50'
                  : 'bg-sky-50 border-sky-300/60 text-sky-900 hover:bg-sky-100 hover:border-sky-400/70'
              }`}
              title="Відкрити SendPulse + welcome-лист для цього студента"
            >
              <span className="text-base">🎯</span>
              {extraLaunching ? 'Запускаю…' : 'Екстра Запуск нового студента'}
            </button>
          )}
          <ActionBtn theme={theme} disabled={busy || row.status === 'EXPIRED' || row.status === 'ARCHIVED'} onClick={() => {
            const days = window.prompt('На скільки днів продовжити?', '30');
            const n = Number(days);
            if (Number.isFinite(n) && n > 0) onAction('extend', { daysToAdd: n });
          }}>
            ⏱ Продовжити…
          </ActionBtn>
          {row.plan === 'MONTHLY' && row.autoRenew && (
            <ActionBtn theme={theme} disabled={busy || row.status === 'CANCELLED' || row.status === 'ARCHIVED'} tone="warning" onClick={async () => {
              const reason = await prompt({
                title: 'Скасувати автосписання?',
                description: 'WFP більше не списуватиме картку. Доступ зберігається до кінця оплаченого місяця. Причина зберігається в журналі підписки.',
                inputLabel: 'Причина скасування',
                placeholder: 'Напр.: студент написав у підтримку',
                required: true,
                minLength: 3,
                multiline: true,
                confirmLabel: 'Скасувати автосписання',
                cancelLabel: 'Не скасовувати',
                destructive: true,
              });
              if (reason === null) return;
              onAction('cancel', { reason });
            }}>
              🚫 Скасувати автосписання
            </ActionBtn>
          )}
          {!!row.sendpulseAccessOpenedAt && (
            <ActionBtn theme={theme} disabled={busy || row.status === 'EXPIRED' || row.status === 'ARCHIVED' || !!row.sendpulseAccessClosedAt} tone="warning" onClick={() =>
              onAction('close_access', undefined, 'Закрити доступ до SendPulse курсу?')
            }>
              ✕ Закрити доступ у SendPulse
            </ActionBtn>
          )}
          {!!row.sendpulseAccessOpenedAt && (
            <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="success" onClick={() =>
              onAction('reopen_access', undefined, 'Відкрити доступ до SendPulse (через event)?')
            }>
              ✓ Відкрити доступ до SendPulse
            </ActionBtn>
          )}
          <button
            type="button"
            onClick={() => sendTelegramInvite(!!details.telegramInviteLink)}
            disabled={busy || tgInviting}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center gap-2 ${
              dark
                ? 'bg-sky-500/10 border-sky-400/30 text-sky-200 hover:bg-sky-500/20 hover:border-sky-400/50'
                : 'bg-sky-50 border-sky-300/60 text-sky-900 hover:bg-sky-100 hover:border-sky-400/70'
            }`}
            title={details.telegramInviteLink ? 'Перегенерувати + надіслати лист з новим посиланням' : 'Згенерувати invite-link і надіслати листом'}
          >
            <span className="text-base">📨</span>
            {tgInviting
              ? 'Генеруємо…'
              : details.telegramInviteLink
                ? 'Перенадіслати Welcome E-mail з запрошенням в Telegram'
                : 'Надіслати Welcome E-mail з запрошенням в Telegram'}
          </button>
          {!!details.telegramJoinedAt && !details.telegramLeftAt && (
            <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="neutral" onClick={() =>
              onAction(
                'tg_kick',
                undefined,
                'Вилучити студента з Telegram-каналу? Студент видаляється, але invite-link залишається валідним — за потреби може повернутись.',
              )
            }>
              🚪 Вилучити з Telegram-каналу
            </ActionBtn>
          )}
          {(!!details.telegramJoinedAt || !!details.telegramInviteLink) && (
            <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="warning" onClick={() =>
              onAction(
                'tg_kick_revoke',
                undefined,
                'Вилучити з Telegram-каналу та закрити доступ? Студент банується (не зможе повернутись) і invite-link знечинено.',
              )
            }>
              🚫 Вилучити з Telegram та закрити доступ
            </ActionBtn>
          )}
          <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="danger" onClick={() =>
            onAction('delete', undefined, `Деактивувати та вилучити студента ${row.userEmail ?? ''} з програми? Закриємо доступ у SendPulse, вилучимо з Telegram-каналу і відкличемо invite, статус → ARCHIVED, очистимо технічні поля. ВІДКРИТИ ЗНОВУ вже не вийде.`)
          }>
            🗑 Деактивувати та Вилучити студента з програми
          </ActionBtn>
          {!row.cohortLaunched && (
            <MoveCohortBtn theme={theme} row={row} disabled={busy} />
          )}
        </div>

        {(() => {
          // Показуємо лише поля, які реально несуть інформацію (відрізняються від дефолту).
          // Якщо все «чисто» — секція взагалі не рендериться.
          const items: [string, string][] = [];
          if (details.sendpulseStudentId != null) {
            items.push(['SP studentId', details.sendpulseStudentId.toString()]);
          }
          if (details.failedChargeCount > 0) {
            items.push(['fail count', `⚠ ${details.failedChargeCount}`]);
          }
          if (details.lastChargeError) {
            items.push(['last error', details.lastChargeError]);
          }
          if (details.telegramUsername) {
            items.push(['Telegram', details.telegramUsername]);
          }
          if (details.telegramInvitedAt) {
            const inviteShort = details.telegramInviteLink ? '✓ link є' : '✓';
            items.push(['TG invite', `${inviteShort} · ${new Date(details.telegramInvitedAt).toLocaleDateString('uk-UA')}`]);
          }
          if (details.telegramLeftAt) {
            // Знаходимо останню TG-kick подію (logged через kickSubscriptionFromChannel),
            // щоб дістати mode + актора. Events впорядковані createdAt desc → перший match.
            const kickEvent = details.events.find((e) => {
              const meta = e.metadata as { mode?: string } | null;
              return meta?.mode === 'returnable' || meta?.mode === 'permanent';
            });
            const kickMeta = kickEvent?.metadata as { mode?: 'returnable' | 'permanent'; triggeredBy?: string } | null;
            const kickActor = kickMeta?.triggeredBy
              ? kickMeta.triggeredBy.replace(/^admin:/, '').split(' · ')[0]
              : null;
            const dateStr = new Date(details.telegramLeftAt).toLocaleString('uk-UA', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const actorTail = kickActor ? ` · ким: ${kickActor}` : '';
            let tgStatusLine: string;
            if (kickMeta?.mode === 'permanent') {
              tgStatusLine = details.status === 'ARCHIVED'
                ? `🗑 Деактивовано та вилучено · ${dateStr}${actorTail}`
                : `🚫 Вилучено з ТГ та забанено · ${dateStr}${actorTail}`;
            } else if (kickMeta?.mode === 'returnable') {
              tgStatusLine = `🚪 Вилучено з ТГ · ${dateStr}${actorTail}`;
            } else {
              // Жодної kick-події → юзер сам вийшов (webhook chat_member→left).
              tgStatusLine = `❌ Покинув канал · ${dateStr}`;
            }
            items.push(['TG статус', tgStatusLine]);
          } else if (details.telegramJoinedAt) {
            items.push([
              'TG статус',
              `✅ У каналі · з ${new Date(details.telegramJoinedAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
            ]);
          } else if (details.telegramInvitedAt) {
            items.push(['TG статус', '⏳ Запрошення надіслане, чекаємо приєднання']);
          }
          if (details.telegramInviteError) {
            items.push(['TG err', details.telegramInviteError]);
          }
          const anyReminder = details.reminderSent3d || details.reminderSentExpired;
          if (anyReminder) {
            items.push(['reminders', `3д:${details.reminderSent3d ? '✓' : '–'} · exp:${details.reminderSentExpired ? '✓' : '–'}`]);
          }
          if (items.length === 0) return null;
          return (
            <>
              <SectionTitle theme={theme} className="mt-5">Технічні поля</SectionTitle>
              <Dl theme={theme} items={items} />
            </>
          );
        })()}
      </div>

      <div className="md:col-span-1">
        <SectionTitle theme={theme}>Платежі ({details.payments.length})</SectionTitle>
        <div className={`rounded-lg border ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/50 bg-white/60'}`}>
          {details.payments.length === 0 ? (
            <div className={`px-3 py-4 text-center text-[11px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>Платежів ще нема</div>
          ) : (
            <div className="divide-y divide-stone-200/30 dark:divide-white/[0.04]">
              {details.payments.map((p) => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-3 text-[11px]">
                  <div className="min-w-0">
                    <div className={`font-mono text-[10px] truncate ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{p.orderReference}</div>
                    <div className={dark ? 'text-slate-600' : 'text-stone-500'}>{fmtDate(p.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                      p.status === 'PAID'
                        ? (dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800')
                        : p.status === 'PENDING'
                          ? (dark ? 'bg-slate-500/20 text-slate-300' : 'bg-stone-200 text-stone-700')
                          : (dark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-800')
                    }`}>{p.status}</span>
                    <span className={`tabular-nums font-semibold ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{p.amount.toLocaleString()}₴</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        <SectionTitle theme={theme}>Події ({details.events.length})</SectionTitle>
        <div className={`rounded-lg border max-h-[360px] overflow-y-auto ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/50 bg-white/60'}`}>
          {details.events.length === 0 ? (
            <div className={`px-3 py-4 text-center text-[11px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>Подій нема</div>
          ) : (
            <ul className="divide-y divide-stone-200/30 dark:divide-white/[0.04]">
              {details.events.map((ev) => (
                <li key={ev.id} className="px-3 py-2 text-[11px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`font-mono text-[10px] font-semibold ${eventTypeColor(ev.type, dark)}`}>{ev.type}</span>
                    <span className={`text-[9px] tabular-nums shrink-0 ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
                      {fmtDate(ev.createdAt)}
                    </span>
                  </div>
                  {ev.message && (
                    <div className={`mt-1 text-[10px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{ev.message}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function eventTypeColor(type: string, dark: boolean): string {
  if (type.startsWith('charge_failed') || type === 'access_closed') return dark ? 'text-rose-300' : 'text-rose-700';
  if (type === 'created' || type === 'access_opened' || type === 'reactivated') return dark ? 'text-emerald-300' : 'text-emerald-700';
  if (type === 'renewed') return dark ? 'text-sky-300' : 'text-sky-700';
  if (type === 'cancelled') return dark ? 'text-slate-400' : 'text-stone-600';
  if (type.startsWith('reminder')) return dark ? 'text-amber-300' : 'text-amber-700';
  return dark ? 'text-slate-400' : 'text-stone-600';
}

function ActionBtn({
  children,
  onClick,
  disabled,
  tone = 'neutral',
  theme,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneClasses = {
    neutral: dark ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]' : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white',
    warning: dark ? 'bg-amber-500/[0.08] border-amber-400/20 text-amber-200 hover:bg-amber-500/[0.15]' : 'bg-amber-50 border-amber-300/50 text-amber-800 hover:bg-amber-100',
    danger:  dark ? 'bg-rose-500/[0.08] border-rose-400/20 text-rose-200 hover:bg-rose-500/[0.15]' : 'bg-rose-50 border-rose-300/50 text-rose-800 hover:bg-rose-100',
    success: dark ? 'bg-emerald-500/[0.08] border-emerald-400/20 text-emerald-200 hover:bg-emerald-500/[0.15]' : 'bg-emerald-50 border-emerald-300/50 text-emerald-800 hover:bg-emerald-100',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left ${toneClasses}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ theme, children, className = '' }: { theme: Theme; children: React.ReactNode; className?: string }) {
  const dark = theme === 'dark';
  return (
    <h3 className={`text-[10px] uppercase tracking-[0.18em] font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-stone-500'} ${className}`}>
      {children}
    </h3>
  );
}

function Dl({ theme, items }: { theme: Theme; items: [string, string][] }) {
  const dark = theme === 'dark';
  return (
    <dl className="space-y-1 text-[11px]">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-2">
          <dt className={dark ? 'text-slate-600' : 'text-stone-400'}>{k}</dt>
          <dd className={`font-mono text-[10px] text-right ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const KYIV_DATETIME_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const KYIV_DATE_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const KYIV_TIME_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Kyiv',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function fmtDate(iso: string): string {
  return KYIV_DATETIME_FMT.format(new Date(iso)).replace(',', '');
}

function fmtDateShort(iso: string): string {
  return KYIV_DATE_FMT.format(new Date(iso));
}

function fmtTime(iso: string): string {
  return KYIV_TIME_FMT.format(new Date(iso));
}

function Th({
  children,
  theme,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  theme: Theme;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const dark = theme === 'dark';
  const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <th className={`${alignCls} px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap ${dark ? 'text-slate-500' : 'text-stone-500'} ${className}`}>
      {children}
    </th>
  );
}

/// Фільтр у шапці колонки таблиці. Текст-лейбл + chevron + крапка-індикатор активного фільтра;
/// клік відкриває dropdown з опціями. ALL-значення (перша опція) не вважається активним.
function ColumnFilter<T extends string>({
  label,
  value,
  options,
  onChange,
  theme,
  align = 'left',
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  theme: Theme;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /// Позиціонуємо меню через portal на document.body, щоб воно не клипалось
  /// батьківським `overflow-x-auto` навколо таблиці.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = menuRef.current?.offsetWidth ?? 180;
      let left: number;
      if (align === 'center') left = r.left + r.width / 2 - menuW / 2;
      else if (align === 'right') left = r.right - menuW;
      else left = r.left;
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));
      setCoords({ top: r.bottom + 6 + window.scrollY, left: left + window.scrollX });
    };
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const allValue = options[0]?.value;
  const isFiltered = value !== allValue;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 transition-colors ${
          dark
            ? isFiltered ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'
            : isFiltered ? 'text-amber-800' : 'text-stone-500 hover:text-stone-700'
        }`}
      >
        {label}
        {isFiltered && (
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${dark ? 'bg-amber-400' : 'bg-amber-500'}`} />
        )}
        <HiOutlineChevronDown className={`text-[11px] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            minWidth: 180,
            zIndex: 320,
            opacity: coords ? 1 : 0,
          }}
          className={`rounded-lg border shadow-2xl overflow-hidden ${
            dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'
          }`}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-3 text-[12px] normal-case tracking-normal transition-colors ${
                  selected
                    ? dark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-900'
                    : dark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-stone-800 hover:bg-stone-100'
                }`}
              >
                <span>{o.label}</span>
                {selected && <HiOutlineCheck className="text-sm" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

/// Компактний inline-KPI для горизонтального summary-strip всередині workspace-карточки.
/// Менший за Kpi і без власної комірки/border-у — підходить для одного рядка.
function KpiInline({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  theme,
  big = false,
  hint,
  suffix,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  theme: Theme;
  big?: boolean;
  /// Native browser tooltip — короткий опис що означає цифра.
  hint?: string;
  /// Малий додатковий текст після основного value (напр. конверсія у %).
  suffix?: string;
}) {
  const dark = theme === 'dark';
  const toneColor = {
    neutral: dark ? 'text-slate-100' : 'text-stone-900',
    success: dark ? 'text-emerald-300' : 'text-emerald-700',
    warning: dark ? 'text-amber-300' : 'text-amber-700',
    danger: dark ? 'text-rose-300' : 'text-rose-700',
  }[tone];
  return (
    <div className="inline-flex items-baseline gap-1.5" title={hint}>
      <Icon className={`shrink-0 self-center text-[13px] ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
      <span className={`text-[11px] uppercase tracking-[0.14em] font-medium ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
        {label}
      </span>
      <span className={`tabular-nums font-semibold ${big ? 'text-[16px]' : 'text-[14px]'} ${toneColor}`}>{value}</span>
      {suffix && (
        <span className={`text-[10px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          · {suffix}
        </span>
      )}
    </div>
  );
}

function KpiDot({ dark }: { dark: boolean }) {
  return <span className={`shrink-0 select-none text-[10px] ${dark ? 'text-white/[0.15]' : 'text-stone-300'}`}>•</span>;
}

function PlanBadge({ plan, autoRenew, theme }: { plan: Plan; autoRenew: boolean; theme: Theme }) {
  const dark = theme === 'dark';
  if (plan === 'YEARLY') {
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
        dark ? 'bg-amber-500/15 text-amber-300 border border-amber-400/20' : 'bg-amber-100 text-amber-800 border border-amber-300/50'
      }`}>Річний</span>
    );
  }
  if (autoRenew) {
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
        dark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-100 text-emerald-800 border border-emerald-300/50'
      }`}>Місячний Автоплатіж</span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
      dark ? 'bg-sky-500/15 text-sky-300 border border-sky-400/20' : 'bg-sky-100 text-sky-800 border border-sky-300/50'
    }`}>Місячний на 1 міс.</span>
  );
}

function StatusBadge({ status, theme, graceDays }: { status: SubStatus; theme: Theme; graceDays: number }) {
  const dark = theme === 'dark';
  const map: Record<SubStatus, { label: string; dark: string; light: string }> = {
    ACTIVE:    { label: 'Активний',    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20', light: 'bg-emerald-100 text-emerald-800 border-emerald-300/50' },
    GRACE:     { label: `Grace (${graceDays} ${pluralizeDays(graceDays)})`, dark: 'bg-amber-500/15 text-amber-300 border-amber-400/20',       light: 'bg-amber-100 text-amber-800 border-amber-300/50' },
    EXPIRED:   { label: 'Доступ закрито', dark: 'bg-rose-500/15 text-rose-300 border-rose-400/20',          light: 'bg-rose-100 text-rose-800 border-rose-300/50' },
    CANCELLED: { label: 'Скасовано',   dark: 'bg-slate-500/15 text-slate-300 border-slate-400/20',      light: 'bg-stone-200 text-stone-700 border-stone-300/60' },
    PENDING:   { label: 'Очікує',      dark: 'bg-slate-500/15 text-slate-400 border-slate-400/10',      light: 'bg-stone-100 text-stone-600 border-stone-300/50' },
    ARCHIVED:  { label: 'Архів',       dark: 'bg-zinc-700/30 text-zinc-400 border-zinc-500/20',         light: 'bg-zinc-200 text-zinc-600 border-zinc-300/60' },
  };
  const cls = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
      dark ? cls.dark : cls.light
    }`}>{cls.label}</span>
  );
}

/// «i» біля колонки Статус — popover з поясненням кожного статусу підписки
/// (аналог StatusInfoButton на /dashboard/admin/payments).
function StatusInfoButton({ theme, graceDays }: { theme: Theme; graceDays: number }) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: { status: SubStatus; desc: string }[] = [
    { status: 'PENDING', desc: 'Людина почала оформлення, але оплата ще не пройшла — доступу немає. Найчастіше: не завершила платіж, банк відхилив картку, або платіж ще в обробці. Якщо оплата не надходить понад 24 години — підписка автоматично переходить в Архів.' },
    { status: 'ACTIVE', desc: 'Оплата пройшла, доступ до курсу відкрито — людина навчається.' },
    { status: 'GRACE', desc: `Термін доступу закінчився, але триває пільговий період (${graceDays} ${pluralizeDays(graceDays)}) — щоб встигнути продовжити без втрати доступу.` },
    { status: 'EXPIRED', desc: 'Доступ до курсу в SendPulse закрито — автоматично після grace-періоду або вручну менеджером.' },
    { status: 'CANCELLED', desc: 'Платну підписку скасовано (користувачем або менеджером). Для місячної автосписання зупинено; доступ зберігається до кінця вже оплаченого періоду.' },
    { status: 'ARCHIVED', desc: 'Відкладено як неактуальне: незавершені спроби оплати (авто-архів через 24 год) або заархівоване менеджером вручну. У списку за замовчуванням сховано — щоб побачити, оберіть фільтр «Архів».' },
  ];

  return (
    <div ref={ref} className="relative inline-block normal-case tracking-normal">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Що означають статуси"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
          dark
            ? 'text-amber-300 border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25'
            : 'text-amber-800 border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25'
        }`}
      >
        <HiOutlineInformationCircle className="text-[14px]" />
      </button>
      {open && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-[440px] max-w-[calc(100vw-32px)] rounded-xl py-2 z-30 backdrop-blur-md border ${
            dark
              ? 'bg-[#161821]/95 border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 border-stone-300/60 shadow-[0_12px_32px_rgba(68,64,60,0.15)]'
          }`}
        >
          <div className={`px-3 pb-2 mb-1 border-b text-[11px] font-semibold uppercase tracking-[0.18em] ${
            dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-200 text-stone-500'
          }`}>
            Статуси підписки
          </div>
          {items.map((it) => (
            <div key={it.status} className="px-3 py-2 flex items-start gap-3">
              <span className="shrink-0 w-[110px] flex justify-start mt-0.5">
                <StatusBadge status={it.status} theme={theme} graceDays={graceDays} />
              </span>
              <p className={`min-w-0 flex-1 text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SendpulseBadge({
  openedAt,
  closedAt,
  studentId,
  theme,
}: {
  openedAt: string | null;
  closedAt: string | null;
  studentId: number | null;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  if (closedAt) {
    return (
      <span className={`text-[10px] ${dark ? 'text-rose-400' : 'text-rose-700'}`} title={`Закрито: ${closedAt}${studentId ? ` · id=${studentId}` : ''}`}>
        ✕ закрито
      </span>
    );
  }
  if (openedAt) {
    return (
      <span className={`text-[10px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`} title={`Відкрито: ${openedAt}${studentId ? ` · id=${studentId}` : ''}`}>
        ✓ відкрито
      </span>
    );
  }
  return <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>—</span>;
}

/// Pill для Telegram-доступу. Стани:
///   ✓ у каналі (зелений) — webhook зафіксував approve або chat_member→member
///   🗑 Деактивовано (rose-dim) — підписка ARCHIVED + покинув канал
///   🚪 Вилучено (rose) — покинув канал, але підписка ще жива (returnable kick / сам вийшов)
///   ⏳ запрошення (амбер) — invite згенеровано, але не приєднався
///   — (сірий) — нічого не зроблено
function TelegramAccessBadge({ theme, row }: { theme: Theme; row: Row }) {
  const dark = theme === 'dark';
  if (row.telegramLeftAt) {
    if (row.status === 'ARCHIVED') {
      return (
        <span
          className={`text-[10px] ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}
          title={`Деактивовано: ${fmtDate(row.telegramLeftAt)}`}
        >
          🗑 Деактивовано
        </span>
      );
    }
    return (
      <span
        className={`text-[10px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}
        title={`Вилучено: ${fmtDate(row.telegramLeftAt)}`}
      >
        🚪 Вилучено
      </span>
    );
  }
  if (row.telegramJoinedAt) {
    return (
      <span
        className={`text-[10px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}
        title={`У каналі з: ${fmtDate(row.telegramJoinedAt)}`}
      >
        ✓ у каналі
      </span>
    );
  }
  if (row.telegramInvitedAt) {
    return (
      <span
        className={`text-[10px] ${dark ? 'text-amber-300' : 'text-amber-700'}`}
        title={`Запрошення надіслано: ${fmtDate(row.telegramInvitedAt)}`}
      >
        ⏳ запрошення
      </span>
    );
  }
  return <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>—</span>;
}

function HelpModal({ theme, graceDays, onClose }: { theme: Theme; graceDays: number; onClose: () => void }) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const graceWord = pluralizeDays(graceDays);
  const statuses: { badge: string; name: string; desc: string; cls: string }[] = [
    { badge: 'PENDING',   name: 'Очікує',     desc: 'Підписка створена, але оплата ще не надійшла. Доступу немає.', cls: dark ? 'bg-slate-500/15 text-slate-400' : 'bg-stone-100 text-stone-600' },
    { badge: 'ACTIVE',    name: 'Активний',   desc: 'Все добре — оплата пройшла, доступ відкрито, користувач навчається.', cls: dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800' },
    { badge: 'GRACE',     name: 'Grace',      desc: `Термін доступу закінчився, але є ${graceDays} ${graceWord} пільгового періоду — встигнемо продовжити без втрати доступу.`, cls: dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800' },
    { badge: 'EXPIRED',   name: 'Доступ закрито', desc: 'Доступ до курсу в SendPulse закрито — автоматично після grace-періоду або вручну менеджером.', cls: dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-800' },
    { badge: 'CANCELLED', name: 'Скасовано',  desc: 'Користувач/адмін скасував підписку. Для MONTHLY автосписання зупинено. Доступ зберігається до кінця оплаченого періоду.', cls: dark ? 'bg-slate-500/15 text-slate-300' : 'bg-stone-200 text-stone-700' },
    { badge: 'ARCHIVED',  name: 'Архів',      desc: 'Адмін заархівував. Доступ у SendPulse закрито, технічні поля очищено. Картка лишається як історичний запис, але відновити не можна.', cls: dark ? 'bg-zinc-700/30 text-zinc-400' : 'bg-zinc-200 text-zinc-600' },
  ];

  const actions: { icon: string; name: string; desc: string }[] = [
    { icon: '🎯', name: 'Екстра Запуск нового студента', desc: 'З\'являється коли студент оплатив підписку ПІСЛЯ того, як cohort вже запущено. Звичайний "Запустити програму" відпрацював раніше і цього новачка пропустив. Кнопка точково відкриває йому доступ у SendPulse через event і шле welcome-лист (як і всім решта при загальному launch).' },
    { icon: '⏱', name: 'Продовжити', desc: 'Додає вказану кількість днів до поточного терміну доступу. Корисно для бонусів, подарунків чи компенсацій.' },
    { icon: '🚫', name: 'Скасувати автосписання', desc: 'Зупиняє автоматичні списання з картки на боці WayForPay і ставить статус CANCELLED. Доступ зберігається до кінця оплаченого місяця. Кнопка з\'являється тільки для місячних підписок з активним автоплатежем — для річних і одноразових місячних її нема.' },
    { icon: '✕', name: 'Закрити доступ у SendPulse', desc: 'Миттєво забирає доступ до курсу в SendPulse. Підписка стає EXPIRED. Заодно вилучає студента з Telegram-каналу у returnable-режимі (invite-link лишається валідним — за потреби студент може повернутись через "Відкрити доступ до SendPulse"). Для MONTHLY-автоплатежів додатково знімає WFP-регулярки, щоб не йшли orphan-списання.' },
    { icon: '✓', name: 'Відкрити доступ до SendPulse', desc: 'Відновлює доступ у SendPulse через event + продовжує термін згідно плану (YEARLY +365д, MONTHLY +30д). Якщо студент був забанений у ТГ-каналі (через "Вилучити з ТГ та закрити доступ" або "Деактивувати") — окремо тисни 📨, тоді auto-unban зробить його придатним для нового invite. Не працює для статусу ARCHIVED.' },
    { icon: '📨', name: 'Надіслати / Перенадіслати Welcome E-mail з запрошенням в Telegram', desc: 'Генерує одноразовий invite-link у ТГ-канал і шле його студенту листом. Перед генерацією виконує auto-unban (only_if_banned=true) — якщо студент раніше був вилучений+забанений, він зможе зайти за новим посиланням. Idempotent: якщо invite-link уже згенерований і не передано force — повертає існуючий без створення дубля.' },
    { icon: '🚪', name: 'Вилучити з Telegram-каналу', desc: 'Тільки видаляє студента з ТГ-каналу (без зміни SendPulse-доступу). Returnable-кік: ban+unban одразу, тож invite-link залишається валідним і студент може повернутись по ньому. Кнопка з\'являється тільки якщо студент зараз у каналі.' },
    { icon: '🚫', name: 'Вилучити з Telegram та закрити доступ', desc: 'Permanent-кік: видаляє з ТГ-каналу + банить (без unban) + revokeChatInviteLink на старе посилання. SendPulse-доступ не чіпає. Студент не зможе повернутись поки хтось не натисне 📨 (це знімає бан і генерує новий invite). Кнопка з\'являється якщо є invite-link або студент уже був у каналі.' },
    { icon: '🗑', name: 'Деактивувати та Вилучити студента з програми', desc: 'Найжорсткіша дія: назавжди закриває доступ у SendPulse, вилучає з ТГ-каналу у permanent-режимі (бан + revoke invite), знімає WFP-регулярки, очищає технічні поля (studentId), ставить статус ARCHIVED. Картка лишається в адмінці як історичний архів. Відновити не можна. Для підтвердження треба ввести email.' },
    { icon: '↩️', name: 'Відмінити запуск (Super Admin)', desc: 'Видима лише в expanded-панелі cohort-у і лише для super-admin акаунтів (env SUPER_ADMIN_EMAILS). Скидає прапорці launchedAt / launchScheduledFor / emailScheduledFor у null. Чисто rollback стану кнопки запуску — НЕ закриває SendPulse-доступ і не змінює expiresAt підписок, надіслані welcome-листи теж лишаються. Корисно для повторного тестування флоу.' },
  ];

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'}`}>
          <h3 className="text-base font-bold">Статуси та дії — довідка</h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <section>
            <h4 className="text-[12px] uppercase tracking-wider font-semibold mb-2 opacity-60">Статуси підписки</h4>
            <div className="space-y-2">
              {statuses.map((s) => (
                <div key={s.badge} className="flex items-start gap-3">
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}>{s.name}</span>
                  <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[12px] uppercase tracking-wider font-semibold mb-2 opacity-60">Що робить кожна дія</h4>
            <div className="space-y-2">
              {actions.map((a) => (
                <div key={a.name} className={`p-3 rounded-lg border ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-stone-200 bg-stone-50/50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{a.icon}</span>
                    <span className="text-[12px] font-bold">{a.name}</span>
                  </div>
                  <p className={`text-[11px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{a.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[12px] uppercase tracking-wider font-semibold mb-2 opacity-60">Блокування повторної купівлі</h4>
            <div className={`p-3 rounded-lg border space-y-2 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-stone-200 bg-stone-50/50'}`}>
              <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                Поки в користувача є активна підписка (статуси <span className="font-semibold">PENDING</span> / <span className="font-semibold">ACTIVE</span> / <span className="font-semibold">GRACE</span> з принаймні однією PAID-оплатою), нові оплати блокуються за такими правилами:
              </p>
              <ul className={`text-[12px] leading-snug list-disc pl-5 space-y-1 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                <li><span className="font-semibold">YEARLY активна</span> → блокує все (нову YEARLY, MONTHLY разову, MONTHLY автоплатіж).</li>
                <li><span className="font-semibold">MONTHLY автоплатіж активна</span> (autoRenew=true) → блокує все. Спочатку треба скасувати автосписання.</li>
                <li><span className="font-semibold">MONTHLY разова активна</span> (autoRenew=false) → блокує тільки YEARLY. На місячну (разова чи апгрейд на автоплатіж) дозволяє через стандартний reuse.</li>
              </ul>
              <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                Розблоковується тільки коли підписка переходить у <span className="font-semibold">EXPIRED</span> / <span className="font-semibold">CANCELLED</span> / <span className="font-semibold">ARCHIVED</span> (автоматично через grace або вручну менеджером).
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дні';
  return 'днів';
}

function GraceSettingsModal({
  theme,
  initialDays,
  onClose,
}: {
  theme: Theme;
  initialDays: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState<string>(String(initialDays));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // MIN=2 — при grace=1 cron-розклад не має сенсу: «start» (день +1) і «закриття» (день +2)
  // йдуть поспіль за 24h, студент отримує плутанину «доступ продовжено на 1 день» → одразу
  // «доступ закрито». Мінімум 2 дні дають хоча б один день тиші між повідомленнями.
  const MIN = 2;
  const MAX = 30;
  const PRESETS = [3, 5, 7, 14, 30];

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const parsed = Number(days);
  const valid = Number.isInteger(parsed) && parsed >= MIN && parsed <= MAX;
  const dirty = valid && parsed !== initialDays;
  const previewN = valid ? parsed : initialDays;
  const previewWord = pluralizeDays(previewN);
  const initialWord = pluralizeDays(initialDays);

  function bump(delta: number) {
    const base = valid ? parsed : initialDays;
    const next = Math.min(MAX, Math.max(MIN, base + delta));
    setDays(String(next));
    setError(null);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/yearly-program/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ graceDays: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Не вдалося зберегти');
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(`Помилка: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <div className="flex items-center gap-3">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-[18px] ${
              dark
                ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300/60'
            }`} aria-hidden>
              <HiOutlineClock className="w-[18px] h-[18px]" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold leading-tight">Пільговий період</h3>
              <p className={`text-[11px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                ACTIVE → GRACE у Річній програмі
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
              dark ? 'hover:bg-white/10 text-slate-400 hover:text-slate-200' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-700'
            }`}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Hero — current vs new */}
          <div className={`relative rounded-2xl px-5 py-4 overflow-hidden ${
            dark
              ? 'bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.06] to-transparent ring-1 ring-amber-400/20'
              : 'bg-gradient-to-br from-amber-50 via-amber-50/50 to-white ring-1 ring-amber-300/40'
          }`}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${dark ? 'text-amber-300/70' : 'text-amber-700/80'}`}>
                  Поточне значення
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-[42px] leading-none font-bold tabular-nums ${dark ? 'text-amber-200' : 'text-amber-800'}`}>
                    {initialDays}
                  </span>
                  <span className={`text-[15px] font-medium ${dark ? 'text-amber-300/80' : 'text-amber-700/90'}`}>
                    {initialWord}
                  </span>
                </div>
              </div>
              {dirty && (
                <div className="text-right">
                  <div className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${dark ? 'text-emerald-300/80' : 'text-emerald-700/80'}`}>
                    Стане
                  </div>
                  <div className="mt-1 flex items-baseline justify-end gap-2">
                    <span className={`text-[28px] leading-none font-bold tabular-nums ${dark ? 'text-emerald-200' : 'text-emerald-700'}`}>
                      {parsed}
                    </span>
                    <span className={`text-[12px] font-medium ${dark ? 'text-emerald-300/80' : 'text-emerald-700/90'}`}>
                      {previewWord}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stepper + presets */}
          <div>
            <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-2 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              Кількість днів
            </label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => bump(-1)}
                disabled={!valid || parsed <= MIN}
                aria-label="Зменшити"
                className={`w-10 rounded-xl border text-[18px] font-semibold transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
                    : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >−</button>
              <div className="relative flex-1">
                <input
                  type="number"
                  min={MIN}
                  max={MAX}
                  value={days}
                  onChange={(e) => { setDays(e.target.value); setError(null); }}
                  className={`w-full h-10 px-3 pr-14 rounded-xl border text-[18px] font-semibold tabular-nums text-center outline-none transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-100 focus:border-amber-400/60 focus:bg-white/[0.06]'
                      : 'bg-white border-stone-300 text-stone-900 focus:border-amber-500/70'
                  }`}
                />
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium pointer-events-none ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  {previewWord}
                </span>
              </div>
              <button
                type="button"
                onClick={() => bump(1)}
                disabled={!valid || parsed >= MAX}
                aria-label="Збільшити"
                className={`w-10 rounded-xl border text-[18px] font-semibold transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
                    : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >+</button>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={MIN}
              max={MAX}
              value={valid ? parsed : initialDays}
              onChange={(e) => { setDays(e.target.value); setError(null); }}
              className={`mt-3 w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 ${
                dark ? 'bg-white/10' : 'bg-stone-200'
              }`}
              style={{ accentColor: dark ? '#fbbf24' : '#d97706' }}
            />
            <div className={`mt-1 flex justify-between text-[10px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
              <span>{MIN}</span>
              <span>10</span>
              <span>20</span>
              <span>{MAX}</span>
            </div>

            {/* Presets */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const active = valid && parsed === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setDays(String(p)); setError(null); }}
                    className={`px-3 py-1 rounded-full text-[12px] font-semibold tabular-nums transition-colors ${
                      active
                        ? dark
                          ? 'bg-amber-400 text-stone-900'
                          : 'bg-stone-900 text-amber-100'
                        : dark
                          ? 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                          : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {p} {pluralizeDays(p)}
                  </button>
                );
              })}
            </div>

            {!valid && days !== '' && (
              <p className={`mt-2 text-[11px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>
                Ціле число від {MIN} до {MAX}
              </p>
            )}
            {error && (
              <p className={`mt-2 text-[11px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>{error}</p>
            )}
          </div>

          {/* Live preview of email phrase */}
          <div className={`rounded-xl px-4 py-3 ${
            dark ? 'bg-white/[0.03] border border-white/[0.08]' : 'bg-stone-50 border border-stone-200'
          }`}>
            <div className={`text-[10px] uppercase tracking-[0.14em] font-semibold mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              У листі студенту
            </div>
            <p className={`text-[13px] leading-relaxed ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
              «Доступ ще на <strong className={dark ? 'text-amber-300' : 'text-amber-700'}>{previewN} {previewWord}</strong> — встигніть оформити нову оплату до закриття».
            </p>
          </div>

          {/* Info */}
          <div className={`flex gap-2 text-[11.5px] leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            <span className={`flex-shrink-0 mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-400'}`} aria-hidden>ℹ</span>
            <p>
              Застосовується <strong>до нових переходів</strong> ACTIVE → GRACE.
              Уже активні GRACE-записи зберігають свою дату закриття.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between gap-3 px-6 py-3 border-t ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/50'}`}>
          <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {dirty
              ? <>Зміни <span className={dark ? 'text-amber-300' : 'text-amber-700'}>не збережено</span></>
              : 'Без змін'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              Скасувати
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className={`px-5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                dark
                  ? 'bg-amber-400 text-stone-900 hover:bg-amber-300'
                  : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
              }`}
            >
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProgramPricingModal({
  theme,
  initial,
  defaults,
  onClose,
}: {
  theme: Theme;
  initial: YearlyProgramSettings;
  defaults: ProgramDefaults;
  onClose: () => void;
}) {
  const router = useRouter();
  const dark = theme === 'dark';
  const { confirm } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [yearlyPrice, setYearlyPrice] = useState<string>(String(initial.yearlyPrice));
  const [monthlyPrice, setMonthlyPrice] = useState<string>(String(initial.monthlyPrice));
  const [btnLabel, setBtnLabel] = useState<string>(initial.btnLabel);
  const [priceNote, setPriceNote] = useState<string>(initial.priceNote);
  const [duration, setDuration] = useState<string>(initial.duration);
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(initial.registrationOpen);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const yp = Number(yearlyPrice);
  const mp = Number(monthlyPrice);
  const ypValid = Number.isInteger(yp) && yp > 0;
  const mpValid = Number.isInteger(mp) && mp > 0;
  const valid = ypValid && mpValid;
  const dirty =
    valid &&
    (yp !== initial.yearlyPrice ||
      mp !== initial.monthlyPrice ||
      btnLabel.trim() !== initial.btnLabel ||
      priceNote.trim() !== initial.priceNote ||
      duration.trim() !== initial.duration ||
      registrationOpen !== initial.registrationOpen);

  const hasAnyOverride =
    initial.overrides.yearlyPrice ||
    initial.overrides.monthlyPrice ||
    initial.overrides.btnLabel ||
    initial.overrides.priceNote ||
    initial.overrides.duration ||
    initial.registrationOpen !== defaults.registrationOpen;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/yearly-program/program-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          yearlyPrice: yp,
          monthlyPrice: mp,
          btnLabel: btnLabel.trim() === defaults.btnLabel ? null : btnLabel.trim(),
          priceNote: priceNote.trim() === defaults.priceNote ? null : priceNote.trim(),
          duration: duration.trim() === defaults.duration ? null : duration.trim(),
          registrationOpen,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Не вдалося зберегти');
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(`Помилка: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    if (resetting) return;
    const ok = await confirm({
      title: 'Скинути всі поля до значень за замовчуванням?',
      description: 'Налаштування цін, тривалості, тексту кнопки і реєстрації повернуться до дефолтних значень коду.',
      confirmLabel: 'Скинути',
      destructive: true,
    });
    if (!ok) return;
    setResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/yearly-program/program-settings', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Не вдалося скинути');
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(`Помилка: ${(e as Error).message}`);
    } finally {
      setResetting(false);
    }
  }

  const inputCls = `w-full px-3 py-2 rounded-lg border text-[14px] outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.1] text-slate-100 focus:border-amber-400/50 placeholder:text-slate-600'
      : 'bg-white border-stone-300 text-stone-900 focus:border-amber-600/60 placeholder:text-stone-400'
  }`;
  const labelCls = `block text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`;
  const helpCls = `text-[11px] mt-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`;

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-3xl w-full rounded-2xl shadow-2xl max-h-[95vh] flex flex-col [&_*]:[scrollbar-width:none] [&_*::-webkit-scrollbar]:hidden ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold">Вартість програми</h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <p className={`text-[12px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            Налаштування публічної сторінки <code className={`px-1 py-0.5 rounded ${dark ? 'bg-white/[0.05]' : 'bg-stone-100'}`}>/yearly-program</code>.
            Зміни застосовуються одразу після збереження.
          </p>

          {/* Toggle registrationOpen */}
          <div className={`rounded-xl border px-4 py-3 ${
            registrationOpen
              ? dark ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-emerald-500/40 bg-emerald-50'
              : dark ? 'border-rose-400/30 bg-rose-500/10' : 'border-rose-500/40 bg-rose-50'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold">
                  {registrationOpen ? 'Реєстрація відкрита' : 'Реєстрація закрита'}
                </p>
                <p className={`text-[11px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  {registrationOpen
                    ? 'Кнопки реєстрації активні — клік відкриває оплату/скрол до прайсу.'
                    : 'Кнопки реєстрації неактивні — клік нічого не робить.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegistrationOpen((v) => !v)}
                role="switch"
                aria-checked={registrationOpen}
                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                  registrationOpen
                    ? dark ? 'bg-emerald-400' : 'bg-emerald-500'
                    : dark ? 'bg-white/20' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    registrationOpen ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Оплата за рік (грн)</label>
              <input
                type="number"
                min={1}
                value={yearlyPrice}
                onChange={(e) => { setYearlyPrice(e.target.value); setError(null); }}
                className={inputCls}
              />
              {!ypValid && yearlyPrice !== '' && (
                <p className={`mt-1 text-[11px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>Ціле число &gt; 0</p>
              )}
              <p className={helpCls}>Дефолт: {defaults.yearlyPrice.toLocaleString('uk-UA')} грн</p>
            </div>
            <div>
              <label className={labelCls}>Щомісячна оплата (грн)</label>
              <input
                type="number"
                min={1}
                value={monthlyPrice}
                onChange={(e) => { setMonthlyPrice(e.target.value); setError(null); }}
                className={inputCls}
              />
              {!mpValid && monthlyPrice !== '' && (
                <p className={`mt-1 text-[11px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>Ціле число &gt; 0</p>
              )}
              <p className={helpCls}>Дефолт: {defaults.monthlyPrice.toLocaleString('uk-UA')} грн</p>
            </div>
          </div>

          {/* Button label */}
          <div>
            <label className={labelCls}>Текст кнопок реєстрації</label>
            <input
              type="text"
              value={btnLabel}
              onChange={(e) => { setBtnLabel(e.target.value); setError(null); }}
              placeholder={defaults.btnLabel}
              className={inputCls}
            />
            <p className={helpCls}>
              Замінює напис на всіх кнопках реєстрації (Hero, блок «Вартість програми», нижній CTA). Дефолт: «{defaults.btnLabel}».
            </p>
          </div>

          {/* Flyer fields */}
          <div className={`rounded-xl border p-3 ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/40'}`}>
            <p className={`text-[11px] uppercase tracking-wider font-semibold mb-3 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              Флаєр у Hero-блоці
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Щомісячний платіж (значення)</label>
                <input
                  type="text"
                  value={priceNote}
                  onChange={(e) => { setPriceNote(e.target.value); setError(null); }}
                  placeholder={defaults.priceNote}
                  className={inputCls}
                />
                <p className={helpCls}>Праве значення поряд з підписом «Щомісячний платіж». Дефолт: «{defaults.priceNote}».</p>
              </div>
              <div>
                <label className={labelCls}>Тривалість (значення)</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => { setDuration(e.target.value); setError(null); }}
                  placeholder={defaults.duration}
                  className={inputCls}
                />
                <p className={helpCls}>Праве значення поряд з підписом «Тривалість». Дефолт: «{defaults.duration}».</p>
              </div>
            </div>
          </div>

          {error && (
            <p className={`text-[12px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>{error}</p>
          )}
        </div>

        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <button
            onClick={resetAll}
            disabled={!hasAnyOverride || resetting || saving}
            className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              dark
                ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
            title="Скинути всі поля до дефолту"
          >
            {resetting ? '...' : 'Скинути до дефолту'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              Скасувати
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                dark
                  ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300'
                  : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
              }`}
            >
              {saving ? '...' : 'Зберегти'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/// Skeleton деталей підписки під час GET /:id/details. Імітує реальний layout (3-колонковий grid:
/// Дії | Платежі | Події), щоб модалка не «стрибала» висотою коли дані прийдуть.
function SubscriptionDetailsSkeleton({ dark }: { dark: boolean }) {
  const SectionCol = ({ title, rows, delay = 0 }: { title: string; rows: number; delay?: number }) => (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <SkeletonBox dark={dark} width="60px" height="14px" delay={delay} />
        <span className={`text-[10.5px] uppercase tracking-wider font-semibold ${dark ? 'text-slate-600' : 'text-stone-400'}`}>{title}</span>
      </div>
      <div className={`rounded-lg border ${dark ? 'border-white/10 bg-zinc-900/40' : 'border-stone-200 bg-stone-50/40'} p-3 space-y-2`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <SkeletonBox dark={dark} width="24px" height="24px" delay={delay + i * 60} rounded="rounded-md" />
            <div className="flex-1 space-y-1">
              <SkeletonBox dark={dark} width="55%" height="10px" delay={delay + i * 60 + 40} />
              <SkeletonBox dark={dark} width="80%" height="8px" delay={delay + i * 60 + 100} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-5">
        <SectionCol title="Дії" rows={5} delay={0} />
        <SectionCol title="Платежі" rows={3} delay={120} />
        <SectionCol title="Події" rows={4} delay={240} />
      </div>
      <SkeletonFooterTick dark={dark} label="Завантажую деталі підписки…" />
    </div>
  );
}
