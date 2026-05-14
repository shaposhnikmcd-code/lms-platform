'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaRotateLeft, FaCheck } from 'react-icons/fa6';
import type { Theme } from '../../_components/adminTheme';
import PromoTimer, { getPromoWindowState } from './PromoTimer';

/// UI mapping для категорій (історично):
///   UI "Промокод 1" / "Ціна 1"  → БД promo2*  (новий публічний промокод, додано 2026-05-11)
///   UI "Промокод 2" / "Ціна 2"  → БД promo1*  (де історично лежить SECRETPASS / адмін-тариф)
///
/// Зроблено так, щоб не мігрувати існуючі дані: SECRETPASS залишається в колонці "Промокод 2"
/// (як user звик), а нове порожнє поле для публічного промо з'являється в "Промокод 1".
export interface CategoryRowData {
  category: 'bundle' | 'connector' | 'yearly' | 'monthly';
  titleUk: string;
  icon: string;
  accent: string;
  hint: string;
  /// Дефолтна базова ціна з коду (для bundle — null, цінами керують самі пакети).
  defaultPrice: number | null;
  /// Override базової ціни (з CategoryPromoOverride.price). null = використати defaultPrice.
  price: number | null;
  /// Стара (перекреслена) ціна. null = не показувати.
  oldPrice: number | null;
  // promo1* — БД слот, рендериться як UI "Промокод 2" (SECRETPASS)
  promo1Code: string | null;
  promo1Price: number | null;
  promo1StartsAt: string | null;
  promo1ExpiresAt: string | null;
  // promo2* — БД слот, рендериться як UI "Промокод 1" (публічний)
  promo2Code: string | null;
  promo2Price: number | null;
  promo2StartsAt: string | null;
  promo2ExpiresAt: string | null;
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

function parsePromoInput(value: string): { ok: boolean; code: string | null } {
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, code: null };
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(trimmed)) return { ok: false, code: null };
  return { ok: true, code: trimmed.toUpperCase() };
}

