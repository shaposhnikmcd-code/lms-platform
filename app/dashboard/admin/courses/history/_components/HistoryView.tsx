'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HiOutlineClock, HiOutlineArrowLeft } from 'react-icons/hi2';
import { useAdminTheme } from '../../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../../_components/AdminShell';

export interface HistoryEntry {
  id: string;
  slug: string;
  courseTitle: string;
  courseIcon: string | null;
  courseAccent: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: string; // "update" | "reset"
  changes: Record<string, { old: unknown; new: unknown }>;
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  price: 'Ціна',
  oldPrice: 'Стара ціна',
  promo1Code: 'Промокод 1',
  promo1Price: 'Ціна по Промокоду 1',
  promo1StartsAt: 'Промокод 1 — старт',
  promo1ExpiresAt: 'Промокод 1 — кінець',
  promo2Code: 'Промокод 2',
  promo2Price: 'Ціна по Промокоду 2',
  promo2StartsAt: 'Промокод 2 — старт',
  promo2ExpiresAt: 'Промокод 2 — кінець',
  sendpulseCourseId: 'SP course ID',
};

/// Категоризує конкретну зміну в людський статус. Семантика "додано / прибрано
/// / змінено" виводиться з null-переходів. Для таймерів промо обʼєднуємо в
/// один статус, щоб не плодити три пілки на одну зміну.
type ActionTone = 'added' | 'removed' | 'changed';
function classifyChange(field: string, old: unknown, nw: unknown): { label: string; tone: ActionTone } | null {
  const wasNull = old === null || old === undefined || old === '';
  const isNull = nw === null || nw === undefined || nw === '';
  if (wasNull && isNull) return null;

  // Promo code field визначає семантику для пари (code + price + timer).
  // Окремий promo*Price/StartsAt/ExpiresAt не показуємо як власні дії, бо
  // вони ловляться обробкою promo*Code; повертаємо null для них.
  if (field === 'promo1Price' || field === 'promo2Price') return null;
  if (field === 'promo1StartsAt' || field === 'promo1ExpiresAt') return null;
  if (field === 'promo2StartsAt' || field === 'promo2ExpiresAt') return null;

  const baseMap: Record<string, string> = {
    price: 'ціну курсу',
    oldPrice: 'стару ціну',
    promo1Code: 'Промокод 1',
    promo2Code: 'Промокод 2',
    sendpulseCourseId: 'SP course ID',
  };
  const base = baseMap[field] ?? FIELD_LABELS[field] ?? field;

  if (wasNull && !isNull) return { label: `Додано ${base}`, tone: 'added' };
  if (!wasNull && isNull) return { label: `Видалено ${base}`, tone: 'removed' };
  return { label: `Змінено ${base}`, tone: 'changed' };
}

/// Зміна таймеру промо (без зміни самого коду) — окрема пілка. Викликаємо
/// окремо щоб не дублювалося з classifyChange коли code теж змінився
/// (тоді промо-зміна вже покриває таймер).
function timerChangeFor(
  promoIdx: 1 | 2,
  changes: Record<string, { old: unknown; new: unknown }>,
): { label: string; tone: ActionTone } | null {
  const codeField = `promo${promoIdx}Code`;
  if (changes[codeField]) return null; // покрито classifyChange(promoXCode)
  const startsField = `promo${promoIdx}StartsAt`;
  const expiresField = `promo${promoIdx}ExpiresAt`;
  const startChanged = changes[startsField];
  const expChanged = changes[expiresField];
  if (!startChanged && !expChanged) return null;

  const startBefore = startChanged ? startChanged.old : null;
  const startAfter = startChanged ? startChanged.new : null;
  const expBefore = expChanged ? expChanged.old : null;
  const expAfter = expChanged ? expChanged.new : null;
  const wasOff =
    (startBefore === null || startBefore === undefined) &&
    (expBefore === null || expBefore === undefined);
  const isOff =
    (startAfter === null || startAfter === undefined) &&
    (expAfter === null || expAfter === undefined);

  if (wasOff && !isOff) return { label: `Додано таймер Промокоду ${promoIdx}`, tone: 'added' };
  if (!wasOff && isOff) return { label: `Прибрано таймер Промокоду ${promoIdx}`, tone: 'removed' };
  return { label: `Змінено таймер Промокоду ${promoIdx}`, tone: 'changed' };
}

