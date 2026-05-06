'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
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
  HiOutlineEnvelope,
  HiOutlineArrowRightCircle,
  HiOutlineCurrencyDollar,
} from 'react-icons/hi2';
import type { YearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import type { Row, SubStatus, Plan, SummaryData, CohortListItem } from './types';
import CohortHeader from './CohortHeader';
import CohortActions from './CohortActions';
import CreateCohortModal from './CreateCohortModal';
import MoveCohortBtn from './MoveCohortBtn';
import { UIFeedbackProvider, useUIFeedback } from './UIFeedback';
import PaymentTemplatesModal from './PaymentTemplatesModal';
import ProgramSettingButton from './ProgramSettingButton';
import { type TelegramSettingsState } from './TelegramChannelButton';
import { flagEmoji, getCountryName } from '@/lib/countries';
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

const STATUS_OPTIONS: { value: 'ALL' | SubStatus; label: string }[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'ACTIVE', label: 'Активний' },
  { value: 'GRACE', label: 'Grace (7 днів)' },
  { value: 'EXPIRED', label: 'Доступ закрито' },
  { value: 'CANCELLED', label: 'Скасовано' },
  { value: 'PENDING', label: 'Очікує' },
  { value: 'ARCHIVED', label: 'Архів' },
];

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
}) {
  const { theme, setTheme } = useAdminTheme();
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
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [paymentTemplatesOpen, setPaymentTemplatesOpen] = useState(false);
  const [graceModalOpen, setGraceModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Cohort filter: null = усі. Інакше показуємо тільки підписки активного cohort-у.
      if (activeCohortId !== null && r.cohortId !== activeCohortId) return false;
      if (planFilter === 'YEARLY' && r.plan !== 'YEARLY') return false;
      if (planFilter === 'MONTHLY_AUTO' && !(r.plan === 'MONTHLY' && r.autoRenew)) return false;
      if (planFilter === 'MONTHLY_ONCE' && !(r.plan === 'MONTHLY' && !r.autoRenew)) return false;
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
      <AdminPanel theme={theme} padding="p-0" className="mb-5 max-w-5xl">
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
              telegramSettings={telegramSettings}
            />
          </>
        )}
        <div className={dark ? 'border-t border-white/[0.06]' : 'border-t border-stone-300/40'} />
        <div className="px-5 py-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
          <KpiInline theme={theme} icon={HiOutlineUserGroup} label="Підписок" value={summary.total.toLocaleString()} />
          <KpiDot dark={dark} />
          <KpiInline theme={theme} icon={HiOutlineCheckCircle} label="Активних" value={summary.active.toLocaleString()} tone="success" />
          <KpiDot dark={dark} />
          <KpiInline
            theme={theme}
            icon={HiOutlineClock}
            label={`Grace (${graceDays}${graceDays === 1 ? ' день' : graceDays >= 2 && graceDays <= 4 ? ' дні' : ' днів'})`}
            value={summary.grace.toLocaleString()}
            tone="warning"
          />
          <KpiDot dark={dark} />
          <KpiInline
            theme={theme}
            icon={HiOutlineXCircle}
            label="Доступ закрито / скасовано"
            value={(summary.expired + summary.cancelled).toLocaleString()}
          />
          <div className="ml-auto" />
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

      {/* Програмні налаштування: Вартість+GRACE — окремий рядок. */}
      <AdminPanel theme={theme} padding="p-3" className="mb-3 w-fit">
        <div className="flex items-center gap-1">
          <ProgramSettingButton
            theme={theme}
            icon={<HiOutlineCurrencyDollar className="text-base" />}
            label="Вартість"
            title="Налаштувати ціни, текст кнопок реєстрації та інформацію про програму"
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

      {/* Листи Нагадування/Платежів та пошук. */}
      <AdminPanel theme={theme} padding="p-3" className="mb-5 w-fit">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <ProgramSettingButton
              theme={theme}
              icon={<HiOutlineEnvelope className="text-base" />}
              label="Листи Нагадування"
              title="Налаштувати email-нагадування користувачам"
              onClick={() => setEmailModalOpen(true)}
            />
            <ProgramSettingButton
              theme={theme}
              icon={<HiOutlineEnvelope className="text-base" />}
              label="Листи платежів"
              title="Редагувати транзакційні листи (welcome, receipt, plan-changed, admin-actions)"
              onClick={() => setPaymentTemplatesOpen(true)}
            />
          </div>
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
      {emailModalOpen && <EmailRemindersModal theme={theme} onClose={() => setEmailModalOpen(false)} />}
      {paymentTemplatesOpen && <PaymentTemplatesModal theme={theme} onClose={() => setPaymentTemplatesOpen(false)} />}
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
                  <ColumnFilter
                    theme={theme}
                    label="Статус"
                    align="center"
                    options={STATUS_OPTIONS}
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as 'ALL' | SubStatus)}
                  />
                </Th>
                <Th theme={theme}>Дата оплати</Th>
                <Th theme={theme}>Початок програми</Th>
                <Th theme={theme}>Доступ до</Th>
                <Th theme={theme} align="center">Платежів</Th>
                <Th theme={theme}>Сплачено</Th>
                <Th theme={theme}>SendPulse</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    {rows.length === 0 ? 'Поки ніхто не підписався.' : 'Нічого не знайдено за фільтрами.'}
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <RowBlock
                    key={r.id}
                    r={r}
                    theme={theme}
                    expanded={expandedId === r.id}
                    details={details[r.id]}
                    busy={busyId === r.id}
                    onToggle={() => toggleExpand(r.id)}
                    onAction={(action, payload, confirm) => runAction(r.id, action, payload, confirm)}
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
  expanded,
  details,
  busy,
  onToggle,
  onAction,
}: {
  r: Row;
  theme: Theme;
  expanded: boolean;
  details: SubscriptionDetails | 'loading' | 'error' | undefined;
  busy: boolean;
  onToggle: () => void;
  onAction: (action: string, payload?: Record<string, unknown>, confirm?: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <tr className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
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
        </td>
        <td className="px-4 py-2.5">
          {r.country ? (
            <span className={`inline-flex items-center gap-1.5 text-[11px] ${dark ? 'text-slate-300' : 'text-stone-700'}`} title={r.country}>
              <span className="text-base leading-none" aria-hidden>{flagEmoji(r.country)}</span>
              <span>{getCountryName(r.country, 'uk', r.country)}</span>
            </span>
          ) : (
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-center"><PlanBadge theme={theme} plan={r.plan} autoRenew={r.autoRenew} /></td>
        <td className="px-4 py-2.5 text-center"><StatusBadge theme={theme} status={r.status} /></td>
        <td className={`px-4 py-2.5 text-[11px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {r.firstPaymentAt ? fmtDate(r.firstPaymentAt) : <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>}
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
        <td className={`px-4 py-2.5 text-[12px] tabular-nums text-center ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{r.paymentsCount}</td>
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
  busy,
  onAction,
}: {
  details: SubscriptionDetails | 'loading' | 'error' | undefined;
  row: Row;
  theme: Theme;
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
    return <div className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Завантаження деталей…</div>;
  }
  if (details === 'error') {
    return <div className={`text-[12px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>Не вдалося завантажити деталі.</div>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-5">
      {helpOpen && <HelpModal theme={theme} onClose={() => setHelpOpen(false)} />}
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
            <ActionBtn theme={theme} disabled={busy || row.status === 'EXPIRED' || row.status === 'ARCHIVED' || !!row.sendpulseAccessClosedAt} tone="danger" onClick={() =>
              onAction('close_access', undefined, 'Закрити доступ до SendPulse курсу?')
            }>
              ✕ Закрити доступ у SendPulse
            </ActionBtn>
          )}
          {!!row.sendpulseAccessOpenedAt && (
            <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="success" onClick={() =>
              onAction('reopen_access', undefined, 'Відкрити доступ до SendPulse знову (через event)?')
            }>
              ✓ Відкрити доступ до SendPulse знову
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
                ? 'Перенадіслати TG-запрошення'
                : 'Надіслати TG-запрошення'}
          </button>
          <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="danger" onClick={() =>
            onAction('delete', undefined, `Архівувати запис ${row.userEmail ?? ''}? Закриємо доступ у SendPulse, статус → ARCHIVED, очистимо технічні поля. ВІДКРИТИ ЗНОВУ вже не вийде.`)
          }>
            🗑 Архівувати запис
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
          if (details.telegramJoinedAt) {
            items.push(['TG приєднався', `✅ ${new Date(details.telegramJoinedAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
          } else if (details.telegramInvitedAt) {
            items.push(['TG приєднався', '⏳ запрошення надіслане']);
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

function fmtDate(iso: string): string {
  return KYIV_DATETIME_FMT.format(new Date(iso)).replace(',', '');
}

function fmtDateShort(iso: string): string {
  return KYIV_DATE_FMT.format(new Date(iso));
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
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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
  const menuAlign = align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
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
      {open && (
        <div
          className={`absolute z-40 mt-1.5 min-w-[180px] rounded-lg border shadow-2xl overflow-hidden ${menuAlign} ${
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
        </div>
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
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  theme: Theme;
  big?: boolean;
}) {
  const dark = theme === 'dark';
  const toneColor = {
    neutral: dark ? 'text-slate-100' : 'text-stone-900',
    success: dark ? 'text-emerald-300' : 'text-emerald-700',
    warning: dark ? 'text-amber-300' : 'text-amber-700',
    danger: dark ? 'text-rose-300' : 'text-rose-700',
  }[tone];
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <Icon className={`shrink-0 self-center text-[13px] ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
      <span className={`text-[11px] uppercase tracking-[0.14em] font-medium ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
        {label}
      </span>
      <span className={`tabular-nums font-semibold ${big ? 'text-[16px]' : 'text-[14px]'} ${toneColor}`}>{value}</span>
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

function StatusBadge({ status, theme }: { status: SubStatus; theme: Theme }) {
  const dark = theme === 'dark';
  const map: Record<SubStatus, { label: string; dark: string; light: string }> = {
    ACTIVE:    { label: 'Активний',    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20', light: 'bg-emerald-100 text-emerald-800 border-emerald-300/50' },
    GRACE:     { label: 'Grace (7 днів)', dark: 'bg-amber-500/15 text-amber-300 border-amber-400/20',       light: 'bg-amber-100 text-amber-800 border-amber-300/50' },
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

function HelpModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const statuses: { badge: string; name: string; desc: string; cls: string }[] = [
    { badge: 'PENDING',   name: 'Очікує',     desc: 'Підписка створена, але оплата ще не надійшла. Доступу немає.', cls: dark ? 'bg-slate-500/15 text-slate-400' : 'bg-stone-100 text-stone-600' },
    { badge: 'ACTIVE',    name: 'Активний',   desc: 'Все добре — оплата пройшла, доступ відкрито, користувач навчається.', cls: dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800' },
    { badge: 'GRACE',     name: 'Grace',      desc: 'Термін доступу закінчився, але є 7 днів пільгового періоду — встигнемо продовжити без втрати доступу.', cls: dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800' },
    { badge: 'EXPIRED',   name: 'Доступ закрито', desc: 'Доступ до курсу в SendPulse закрито — автоматично після grace-періоду або вручну менеджером.', cls: dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-800' },
    { badge: 'CANCELLED', name: 'Скасовано',  desc: 'Користувач/адмін скасував підписку. Для MONTHLY автосписання зупинено. Доступ зберігається до кінця оплаченого періоду.', cls: dark ? 'bg-slate-500/15 text-slate-300' : 'bg-stone-200 text-stone-700' },
    { badge: 'ARCHIVED',  name: 'Архів',      desc: 'Адмін заархівував. Доступ у SendPulse закрито, технічні поля очищено. Картка лишається як історичний запис, але відновити не можна.', cls: dark ? 'bg-zinc-700/30 text-zinc-400' : 'bg-zinc-200 text-zinc-600' },
  ];

  const actions: { icon: string; name: string; desc: string }[] = [
    { icon: '🎯', name: 'Екстра Запуск нового студента', desc: 'З\'являється коли студент оплатив підписку ПІСЛЯ того, як cohort вже запущено. Звичайний "Запустити програму" відпрацював раніше і цього новачка пропустив. Кнопка точково відкриває йому доступ у SendPulse через event і шле welcome-лист (як і всім решта при загальному launch).' },
    { icon: '⏱', name: 'Продовжити', desc: 'Додає вказану кількість днів до поточного терміну доступу. Корисно для бонусів, подарунків чи компенсацій.' },
    { icon: '🚫', name: 'Скасувати автосписання', desc: 'Зупиняє автоматичні списання з картки на боці WayForPay і ставить статус CANCELLED. Доступ зберігається до кінця оплаченого місяця. Кнопка з\'являється тільки для місячних підписок з активним автоплатежем — для річних і одноразових місячних її нема.' },
    { icon: '✕', name: 'Закрити доступ у SendPulse', desc: 'Миттєво забирає доступ до курсу в SendPulse. Підписка стає EXPIRED. Можна потім "Відкрити знову".' },
    { icon: '✓', name: 'Відкрити доступ до SendPulse знову', desc: 'Відновлює доступ у SendPulse + продовжує термін згідно плану (YEARLY +365д, MONTHLY +30д). Не працює для ARCHIVED.' },
    { icon: '🗑', name: 'Архівувати запис', desc: 'Назавжди закриває доступ у SendPulse, очищає технічні поля (studentId), ставить статус ARCHIVED. Картка лишається в адмінці як архів. Відновити не можна. Для підтвердження треба ввести email.' },
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
  const MIN = 1;
  const MAX = 90;

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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-md w-full rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold">Grace — тривалість пільгового періоду</h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className={`text-[12px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            Скільки днів після <strong>дати закінчення</strong> оплаченого періоду
            залишати доступ відкритим, поки користувач не оформить нову оплату.
            Значення застосовується <strong>до всіх нових переходів</strong> ACTIVE → GRACE у Річній програмі.
            Уже активні GRACE-записи не перераховуються (у них дата закриття зафіксована у момент переходу).
          </p>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              Кількість днів
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={MIN}
                max={MAX}
                value={days}
                onChange={(e) => { setDays(e.target.value); setError(null); }}
                className={`w-28 px-3 py-2 rounded-lg border text-[14px] tabular-nums outline-none transition-colors ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.1] text-slate-100 focus:border-amber-400/50'
                    : 'bg-white border-stone-300 text-stone-900 focus:border-amber-600/60'
                }`}
              />
              <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                днів (від {MIN} до {MAX})
              </span>
            </div>
            {!valid && days !== '' && (
              <p className={`mt-1.5 text-[11px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>
                Введіть ціле число від {MIN} до {MAX}
              </p>
            )}
            {error && (
              <p className={`mt-1.5 text-[11px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>{error}</p>
            )}
          </div>
        </div>

        <div className={`flex justify-end gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
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
    </div>,
    document.body,
  );
}

interface EmailScenario {
  type: string;
  title: string;
  when: string;
}

const MANUAL_SCENARIOS: EmailScenario[] = [
  { type: 'manual-before',      title: '📅 За 3 дні до дати закінчення', when: 'Нагадуємо оформити оплату на наступний місяць.' },
  { type: 'manual-on-expiry',   title: '📆 У дату закінчення',            when: 'Сьогодні останній день — час оплатити.' },
  { type: 'manual-grace-start', title: '🛟 Наступний день після дати закінчення', when: 'Доступ продовжено на 7 днів grace — встигнути оплатити.' },
  { type: 'closed',             title: '🔒 Через 7 днів — закриття доступу', when: 'Оплата не надійшла, закрили доступ у SendPulse.' },
];

const CYCLICAL_SCENARIOS: EmailScenario[] = [
  { type: 'cyclical-failed-1', title: '⚠ 1-й день після дати закінчення', when: 'WFP не зміг списати — перевірте картку.' },
  { type: 'cyclical-failed-3', title: '⏳ 3-й день після дати закінчення', when: 'Все ще не списано — лишилось 4 дні до закриття.' },
  { type: 'closed',            title: '🔒 7-й день — закриття доступу',     when: 'Оплата так і не пройшла, закрили доступ.' },
];

/// Iframe прев'ю листа з auto-height: висота підлаштовується під контент,
/// щоб не було внутрішнього скролбара і весь контент модалки скролився одним рухом миші.
function EmailPreviewFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(500);
  const measure = () => {
    try {
      const doc = ref.current?.contentDocument;
      if (doc?.body) {
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (h > 0) setHeight(h + 8);
      }
    } catch {}
  };
  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      onLoad={measure}
      scrolling="no"
      className="w-full bg-white block"
      style={{ height, border: 'none' }}
    />
  );
}

function EmailRemindersModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  /// Один глобальний обраний тип на обидві колонки — клік на будь-яку кнопку
  /// перемикає прев'ю внизу на всю ширину.
  const [activeType, setActiveType] = useState<string | null>(null);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const allScenarios = [...MANUAL_SCENARIOS, ...CYCLICAL_SCENARIOS];
  const activeScenario = allScenarios.find((s) => s.type === activeType) ?? null;
  const previewUrl = activeScenario ? `/api/admin/yearly-program/email-preview?type=${activeScenario.type}` : null;

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'}`}>
          <h3 className="text-base font-bold">Нагадування по Email — як працюють</h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <section>
            <p className={`text-[12px] leading-relaxed ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
              Cron щодня о <b>04:00 UTC</b>. Ім'я у листі — з форми оплати клієнта (<code>user.name</code>). Натисни кнопку щоб розгорнути прев'ю.
            </p>
          </section>

          {/* Дві колонки: Ручна (4 листи) і Автосписання (3 листи) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <EmailScenarioColumn
              theme={theme}
              heading="💳 Ручна оплата"
              subheading="Клієнт платить сам (4 листи)"
              headingCls={dark ? 'text-sky-300' : 'text-sky-800'}
              scenarios={MANUAL_SCENARIOS}
              activeType={activeType}
              onToggle={(t) => setActiveType(activeType === t ? null : t)}
            />
            <EmailScenarioColumn
              theme={theme}
              heading="🔄 Автосписання"
              subheading="Тільки при помилці списання (3 листи)"
              headingCls={dark ? 'text-amber-300' : 'text-amber-800'}
              scenarios={CYCLICAL_SCENARIOS}
              activeType={activeType}
              onToggle={(t) => setActiveType(activeType === t ? null : t)}
            />
          </div>

          {/* Прев'ю на всю ширину під колонками */}
          {activeScenario && previewUrl && (
            <div className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/40'}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${dark ? 'border-white/10' : 'border-stone-200'}`}>
                <div>
                  <div className="text-[13px] font-bold">{activeScenario.title}</div>
                  <div className={`text-[11px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{activeScenario.when}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveType(null)}
                  aria-label="Згорнути прев'ю"
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'}`}
                >
                  ✕
                </button>
              </div>
              <EmailPreviewFrame key={activeScenario.type} src={previewUrl} title={`Email preview: ${activeScenario.title}`} />
              <div className={`px-4 py-2 flex items-center gap-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
                <a
                  href={previewUrl}
                  download={`email-${activeScenario.type}.html`}
                  className={`text-[11px] font-medium underline-offset-2 hover:underline ${dark ? 'text-amber-300' : 'text-amber-800'}`}
                >
                  ⬇ Завантажити HTML
                </a>
                <span className="text-[11px] opacity-50">·</span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[11px] font-medium underline-offset-2 hover:underline ${dark ? 'text-amber-300' : 'text-amber-800'}`}
                >
                  ↗ Відкрити в новій вкладці
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EmailScenarioColumn({
  theme,
  heading,
  subheading,
  headingCls,
  scenarios,
  activeType,
  onToggle,
}: {
  theme: Theme;
  heading: string;
  subheading: string;
  headingCls: string;
  scenarios: EmailScenario[];
  activeType: string | null;
  onToggle: (type: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <div className={`rounded-xl border p-4 ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/40'}`}>
      <h4 className={`text-[14px] font-bold ${headingCls}`}>{heading}</h4>
      <p className={`text-[11px] mb-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{subheading}</p>
      <div className="flex flex-col gap-2">
        {scenarios.map((s) => {
          const isActive = s.type === activeType;
          return (
            <button
              key={s.type}
              type="button"
              onClick={() => onToggle(s.type)}
              className={`px-3 py-2 rounded-lg text-[12px] font-medium border text-left transition-colors ${
                isActive
                  ? dark ? 'bg-amber-400/15 text-amber-200 border-amber-400/40' : 'bg-amber-100 text-amber-800 border-amber-300/60'
                  : dark ? 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]' : 'bg-white/80 text-stone-700 border-stone-300/60 hover:bg-stone-100'
              }`}
            >
              {s.title}
            </button>
          );
        })}
      </div>
    </div>
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
