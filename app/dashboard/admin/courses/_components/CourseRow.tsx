'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaRotateLeft, FaCheck } from 'react-icons/fa6';
import type { Theme } from '../../_components/adminTheme';

export interface CourseRowData {
  slug: string;
  titleUk: string;
  icon: string;
  accent: string;
  defaultPrice: number;
  defaultOldPrice: number | null;
  overridePrice: number | null;
  overrideOldPrice: number | null;
  sendpulseCourseId: number | null;
}

function parsePriceInput(value: string): { ok: boolean; num: number | null } {
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, num: null };
  const num = Number(trimmed.replace(/\s/g, ''));
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    return { ok: false, num: null };
  }
  return { ok: true, num };
}

export default function CourseRow({
  row,
  theme,
  mobile = false,
}: {
  row: CourseRowData;
  theme: Theme;
  mobile?: boolean;
}) {
  const router = useRouter();
  const dark = theme === 'dark';

  const initialPrice = row.overridePrice ?? row.defaultPrice;
  const initialOldPrice = row.overrideOldPrice ?? row.defaultOldPrice;

  const [priceStr, setPriceStr] = useState(String(initialPrice));
  const [oldPriceStr, setOldPriceStr] = useState(
    initialOldPrice !== null ? String(initialOldPrice) : '',
  );
  const [spIdStr, setSpIdStr] = useState(
    row.sendpulseCourseId !== null ? String(row.sendpulseCourseId) : '',
  );
  const [savingSp, setSavingSp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const priceParsed = parsePriceInput(priceStr);
  const oldPriceParsed = parsePriceInput(oldPriceStr);
  const formValid = priceParsed.ok && oldPriceParsed.ok && priceParsed.num !== null;
  const currentPrice = priceParsed.num;
  const currentOldPrice = oldPriceParsed.num;

  const dirty =
    formValid && (currentPrice !== initialPrice || currentOldPrice !== initialOldPrice);

  const hasAnyOverride = row.overridePrice !== null || row.overrideOldPrice !== null;

  async function handleSave() {
    if (!formValid || currentPrice === null) return;
    setSaving(true);
    try {
      const priceMatchesDefault = currentPrice === row.defaultPrice;
      const oldPriceMatchesDefault = currentOldPrice === row.defaultOldPrice;
      const payload = {
        price: priceMatchesDefault ? null : currentPrice,
        oldPrice: oldPriceMatchesDefault ? null : currentOldPrice,
      };
      const res = await fetch(`/api/admin/courses/${row.slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося зберегти');
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Помилка: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  const spIdParsed = (() => {
    const t = spIdStr.trim();
    if (t === '') return { ok: true, num: null as number | null };
    const n = Number(t);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok: false, num: null };
    return { ok: true, num: n };
  })();
  const spDirty =
    spIdParsed.ok && (spIdParsed.num ?? null) !== (row.sendpulseCourseId ?? null);

  async function handleSaveSpId() {
    if (!spIdParsed.ok) return;
    setSavingSp(true);
    try {
      const res = await fetch(`/api/admin/courses/${row.slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendpulseCourseId: spIdParsed.num }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося зберегти SP ID');
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Помилка: ${err}`);
    } finally {
      setSavingSp(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/courses/${row.slug}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося скинути');
        return;
      }
      setPriceStr(String(row.defaultPrice));
      setOldPriceStr(row.defaultOldPrice !== null ? String(row.defaultOldPrice) : '');
      router.refresh();
    } catch (err) {
      alert(`Помилка: ${err}`);
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  }

  const inputBase = 'w-full px-2.5 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 border tabular-nums transition-colors';
  const inputOk = dark
    ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/50 focus:border-amber-400/40 placeholder:text-slate-600'
    : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40 focus:border-amber-500/50 placeholder:text-stone-400';
  const inputBad = dark
    ? 'bg-rose-500/10 border-rose-400/40 text-rose-200 focus:ring-rose-400/40'
    : 'bg-rose-100/60 border-rose-400/60 text-rose-900 focus:ring-rose-500/40';

  const priceCls = `${inputBase} ${priceParsed.ok && priceParsed.num !== null ? inputOk : inputBad}`;
  const oldPriceCls = `${inputBase} ${oldPriceParsed.ok ? inputOk : inputBad}`;

  const overrideBadge = (
    <span
      className={`text-[10px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap border ${
        dark
          ? 'text-amber-200 bg-amber-500/10 border-amber-500/25'
          : 'text-amber-900 bg-amber-200/50 border-amber-500/40'
      }`}
      title="Значення override-не"
    >
      override
    </span>
  );

  const titleCell = (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg flex-shrink-0 border ${
          dark ? 'border-white/[0.08]' : 'border-stone-300/60'
        }`}
        style={{ backgroundColor: dark ? `${row.accent}22` : `${row.accent}1f` }}
      >
        {row.icon}
      </span>
      <div className="min-w-0">
        <p className={`text-[13px] font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{row.titleUk}</p>
        <p className={`text-[10px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{row.slug}</p>
      </div>
    </div>
  );

  const priceCell = (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        className={priceCls}
        value={priceStr}
        onChange={e => setPriceStr(e.target.value)}
      />
      {row.overridePrice !== null && overrideBadge}
    </div>
  );

  const oldPriceCell = (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        placeholder="— не показувати"
        className={oldPriceCls}
        value={oldPriceStr}
        onChange={e => setOldPriceStr(e.target.value)}
      />
      {row.overrideOldPrice !== null && overrideBadge}
    </div>
  );

  const spIdCls = `${inputBase} ${spIdParsed.ok ? inputOk : inputBad}`;
  const spIdCell = (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        placeholder="—"
        className={spIdCls}
        value={spIdStr}
        onChange={e => setSpIdStr(e.target.value)}
        title="ID курсу в SendPulse Education. Без нього cron не видасть сертифікат автоматично."
      />
      <button
        type="button"
        onClick={handleSaveSpId}
        disabled={!spDirty || savingSp || !spIdParsed.ok}
        title="Зберегти SP ID"
        className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
          dark
            ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 disabled:bg-white/[0.06] disabled:text-slate-500'
            : 'bg-stone-900 text-amber-100 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400'
        }`}
      >
        <FaCheck className="text-[10px]" />
      </button>
    </div>
  );

  const defaultCell = (
    <div className={`text-[12px] tabular-nums leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
      <div>{row.defaultPrice.toLocaleString()} ₴</div>
      {row.defaultOldPrice !== null && (
        <div className={dark ? 'text-slate-500' : 'text-stone-400'}>
          <span className="line-through">{row.defaultOldPrice.toLocaleString()}</span> ₴
        </div>
      )}
    </div>
  );

  const saveBtnCls = `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
    dark
      ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)] disabled:shadow-none disabled:bg-white/[0.06] disabled:text-slate-500'
      : 'bg-stone-900 text-amber-100 hover:bg-stone-800 shadow-sm disabled:shadow-none disabled:bg-stone-200 disabled:text-stone-400'
  }`;
  const resetBtnCls = `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white'
      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
  }`;

  const actionsCell = (
    <div className="flex flex-col gap-1.5 items-stretch">
      <button type="button" onClick={handleSave} disabled={!dirty || saving} className={saveBtnCls}>
        <FaCheck className="text-[10px]" />
        {saving ? '...' : 'Зберегти'}
      </button>
      <button
        type="button"
        onClick={() => setShowResetModal(true)}
        disabled={!hasAnyOverride || resetting}
        className={resetBtnCls}
      >
        <FaRotateLeft className="text-[10px]" />
        Скинути
      </button>

      {showResetModal && (
        <ResetModal
          theme={theme}
          title={row.titleUk}
          onCancel={() => setShowResetModal(false)}
          onConfirm={handleReset}
          resetting={resetting}
        />
      )}
    </div>
  );

  if (mobile) {
    return (
      <div className="p-4 space-y-3">
        {titleCell}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Ціна, ₴
            </div>
            {priceCell}
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Стара ціна
            </div>
            {oldPriceCell}
          </div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            SendPulse course ID
          </div>
          {spIdCell}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Дефолт
            </div>
            {defaultCell}
          </div>
          <div className="flex-shrink-0">{actionsCell}</div>
        </div>
      </div>
    );
  }

  return (
    <tr className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/80'}>
      <td className="px-4 py-3 align-middle">{titleCell}</td>
      <td className="px-3 py-3 align-middle">{priceCell}</td>
      <td className="px-3 py-3 align-middle">{oldPriceCell}</td>
      <td className="px-3 py-3 align-middle">{spIdCell}</td>
      <td className="px-3 py-3 align-middle">{defaultCell}</td>
      <td className="px-3 py-3 align-middle">{actionsCell}</td>
    </tr>
  );
}

function ResetModal({
  theme,
  title,
  onCancel,
  onConfirm,
  resetting,
}: {
  theme: Theme;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  resetting: boolean;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm ${
        dark ? 'bg-black/60' : 'bg-stone-900/30'
      }`}
      onClick={onCancel}
    >
      <div
        className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
          dark
            ? 'bg-[#14161d] border-white/[0.08] text-slate-100'
            : 'bg-[#fbf7ec] border-stone-300/60 text-stone-900'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Скинути ціни?</h3>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          Ціна і стара ціна курсу{' '}
          <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>«{title}»</span>{' '}
          повернуться до дефолтних значень із коду.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
            }`}
          >
            Скасувати
          </button>
          <button
            onClick={onConfirm}
            disabled={resetting}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
              dark
                ? 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-[0_0_20px_-4px_rgba(244,63,94,0.5)]'
                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
            }`}
          >
            {resetting ? '...' : 'Скинути'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