function actionsFor(entry: HistoryEntry): { label: string; tone: ActionTone | 'reset' }[] {
  if (entry.action === 'reset') {
    return [{ label: 'Скинуто всі ціни і промокоди', tone: 'reset' }];
  }
  const out: { label: string; tone: ActionTone | 'reset' }[] = [];
  for (const [field, { old, new: nw }] of Object.entries(entry.changes)) {
    const a = classifyChange(field, old, nw);
    if (a) out.push(a);
  }
  const t1 = timerChangeFor(1, entry.changes);
  if (t1) out.push(t1);
  const t2 = timerChangeFor(2, entry.changes);
  if (t2) out.push(t2);
  if (out.length === 0) out.push({ label: 'Оновлено', tone: 'changed' });
  return out;
}

function formatValue(field: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (
    field === 'price' ||
    field === 'oldPrice' ||
    field === 'promo1Price' ||
    field === 'promo2Price'
  ) {
    const n = Number(val);
    return Number.isFinite(n) ? `${n.toLocaleString()} ₴` : String(val);
  }
  return String(val);
}

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, time };
}

export default function HistoryView({
  entries,
  pageSize,
}: {
  entries: HistoryEntry[];
  pageSize: number;
}) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [filterSlug, setFilterSlug] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');

  const courseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (!seen.has(e.slug)) seen.set(e.slug, e.courseTitle);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1], 'uk'));
  }, [entries]);

  const userOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      const key = e.userEmail ?? e.userId ?? '';
      if (key) seen.add(key);
    }
    return Array.from(seen).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterSlug && e.slug !== filterSlug) return false;
      if (filterUser) {
        const key = e.userEmail ?? e.userId ?? '';
        if (key !== filterUser) return false;
      }
      return true;
    });
  }, [entries, filterSlug, filterUser]);

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Курси · Історія змін"
      title="Історія змін цін і промокодів"
      subtitle="Лог усіх редагувань на сторінці «Курси — ціни»: хто, коли, що змінив."
      rightSlot={
        <div className="hidden sm:inline-flex items-center gap-2">
          <Link
            href="/dashboard/admin/courses"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08] hover:text-white'
                : 'bg-white/70 border-stone-300/60 text-stone-800 hover:bg-white hover:text-stone-900'
            }`}
          >
            <HiOutlineArrowLeft className="text-sm" />
            До курсів
          </Link>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300'
                : 'bg-white/70 border-stone-300/60 text-stone-700'
            }`}
          >
            <HiOutlineClock className="text-sm" />
            <span className="tabular-nums">{filtered.length} / {entries.length}</span>
          </div>
        </div>
      }
    >
      <AdminPanel theme={theme} padding="p-0" className="overflow-hidden">
        {/* Filters bar */}
        <div className={`flex flex-wrap items-center gap-3 px-4 py-3 border-b ${
          dark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-stone-50/60 border-stone-300/50'
        }`}>
          <div className="flex items-center gap-2">
            <label className={`text-[11px] uppercase tracking-[0.18em] font-medium ${
              dark ? 'text-slate-500' : 'text-stone-500'
            }`}>
              Курс
            </label>
            <select
              value={filterSlug}
              onChange={(e) => setFilterSlug(e.target.value)}
              className={`px-2.5 py-1.5 text-[12px] rounded-lg border ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-100'
                  : 'bg-white/80 border-stone-300/60 text-stone-900'
              }`}
            >
              <option value="">Усі</option>
              {courseOptions.map(([slug, title]) => (
                <option key={slug} value={slug}>{title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-[11px] uppercase tracking-[0.18em] font-medium ${
              dark ? 'text-slate-500' : 'text-stone-500'
            }`}>
              Користувач
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className={`px-2.5 py-1.5 text-[12px] rounded-lg border ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-100'
                  : 'bg-white/80 border-stone-300/60 text-stone-900'
              }`}
            >
              <option value="">Усі</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          {(filterSlug || filterUser) && (
            <button
              type="button"
              onClick={() => { setFilterSlug(''); setFilterUser(''); }}
              className={`text-[11px] underline ${
                dark ? 'text-slate-400 hover:text-slate-200' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Скинути фільтри
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className={`p-10 text-center text-sm ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            Записів немає.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${
                dark
                  ? 'bg-white/[0.02] border-white/[0.06]'
                  : 'bg-stone-50/60 border-stone-300/50'
              }`}>
                <tr>
                  <Th theme={theme} width={140}>Дата</Th>
                  <Th theme={theme} width={240}>Курс</Th>
                  <Th theme={theme} width={220}>Користувач</Th>
                  <Th theme={theme} width={200}>Дія</Th>
                  <Th theme={theme}>Зміни</Th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
                {filtered.map((e) => {
                  const { date, time } = formatDate(e.createdAt);
                  const userLabel = e.userName ?? e.userEmail ?? e.userId ?? '—';
                  const userSub = e.userName && e.userEmail ? e.userEmail : null;
                  return (
                    <tr key={e.id} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/80'}>
                      <td className="px-4 py-3 align-top">
                        <div className={`text-[12px] tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{date}</div>
                        <div className={`text-[10px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{time}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          {e.courseIcon && (
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-base flex-shrink-0 border ${
                                dark ? 'border-white/[0.08]' : 'border-stone-300/60'
                              }`}
                              style={{ backgroundColor: dark ? `${e.courseAccent}22` : `${e.courseAccent}1f` }}
                            >
                              {e.courseIcon}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className={`text-[12px] font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{e.courseTitle}</div>
                            <div className={`text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{e.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className={`text-[12px] ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{userLabel}</div>
                        {userSub && (
                          <div className={`text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{userSub}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {actionsFor(e).map((a, i) => {
                            const toneCls =
                              a.tone === 'added'
                                ? dark
                                  ? 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30'
                                  : 'text-emerald-900 bg-emerald-100/70 border-emerald-500/40'
                                : a.tone === 'removed' || a.tone === 'reset'
                                  ? dark
                                    ? 'text-rose-200 bg-rose-500/10 border-rose-500/30'
                                    : 'text-rose-900 bg-rose-100/70 border-rose-400/50'
                                  : dark
                                    ? 'text-amber-200 bg-amber-500/10 border-amber-500/25'
                                    : 'text-amber-900 bg-amber-200/50 border-amber-500/40';
                            return (
                              <span
                                key={i}
                                className={`inline-flex items-center text-[10px] font-medium rounded-full px-2 py-0.5 border whitespace-nowrap ${toneCls}`}
                              >
                                {a.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-1">
                          {Object.entries(e.changes).map(([field, { old, new: nw }]) => (
                            <div key={field} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                              <span className={`font-medium ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                                {FIELD_LABELS[field] ?? field}:
                              </span>
                              <span className={`tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                                {formatValue(field, old)}
                              </span>
                              <span className={dark ? 'text-slate-600' : 'text-stone-400'}>→</span>
                              <span className={`tabular-nums font-medium ${dark ? 'text-amber-200' : 'text-amber-900'}`}>
                                {formatValue(field, nw)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {entries.length >= pageSize && (
        <div className={`mt-4 text-[11px] text-center ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          Показано останні {pageSize} записів. Старіші записи зберігаються в БД.
        </div>
      )}
    </AdminShell>
  );
}

function Th({
  theme,
  children,
  width,
  align = 'left',
}: {
  theme: 'dark' | 'light';
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  return (
    <th
      className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-4 py-3 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
      style={width ? { minWidth: width } : undefined}
    >
      {children}
    </th>
  );
}
