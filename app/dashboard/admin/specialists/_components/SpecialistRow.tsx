'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaRotateLeft, FaCheck, FaEye, FaEyeSlash } from 'react-icons/fa6';
import type { Theme } from '../../_components/adminTheme';

interface Defaults {
  price: string;
  duration: string;
  btnLabel: string;
  btnUrl: string;
}

interface OverrideData {
  price: string | null;
  duration: string | null;
  btnLabel: string | null;
  btnUrl: string | null;
  hidden: boolean;
}

export interface SpecialistRowData {
  slug: string;
  name: string;
  role: string;
  image: string | null;
  defaults: Defaults;
  override: OverrideData | null;
}

function overrideToForm(o: OverrideData | null, d: Defaults) {
  return {
    price: o?.price ?? d.price,
    duration: o?.duration ?? d.duration,
    btnLabel: o?.btnLabel ?? d.btnLabel,
    btnUrl: o?.btnUrl ?? d.btnUrl,
    hidden: o?.hidden ?? false,
  };
}

export default function SpecialistRow({
  row,
  theme,
  mobile = false,
}: {
  row: SpecialistRowData;
  theme: Theme;
  mobile?: boolean;
}) {
  const router = useRouter();
  const dark = theme === 'dark';
  const initial = useMemo(() => overrideToForm(row.override, row.defaults), [row.override, row.defaults]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const dirty =
    form.price !== initial.price ||
    form.duration !== initial.duration ||
    form.btnLabel !== initial.btnLabel ||
    form.btnUrl !== initial.btnUrl ||
    form.hidden !== initial.hidden;

  const hasAnyOverride =
    !!row.override &&
    (row.override.price !== null ||
      row.override.duration !== null ||
      row.override.btnLabel !== null ||
      row.override.btnUrl !== null ||
      row.override.hidden === true);

  async function handleSave() {
    setSaving(true);
    const diff = (current: string, def: string) =>
      current.trim() === def.trim() ? '' : current.trim();
    try {
      const res = await fetch(`/api/admin/specialists/${row.slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: diff(form.price, row.defaults.price),
          duration: diff(form.duration, row.defaults.duration),
          btnLabel: diff(form.btnLabel, row.defaults.btnLabel),
          btnUrl: diff(form.btnUrl, row.defaults.btnUrl),
          hidden: form.hidden,
        }),
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
      const res = await fetch(`/api/admin/specialists/${row.slug}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося скинути');
        return;
      }
      setForm(overrideToForm(null, row.defaults));
      router.refresh();
    } catch (err) {
      alert(`Помилка: ${err}`);
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  }

  const inputCls = `w-full px-2.5 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 border transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/50 focus:border-amber-400/40 placeholder:text-slate-600'
      : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40 focus:border-amber-500/50 placeholder:text-stone-400'
  }`;

  const titleCell = (
    <div className="flex items-center gap-3">
      {row.image ? (
        <div
          className={`relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${
            dark ? 'border-white/[0.1]' : 'border-stone-300/60'
          }`}
        >
          <Image src={row.image} alt={row.name} fill sizes="40px" style={{ objectFit: 'cover' }} />
        </div>
      ) : (
        <div
          className={`w-10 h-10 rounded-full flex-shrink-0 border ${
            dark
              ? 'bg-white/[0.06] border-white/[0.1]'
              : 'bg-stone-100/80 border-stone-300/60'
          }`}
        />
      )}
      <div className="min-w-0">
        <p
          className={`text-[13px] font-medium leading-tight ${
            form.hidden
              ? dark ? 'text-slate-500' : 'text-stone-500'
              : dark ? 'text-slate-100' : 'text-stone-900'
          }`}
        >
          {row.name}
        </p>
        <p className={`text-[11px] truncate max-w-[180px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {row.role}
        </p>
      </div>
    </div>
  );

  const showToggleCls = `inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
    form.hidden
      ? dark
        ? 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:bg-white/[0.08]'
        : 'bg-stone-100/80 text-stone-600 border-stone-300/60 hover:bg-stone-200/70'
      : dark
        ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25 hover:bg-emerald-500/20'
        : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30 hover:bg-emerald-200/70'
  }`;

  const showToggle = (
    <button
      type="button"
      onClick={() => setForm({ ...form, hidden: !form.hidden })}
      className={showToggleCls}
      title={form.hidden ? 'Сховано — натисни щоб показати' : 'Видно — натисни щоб сховати'}
    >
      {form.hidden ? <FaEyeSlash className="text-[10px]" /> : <FaEye className="text-[10px]" />}
      {form.hidden ? 'Сховано' : 'Видно'}
    </button>
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

  const actions = (
    <div className="flex flex-col gap-1.5 items-stretch min-w-[130px]">
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
          name={row.name}
          onCancel={() => setShowResetModal(false)}
          onConfirm={handleReset}
          resetting={resetting}
        />
      )}
    </div>
  );

  if (mobile) {
    return (
      <div className={`p-4 space-y-3 ${form.hidden ? (dark ? 'bg-white/[0.02]' : 'bg-stone-100/40') : ''}`}>
        <div className="flex items-start justify-between gap-3">
          {titleCell}
          {showToggle}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Вартість" theme={theme}>
            <input
              type="text"
              className={inputCls}
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
              placeholder={row.defaults.price}
            />
          </Field>
          <Field label="Тривалість" theme={theme}>
            <input
              type="text"
              className={inputCls}
              value={form.duration}
              onChange={e => setForm({ ...form, duration: e.target.value })}
              placeholder={row.defaults.duration}
            />
          </Field>
        </div>
        <Field label="Текст кнопки" theme={theme}>
          <input
            type="text"
            className={inputCls}
            value={form.btnLabel}
            onChange={e => setForm({ ...form, btnLabel: e.target.value })}
            placeholder={row.defaults.btnLabel}
          />
        </Field>
        <Field label="Посилання на запис" theme={theme}>
          <input
            type="url"
            className={inputCls}
            value={form.btnUrl}
            onChange={e => setForm({ ...form, btnUrl: e.target.value })}
            placeholder={row.defaults.btnUrl}
          />
        </Field>
        <div className="flex justify-end">{actions}</div>
      </div>
    );
  }

  return (
    <tr
      className={`transition-colors ${
        form.hidden
          ? dark ? 'bg-white/[0.015]' : 'bg-stone-100/40'
          : dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/80'
      }`}
    >
      <td className="px-4 py-3 align-middle">{titleCell}</td>
      <td className="px-3 py-3 align-middle">
        <input
          type="text"
          className={inputCls}
          value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
          placeholder={row.defaults.price}
        />
      </td>
      <td className="px-3 py-3 align-middle">
        <input
          type="text"
          className={inputCls}
          value={form.duration}
          onChange={e => setForm({ ...form, duration: e.target.value })}
          placeholder={row.defaults.duration}
        />
      </td>
      <td className="px-3 py-3 align-middle">
        <input
          type="text"
          className={inputCls}
          value={form.btnLabel}
          onChange={e => setForm({ ...form, btnLabel: e.target.value })}
          placeholder={row.defaults.btnLabel}
        />
      </td>
      <td className="px-3 py-3 align-middle">
        <input
          type="url"
          className={inputCls}
          value={form.btnUrl}
          onChange={e => setForm({ ...form, btnUrl: e.target.value })}
          placeholder={row.defaults.btnUrl}
        />
      </td>
      <td className="px-3 py-3 align-middle text-center">{showToggle}</td>
      <td className="px-3 py-3 align-middle">{actions}</td>
    </tr>
  );
}

function Field({
  label,
  theme,
  children,
}: {
  label: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <div>
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ResetModal({
  theme,
  name,
  onCancel,
  onConfirm,
  resetting,
}: {
  theme: Theme;
  name: string;
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
        <h3 className="text-lg font-semibold mb-1">Скинути всі зміни?</h3>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          Поля для{' '}
          <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>«{name}»</span>{' '}
          повернуться до значень за замовчуванням з коду. Цю дію не можна відмінити.
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
