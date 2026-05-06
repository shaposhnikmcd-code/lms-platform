'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlinePaperAirplane, HiOutlineCheckCircle, HiOutlinePencil, HiOutlineTrash, HiOutlineXMark } from 'react-icons/hi2';
import { FaSpinner } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';
import { useUIFeedback } from './UIFeedback';

export interface TelegramSettingsState {
  chatId: string | null;
  chatTitle: string | null;
  chatType: string | null;
  autoAdd: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Props {
  theme: Theme;
  initial: TelegramSettingsState;
}

/// Кнопка "Додати в Telegram канал" в toolbar адмінки Річної програми + popover з:
///   1. Інпут для chatId/@username + кнопка "Перевірити та зберегти"
///   2. Чекбокс "Автоматично додавати до каналу при оплаті"
///   3. Пілюля статусу: "✓ Канал зафіксовано: <title>" + олівець-edit + ×-clear
export default function TelegramChannelButton({ theme, initial }: Props) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TelegramSettingsState>(initial);
  const [editMode, setEditMode] = useState(!initial.chatId);
  const [chatIdInput, setChatIdInput] = useState(initial.chatId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const { toast, confirm } = useUIFeedback();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Закриття на клік поза popover і поза кнопкою.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Позиціонування popover-а під кнопкою. Використовуємо fixed + viewport-координати,
  // щоб popover не обрізався overflow:hidden у AdminShell. Перераховуємо при scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    function recalc() {
      if (!buttonRef.current) return;
      const r = buttonRef.current.getBoundingClientRect();
      setPopoverPos({
        top: r.bottom + 8,
        right: window.innerWidth - r.right,
      });
    }
    recalc();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open]);

  async function handleSave() {
    if (!chatIdInput.trim()) {
      setError('Вкажіть @username каналу або numeric chat_id');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/yearly-program/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', chatId: chatIdInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `${res.status}`);
        return;
      }
      setState(normalizeSettings(data.settings));
      setEditMode(false);
      toast('success', 'Telegram-канал збережено');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAuto(checked: boolean) {
    setAutoLoading(true);
    try {
      const res = await fetch('/api/admin/yearly-program/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-auto', autoAdd: checked }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? 'Не вдалося оновити');
        return;
      }
      setState(normalizeSettings(data.settings));
      toast('success', checked ? 'Автододавання увімкнено' : 'Автододавання вимкнено');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setAutoLoading(false);
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: 'Прибрати Telegram-канал?',
      description: 'Автододавання буде вимкнено. Існуючі invite-посилання студентам залишаються діючими в Telegram.',
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch('/api/admin/yearly-program/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? 'Не вдалося очистити');
        return;
      }
      setState(normalizeSettings(data.settings));
      setChatIdInput('');
      setEditMode(true);
      toast('success', 'Telegram-канал прибрано');
    } catch (e) {
      toast('error', (e as Error).message);
    }
  }

  const hasChannel = !!state.chatId;
  const buttonBg = dark
    ? 'bg-white/[0.03] hover:bg-amber-400/10 hover:border-amber-400/30 hover:text-amber-200 border-white/[0.08] text-slate-300'
    : 'bg-white/70 hover:bg-amber-50 hover:border-amber-300/60 hover:text-amber-900 border-stone-300/50 text-stone-700';

  const popover = open && popoverPos && (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: popoverPos.top, right: popoverPos.right, zIndex: 9999 }}
      className={`w-[420px] rounded-xl shadow-2xl border ${
        dark ? 'bg-[#0c0f15] border-white/[0.08]' : 'bg-white border-stone-200'
      }`}
    >
          <div className={`px-4 py-3 border-b flex items-center justify-between ${dark ? 'border-white/[0.06]' : 'border-stone-200'}`}>
            <div className="flex items-center gap-2">
              <HiOutlinePaperAirplane className={dark ? 'text-amber-300' : 'text-amber-700'} />
              <h3 className={`text-sm font-semibold ${dark ? 'text-slate-100' : 'text-stone-800'}`}>Telegram-канал Річної програми</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`w-6 h-6 inline-flex items-center justify-center rounded-md ${dark ? 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'}`}
              aria-label="Закрити"
            >
              <HiOutlineXMark />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {hasChannel && !editMode ? (
              <div
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${
                  dark ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-emerald-50 border-emerald-300/50'
                }`}
              >
                <HiOutlineCheckCircle className={`text-lg ${dark ? 'text-emerald-300' : 'text-emerald-700'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-medium ${dark ? 'text-emerald-200' : 'text-emerald-900'}`}>
                    Канал зафіксовано
                  </div>
                  <div className={`text-[11px] truncate ${dark ? 'text-slate-300' : 'text-stone-700'}`} title={state.chatTitle ?? state.chatId ?? ''}>
                    {state.chatTitle ?? state.chatId} {state.chatType && <span className="opacity-70">· {state.chatType}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditMode(true); setChatIdInput(state.chatId ?? ''); setError(null); }}
                  className={`p-1.5 rounded ${dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-600 hover:bg-stone-100'}`}
                  title="Редагувати"
                >
                  <HiOutlinePencil className="text-sm" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className={`p-1.5 rounded ${dark ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`}
                  title="Прибрати"
                >
                  <HiOutlineTrash className="text-sm" />
                </button>
              </div>
            ) : (
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  @username каналу або chat_id
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatIdInput}
                    onChange={(e) => { setChatIdInput(e.target.value); setError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleSave(); }}
                    placeholder="@uimp_yearly або -1001234567890"
                    autoComplete="off"
                    spellCheck={false}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-[12px] outline-none transition-colors ${
                      error
                        ? 'border-rose-400 bg-rose-50/30'
                        : dark
                          ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:border-amber-400/40'
                          : 'bg-white border-stone-300/60 text-stone-800 focus:border-amber-600/50'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !chatIdInput.trim()}
                    className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-[12px] font-medium transition-colors ${
                      dark
                        ? 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 border border-amber-400/30 disabled:opacity-50'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/60 disabled:opacity-50'
                    }`}
                  >
                    {saving ? <FaSpinner className="animate-spin text-xs" /> : <HiOutlineCheckCircle className="text-base" />}
                    {saving ? 'Перевірка…' : 'Перевірити та зберегти'}
                  </button>
                </div>
                {hasChannel && (
                  <button
                    type="button"
                    onClick={() => { setEditMode(false); setError(null); setChatIdInput(state.chatId ?? ''); }}
                    className={`mt-2 text-[11px] underline ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Скасувати редагування
                  </button>
                )}
                {error && (
                  <p className={`mt-2 text-[11px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                    {error}
                  </p>
                )}
                <p className={`mt-2 text-[11px] leading-relaxed ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Перед збереженням переконайтеся, що бот UIMP доданий у канал/групу як <b>адміністратор</b> з правом запрошення користувачів.
                </p>
              </div>
            )}

            <label
              className={`flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors ${
                state.autoAdd
                  ? dark
                    ? 'bg-emerald-500/10 border-emerald-400/30'
                    : 'bg-emerald-50 border-emerald-300/50'
                  : dark
                    ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
              } ${!hasChannel ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={state.autoAdd}
                disabled={autoLoading || !hasChannel}
                onChange={(e) => handleToggleAuto(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className={`text-[12px] font-medium ${dark ? 'text-slate-100' : 'text-stone-800'}`}>
                  Автоматично додавати до Telegram-каналу
                </div>
                <div className={`text-[11px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                  При успішній оплаті Річної програми система згенерує одноразове посилання-запрошення і додасть його до welcome-листа.
                </div>
              </div>
              {autoLoading && <FaSpinner className="animate-spin text-xs mt-1" />}
            </label>

            {state.updatedAt && (
              <div className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
                Оновлено {new Date(state.updatedAt).toLocaleString('uk-UA')}
                {state.updatedBy && <> · {state.updatedBy}</>}
              </div>
            )}
          </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-semibold transition-colors ${buttonBg}`}
        title="Налаштувати Telegram-канал Річної програми"
      >
        <HiOutlinePaperAirplane className="text-base" />
        <span>Додати в Telegram канал</span>
        {hasChannel && (
          <span
            className={`ml-0.5 inline-flex items-center justify-center w-2 h-2 rounded-full ${
              state.autoAdd ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            aria-hidden
          />
        )}
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}

function normalizeSettings(raw: {
  chatId?: string | null;
  chatTitle?: string | null;
  chatType?: string | null;
  autoAdd?: boolean;
  updatedAt?: string | Date | null;
  updatedBy?: string | null;
}): TelegramSettingsState {
  return {
    chatId: raw.chatId ?? null,
    chatTitle: raw.chatTitle ?? null,
    chatType: raw.chatType ?? null,
    autoAdd: !!raw.autoAdd,
    updatedAt: raw.updatedAt ? (typeof raw.updatedAt === 'string' ? raw.updatedAt : raw.updatedAt.toISOString()) : null,
    updatedBy: raw.updatedBy ?? null,
  };
}