export default function CategoryRow({
  row,
  theme,
  mobile = false,
}: {
  row: CategoryRowData;
  theme: Theme;
  mobile?: boolean;
}) {
  const router = useRouter();
  const dark = theme === 'dark';
  const hasPriceField = row.defaultPrice !== null;

  // Ціна / Стара ціна (тільки для connector / yearly / monthly).
  const [priceStr, setPriceStr] = useState(row.price !== null ? String(row.price) : '');
  const [oldPriceStr, setOldPriceStr] = useState(row.oldPrice !== null ? String(row.oldPrice) : '');

  // БД-слот promo1 → UI "Промокод 2" (SECRETPASS)
  const [promo1CodeStr, setPromo1CodeStr] = useState(row.promo1Code ?? '');
  const [promo1PriceStr, setPromo1PriceStr] = useState(
    row.promo1Price !== null ? String(row.promo1Price) : '',
  );
  const [promo1StartsAt, setPromo1StartsAt] = useState<string | null>(row.promo1StartsAt);
  const [promo1ExpiresAt, setPromo1ExpiresAt] = useState<string | null>(row.promo1ExpiresAt);
  // БД-слот promo2 → UI "Промокод 1" (публічний)
  const [promo2CodeStr, setPromo2CodeStr] = useState(row.promo2Code ?? '');
  const [promo2PriceStr, setPromo2PriceStr] = useState(
    row.promo2Price !== null ? String(row.promo2Price) : '',
  );
  const [promo2StartsAt, setPromo2StartsAt] = useState<string | null>(row.promo2StartsAt);
  const [promo2ExpiresAt, setPromo2ExpiresAt] = useState<string | null>(row.promo2ExpiresAt);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const draftKey = `lms-admin-category-promo-draft-${row.category}`;
  const [draftHydrated, setDraftHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (d && typeof d === 'object') {
          if (typeof d.priceStr === 'string') setPriceStr(d.priceStr);
          if (typeof d.oldPriceStr === 'string') setOldPriceStr(d.oldPriceStr);
          if (typeof d.promo1CodeStr === 'string') setPromo1CodeStr(d.promo1CodeStr);
          if (typeof d.promo1PriceStr === 'string') setPromo1PriceStr(d.promo1PriceStr);
          if (d.promo1StartsAt === null || typeof d.promo1StartsAt === 'string')
            setPromo1StartsAt(d.promo1StartsAt as string | null);
          if (d.promo1ExpiresAt === null || typeof d.promo1ExpiresAt === 'string')
            setPromo1ExpiresAt(d.promo1ExpiresAt as string | null);
          if (typeof d.promo2CodeStr === 'string') setPromo2CodeStr(d.promo2CodeStr);
          if (typeof d.promo2PriceStr === 'string') setPromo2PriceStr(d.promo2PriceStr);
          if (d.promo2StartsAt === null || typeof d.promo2StartsAt === 'string')
            setPromo2StartsAt(d.promo2StartsAt as string | null);
          if (d.promo2ExpiresAt === null || typeof d.promo2ExpiresAt === 'string')
            setPromo2ExpiresAt(d.promo2ExpiresAt as string | null);
        }
      }
    } catch {
      // ignore
    }
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceParsed = parsePriceInput(priceStr);
  const oldPriceParsed = parsePriceInput(oldPriceStr);
  const promo1CodeParsed = parsePromoInput(promo1CodeStr);
  const promo1PriceParsed = parsePriceInput(promo1PriceStr);
  const promo1PairOk = (promo1CodeParsed.code !== null) === (promo1PriceParsed.num !== null);
  const promo2CodeParsed = parsePromoInput(promo2CodeStr);
  const promo2PriceParsed = parsePriceInput(promo2PriceStr);
  const promo2PairOk = (promo2CodeParsed.code !== null) === (promo2PriceParsed.num !== null);

  const effPromo1Starts = promo1CodeParsed.code === null ? null : promo1StartsAt;
  const effPromo1Expires = promo1CodeParsed.code === null ? null : promo1ExpiresAt;
  const effPromo2Starts = promo2CodeParsed.code === null ? null : promo2StartsAt;
  const effPromo2Expires = promo2CodeParsed.code === null ? null : promo2ExpiresAt;

  const codesDistinct =
    !promo1CodeParsed.code ||
    !promo2CodeParsed.code ||
    promo1CodeParsed.code !== promo2CodeParsed.code;

  const formValid =
    priceParsed.ok &&
    oldPriceParsed.ok &&
    promo1CodeParsed.ok &&
    promo1PriceParsed.ok &&
    promo1PairOk &&
    promo2CodeParsed.ok &&
    promo2PriceParsed.ok &&
    promo2PairOk &&
    codesDistinct;

  const dirty =
    formValid &&
    (
      (priceParsed.num ?? null) !== (row.price ?? null) ||
      (oldPriceParsed.num ?? null) !== (row.oldPrice ?? null) ||
      (promo1CodeParsed.code ?? null) !== (row.promo1Code ?? null) ||
      (promo1PriceParsed.num ?? null) !== (row.promo1Price ?? null) ||
      effPromo1Starts !== row.promo1StartsAt ||
      effPromo1Expires !== row.promo1ExpiresAt ||
      (promo2CodeParsed.code ?? null) !== (row.promo2Code ?? null) ||
      (promo2PriceParsed.num ?? null) !== (row.promo2Price ?? null) ||
      effPromo2Starts !== row.promo2StartsAt ||
      effPromo2Expires !== row.promo2ExpiresAt
    );

  const hasOverride =
    row.price !== null ||
    row.oldPrice !== null ||
    row.promo1Code !== null ||
    row.promo2Code !== null;

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      if (!dirty) {
        window.localStorage.removeItem(draftKey);
        return;
      }
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          priceStr,
          oldPriceStr,
          promo1CodeStr,
          promo1PriceStr,
          promo1StartsAt,
          promo1ExpiresAt,
          promo2CodeStr,
          promo2PriceStr,
          promo2StartsAt,
          promo2ExpiresAt,
        }),
      );
    } catch {
      // ignore
    }
  }, [
    draftHydrated,
    draftKey,
    dirty,
    priceStr,
    oldPriceStr,
    promo1CodeStr,
    promo1PriceStr,
    promo1StartsAt,
    promo1ExpiresAt,
    promo2CodeStr,
    promo2PriceStr,
    promo2StartsAt,
    promo2ExpiresAt,
  ]);

  async function handleSave() {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload = {
        price: priceParsed.num,
        oldPrice: oldPriceParsed.num,
        promo1Code: promo1CodeParsed.code,
        promo1Price: promo1PriceParsed.num,
        promo1StartsAt: effPromo1Starts,
        promo1ExpiresAt: effPromo1Expires,
        promo2Code: promo2CodeParsed.code,
        promo2Price: promo2PriceParsed.num,
        promo2StartsAt: effPromo2Starts,
        promo2ExpiresAt: effPromo2Expires,
      };
      const res = await fetch(`/api/admin/category-promo/${row.category}`, {
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

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/category-promo/${row.category}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося скинути');
        return;
      }
      setPriceStr('');
      setOldPriceStr('');
      setPromo1CodeStr('');
      setPromo1PriceStr('');
      setPromo1StartsAt(null);
      setPromo1ExpiresAt(null);
      setPromo2CodeStr('');
      setPromo2PriceStr('');
      setPromo2StartsAt(null);
      setPromo2ExpiresAt(null);
      router.refresh();
    } catch (err) {
      alert(`Помилка: ${err}`);
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  }

  const inputBase = 'w-full px-2 py-1.5 text-[13px] rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 border tabular-nums transition-colors';
  const inputOk = dark
    ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/50 focus:border-amber-400/40 placeholder:text-slate-600'
    : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40 focus:border-amber-500/50 placeholder:text-stone-400';
  const inputBad = dark
    ? 'bg-rose-500/10 border-rose-400/40 text-rose-200 focus:ring-rose-400/40'
    : 'bg-rose-100/60 border-rose-400/60 text-rose-900 focus:ring-rose-500/40';

  const priceCls = `${inputBase} text-center ${priceParsed.ok ? inputOk : inputBad}`;
  const oldPriceCls = `${inputBase} text-center ${oldPriceParsed.ok ? inputOk : inputBad}`;

  // Промо не діє коли є код, але вікно — pending або expired → нейтральний стиль + strike на ціні.
  const promo1State = getPromoWindowState(promo1StartsAt, promo1ExpiresAt);
  const promo2State = getPromoWindowState(promo2StartsAt, promo2ExpiresAt);
  const promo1Inactive = promo1CodeParsed.code !== null && (promo1State === 'expired' || promo1State === 'pending');
  const promo2Inactive = promo2CodeParsed.code !== null && (promo2State === 'expired' || promo2State === 'pending');

  const promoInactiveCode = dark
    ? 'bg-white/[0.02] border-white/[0.06] text-slate-500 placeholder:text-slate-700 focus:ring-amber-400/30 focus:border-amber-400/30 focus:text-slate-200'
    : 'bg-stone-100/40 border-stone-200/60 text-stone-400 placeholder:text-stone-300 focus:ring-amber-500/30 focus:border-amber-500/40 focus:text-stone-700';
  const promoInactivePrice = `${promoInactiveCode} line-through`;

  const okOrInactive = (inactive: boolean) => (inactive ? promoInactiveCode : inputOk);
  const okOrInactivePrice = (inactive: boolean) => (inactive ? promoInactivePrice : inputOk);

  const promo1CodeCls = `${inputBase} text-center ${promo1CodeParsed.ok && promo1PairOk && codesDistinct ? okOrInactive(promo1Inactive) : inputBad}`;
  const promo1PriceCls = `${inputBase} text-center ${promo1PriceParsed.ok && promo1PairOk ? okOrInactivePrice(promo1Inactive) : inputBad}`;
  const promo2CodeCls = `${inputBase} text-center ${promo2CodeParsed.ok && promo2PairOk && codesDistinct ? okOrInactive(promo2Inactive) : inputBad}`;
  const promo2PriceCls = `${inputBase} text-center ${promo2PriceParsed.ok && promo2PairOk ? okOrInactivePrice(promo2Inactive) : inputBad}`;

  const priceCell = hasPriceField ? (
    <input
      type="text"
      inputMode="numeric"
      placeholder={row.defaultPrice !== null ? String(row.defaultPrice) : '—'}
      className={priceCls}
      value={priceStr}
      onChange={e => setPriceStr(e.target.value)}
      title="Базова ціна. Залиш порожнім — буде використана дефолтна."
    />
  ) : null;
  const oldPriceCell = hasPriceField ? (
    <input
      type="text"
      inputMode="numeric"
      placeholder="—"
      className={oldPriceCls}
      value={oldPriceStr}
      onChange={e => setOldPriceStr(e.target.value)}
      title="Стара ціна. Якщо заповнена — на сторінці продукту покаже перекресленою."
    />
  ) : null;

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
        <p className={`text-[10px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{row.hint}</p>
      </div>
    </div>
  );

  // UI "Промокод 1" / "Ціна 1" → БД promo2* (публічний)
  const uiPromo1CodeCell = (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        placeholder="—"
        className={`${promo2CodeCls} uppercase flex-1 min-w-0`}
        value={promo2CodeStr}
        onChange={e => setPromo2CodeStr(e.target.value)}
        title="2–32 символи: латиниця, цифри, дефіс, підкреслення"
      />
      <PromoTimer
        theme={theme}
        startsAt={promo2StartsAt}
        expiresAt={promo2ExpiresAt}
        hasCode={promo2CodeParsed.code !== null}
        label={`Промокод 1 · ${row.titleUk}${row.hint ? ' ' + row.hint : ''}`}
        onChange={({ startsAt, expiresAt }) => {
          setPromo2StartsAt(startsAt);
          setPromo2ExpiresAt(expiresAt);
        }}
      />
    </div>
  );
  const uiPromo1PriceCell = (
    <input
      type="text"
      inputMode="numeric"
      placeholder="—"
      className={promo2PriceCls}
      value={promo2PriceStr}
      onChange={e => setPromo2PriceStr(e.target.value)}
    />
  );

  // UI "Промокод 2" / "Ціна 2" → БД promo1* (SECRETPASS)
  const uiPromo2CodeCell = (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        placeholder="—"
        className={`${promo1CodeCls} uppercase flex-1 min-w-0`}
        value={promo1CodeStr}
        onChange={e => setPromo1CodeStr(e.target.value)}
        title="2–32 символи: латиниця, цифри, дефіс, підкреслення"
      />
      <PromoTimer
        theme={theme}
        startsAt={promo1StartsAt}
        expiresAt={promo1ExpiresAt}
        hasCode={promo1CodeParsed.code !== null}
        label={`Промокод 2 · ${row.titleUk}${row.hint ? ' ' + row.hint : ''}`}
        onChange={({ startsAt, expiresAt }) => {
          setPromo1StartsAt(startsAt);
          setPromo1ExpiresAt(expiresAt);
        }}
      />
    </div>
  );
  const uiPromo2PriceCell = (
    <input
      type="text"
      inputMode="numeric"
      placeholder="—"
      className={promo1PriceCls}
      value={promo1PriceStr}
      onChange={e => setPromo1PriceStr(e.target.value)}
    />
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
    <div className="flex flex-row gap-1.5 items-center justify-center">
      <button type="button" onClick={handleSave} disabled={!dirty || saving} className={saveBtnCls}>
        <FaCheck className="text-[10px]" />
        {saving ? '...' : 'Зберегти'}
      </button>
      <button
        type="button"
        onClick={() => setShowResetModal(true)}
        disabled={!hasOverride || resetting}
        className={resetBtnCls}
      >
        <FaRotateLeft className="text-[10px]" />
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
        {hasPriceField && (
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
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Промокод 1
            </div>
            {uiPromo1CodeCell}
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Ціна 1, ₴
            </div>
            {uiPromo1PriceCell}
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Промокод 2
            </div>
            {uiPromo2CodeCell}
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Ціна 2, ₴
            </div>
            {uiPromo2PriceCell}
          </div>
        </div>
        <div className="flex justify-end">{actionsCell}</div>
      </div>
    );
  }

  return (
    <tr className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/80'}>
      <td className="px-3 py-2.5 align-middle">{titleCell}</td>
      <td className="px-2 py-2.5 align-middle">{priceCell}</td>
      <td className="px-2 py-2.5 align-middle">{oldPriceCell}</td>
      {/* SP ID — пусте для категорій */}
      <td className="px-2 py-2.5 align-middle" />
      <td className="px-2 py-2.5 align-middle">{uiPromo1CodeCell}</td>
      <td className="px-2 py-2.5 align-middle">{uiPromo1PriceCell}</td>
      <td className="px-2 py-2.5 align-middle">{uiPromo2CodeCell}</td>
      <td className="px-2 py-2.5 align-middle">{uiPromo2PriceCell}</td>
      <td className="px-2 py-2.5 align-middle">{actionsCell}</td>
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
        <h3 className="text-lg font-semibold mb-1">Скинути промокоди?</h3>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          Обидва промокоди для{' '}
          <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>«{title}»</span>{' '}
          буде видалено.
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
