'use client';

import { useState } from 'react';
import { HiOutlinePauseCircle, HiOutlinePlayCircle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import { AdminPanel } from '../../_components/AdminShell';
import type { ConnectorSalesState } from '@/lib/connectorSales';
import { CONNECTOR_PAUSED_LABEL_DEFAULT, CONNECTOR_PAUSED_LABEL_MAX, CONNECTOR_PAUSED_NOTE_MAX } from '@/lib/connectorSales';

/// Панель «Продаж гри» в адмінці Конектора: зупинити/відновити продаж на /games і
/// /links/connector і задати текст, який клієнт бачить замість «Замовити».
/// Пише через `POST /api/admin/connector/sales`. Публічні сторінки читають стан
/// на кожен запит (revalidate=0), тож зміна видна одразу.
export default function SalesPanel({ theme, initial }: { theme: Theme; initial: ConnectorSalesState }) {
  const dark = theme === 'dark';
  const [sales, setSales] = useState<ConnectorSalesState>(initial);
  const [label, setLabel] = useState(initial.pausedLabel);
  const [note, setNote] = useState(initial.pausedNote ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = sales.paused && (label.trim() !== sales.pausedLabel || note.trim() !== (sales.pausedNote ?? ''));

  async function save(paused: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/connector/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused, pausedLabel: label, pausedNote: note }),
      });
      const data = (await res.json().catch(() => ({}))) as { sales?: ConnectorSalesState; error?: string };
      if (!res.ok || !data.sales) {
        setMsg({ ok: false, text: data.error ?? `Помилка ${res.status}` });
        return;
      }
      setSales(data.sales);
      setLabel(data.sales.pausedLabel);
      setNote(data.sales.pausedNote ?? '');
      setMsg({
        ok: true,
        text: data.sales.paused
          ? 'Продаж зупинено — на сайті замість кнопки «Замовити» показується ваш текст.'
          : 'Продаж відновлено — кнопка «Замовити» знову на сайті.',
      });
    } catch {
      setMsg({ ok: false, text: 'Не вдалось зберегти — перевірте зʼєднання і спробуйте ще раз.' });
    } finally {
      setBusy(false);
    }
  }

  const inputCls = `w-full px-3 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
      : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
  }`;
  const labelCls = `block mb-1 text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`;
  const secondaryBtn = `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[13px] font-medium transition-colors disabled:opacity-50 ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]'
      : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-100'
  }`;

  return (
    <AdminPanel theme={theme} padding="px-4 py-3" className="mb-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[200px]">
          <span className={labelCls}>Продаж гри на сайті</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold border ${
              sales.paused
                ? dark
                  ? 'bg-rose-500/15 text-rose-200 border-rose-500/30'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
                : dark
                  ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${sales.paused ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            {sales.paused ? 'Зупинено' : 'Відкрито'}
          </span>
          {sales.updatedAt && (
            <p className={`mt-1.5 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Змінено{' '}
              {new Date(sales.updatedAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {sales.updatedBy ? ` · ${sales.updatedBy}` : ''}
            </p>
          )}
        </div>

        <div className="flex-1 min-w-[220px] max-w-[320px]">
          <label className={labelCls} htmlFor="connector-paused-label">
            Текст замість кнопки «Замовити»
          </label>
          <input
            id="connector-paused-label"
            value={label}
            maxLength={CONNECTOR_PAUSED_LABEL_MAX}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={CONNECTOR_PAUSED_LABEL_DEFAULT}
            className={inputCls}
          />
        </div>

        <div className="flex-1 min-w-[260px]">
          <label className={labelCls} htmlFor="connector-paused-note">
            Пояснення під кнопкою (необовʼязково)
          </label>
          <input
            id="connector-paused-note"
            value={note}
            maxLength={CONNECTOR_PAUSED_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Напр.: Нова партія — у грудні. Напишіть нам, і ми повідомимо, коли гра зʼявиться"
            className={inputCls}
          />
        </div>

        <div className="flex items-end gap-2 self-end">
          {sales.paused ? (
            <>
              {dirty && (
                <button type="button" disabled={busy} onClick={() => save(true)} className={secondaryBtn}>
                  Зберегти текст
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => save(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[13px] font-semibold transition-colors disabled:opacity-50 bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
              >
                <HiOutlinePlayCircle className="text-base" />
                Відновити продаж
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => save(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[13px] font-semibold transition-colors disabled:opacity-50 bg-rose-600 border-rose-600 text-white hover:bg-rose-700"
            >
              <HiOutlinePauseCircle className="text-base" />
              Зупинити продаж
            </button>
          )}
        </div>
      </div>
      <p className={`mt-2 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        Діє на сторінки /games і /links/connector усіма мовами. Поки продаж зупинено, сайт не приймає нові замовлення.
      </p>
      {msg && (
        <p className={`mt-2 text-[12px] ${msg.ok ? (dark ? 'text-emerald-300' : 'text-emerald-700') : dark ? 'text-rose-300' : 'text-rose-700'}`}>
          {msg.text}
        </p>
      )}
    </AdminPanel>
  );
}
