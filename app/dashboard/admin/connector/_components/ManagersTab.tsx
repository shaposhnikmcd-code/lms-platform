'use client';

/// Вкладка "Менеджери" в адмінці Конектора.
/// CRUD для відповідальних менеджерів (email + Telegram chat_id), кнопка "Тест" для перевірки каналу,
/// панель-інструкція "Як отримати свій chat_id".

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineInformationCircle,
  HiOutlineEnvelope,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlinePencil,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { FaTelegram } from 'react-icons/fa';
import { AdminPanel } from '../../_components/AdminShell';
import type { Theme } from '../../_components/adminTheme';

interface Manager {
  id: string;
  label: string;
  email: string | null;
  telegramChatId: string | null;
  enabled: boolean;
  notifyOnNew: boolean;
  notifyOnPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FlashMsg {
  kind: 'success' | 'error';
  text: string;
}

const BOT_USERNAME = 'connectorgame_bot';

export default function ManagersTab({ theme }: { theme: Theme }) {
  const dark = theme === 'dark';
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMsg | null>(null);
  const [botConfigured, setBotConfigured] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/connector-managers', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setManagers(data.managers ?? []);
        setBotConfigured(Boolean(data.botConfigured));
      } else {
        setFlash({ kind: 'error', text: data.error || 'Помилка завантаження' });
      }
    } catch {
      setFlash({ kind: 'error', text: 'Помилка мережі' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div className="space-y-5">
      {flash && (
        <div
          className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 border ${
            flash.kind === 'success'
              ? dark
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : dark
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {flash.kind === 'success' ? (
            <HiOutlineCheckCircle className="text-base mt-0.5 flex-shrink-0" />
          ) : (
            <HiOutlineExclamationTriangle className="text-base mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">{flash.text}</div>
        </div>
      )}

      {!botConfigured && (
        <div
          className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 border ${
            dark
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <HiOutlineExclamationTriangle className="text-base mt-0.5 flex-shrink-0" />
          <div>
            <b>Telegram-бот не налаштований.</b> Email-сповіщення працюватимуть, а Telegram — тільки після
            заповнення <code className="px-1 rounded bg-black/10">TELEGRAM_CONNECTOR_BOT_TOKEN</code> на сервері.
          </div>
        </div>
      )}

      {/* Header + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <HiOutlineUserGroup className={`text-xl ${dark ? 'text-amber-400' : 'text-amber-700'}`} />
          <h2 className={`text-base font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            Відповідальні менеджери
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <HiOutlineInformationCircle className="text-base" />
            Як отримати chat_id
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            disabled={creating}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              dark
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            } ${creating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <HiOutlinePlus className="text-base" />
            Додати менеджера
          </button>
        </div>
      </div>

      {showInstructions && <Instructions theme={theme} onClose={() => setShowInstructions(false)} />}

      {creating && (
        <ManagerForm
          theme={theme}
          onCancel={() => setCreating(false)}
          onSaved={(m, msg) => {
            setCreating(false);
            setManagers((prev) => (prev ? [...prev, m] : [m]));
            setFlash({ kind: 'success', text: msg });
          }}
          onError={(msg) => setFlash({ kind: 'error', text: msg })}
        />
      )}

      {/* List */}
      <AdminPanel theme={theme} padding="p-0">
        {loading ? (
          <div className={`px-4 py-12 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Завантаження…
          </div>
        ) : !managers || managers.length === 0 ? (
          <div className={`px-4 py-12 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Поки що жодного менеджера не додано. Натисніть <b>«Додати менеджера»</b>, щоб почати отримувати сповіщення.
          </div>
        ) : (
          <ul className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {managers.map((m) => (
              <ManagerRow
                key={m.id}
                m={m}
                theme={theme}
                isEditing={editingId === m.id}
                onEdit={() => {
                  setEditingId(m.id);
                  setCreating(false);
                }}
                onCancelEdit={() => setEditingId(null)}
                onUpdated={(updated, msg) => {
                  setManagers((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev));
                  setEditingId(null);
                  setFlash({ kind: 'success', text: msg });
                }}
                onDeleted={(id) => {
                  setManagers((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
                  setFlash({ kind: 'success', text: 'Менеджера видалено' });
                }}
                onError={(msg) => setFlash({ kind: 'error', text: msg })}
              />
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}

function StatusHelpPopup({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Закриття на Escape + блокування скролу боді поки попап відкритий.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const items: Array<{ title: string; desc: string; tip: string }> = [
    {
      title: 'Активний',
      desc: 'Головний вимикач для менеджера. Якщо вимкнений — він узагалі нічого не отримує: ні email, ні Telegram.',
      tip: 'Зручно, щоб тимчасово вимкнути людину (відпустка, лікарняний, звільнення) без видалення запису.',
    },
    {
      title: '🆕 Нова заявка',
      desc: 'Надсилати повідомлення коли клієнт натиснув «Замовити» і пішов на оплату (статус PENDING — заявка створена, але ще не оплачена).',
      tip: 'Сигнал «хтось щойно зацікавився». Якщо у клієнта була позначка 📞 «передзвонити» — менеджер може одразу зателефонувати.',
    },
    {
      title: '✅ Оплачено',
      desc: 'Надсилати повідомлення коли клієнт реально оплатив замовлення (статус PAID — гроші пройшли через WayForPay).',
      tip: 'Сигнал «час пакувати і відправляти Новою Поштою».',
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-help-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${dark ? 'bg-black/70' : 'bg-stone-900/40'} backdrop-blur-sm`}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className={`relative w-full max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl [&::-webkit-scrollbar]:hidden ${
          dark
            ? 'bg-[#0f1218] border-white/[0.08] text-slate-200'
            : 'bg-white border-stone-300/70 text-stone-800'
        }`}
      >
        <div
          className={`sticky top-0 flex items-start justify-between gap-3 px-5 py-4 border-b backdrop-blur-md ${
            dark ? 'bg-[#0f1218]/95 border-white/[0.06]' : 'bg-white/95 border-stone-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <HiOutlineInformationCircle className={`text-lg ${dark ? 'text-amber-400' : 'text-amber-700'}`} />
            <h3 id="status-help-title" className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
              Що означають статуси менеджера
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`p-1 rounded transition-colors ${
              dark ? 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
            }`}
            aria-label="Закрити"
          >
            <HiOutlineXMark className="text-xl" />
          </button>
        </div>

        <div className="p-5">
          <ul className="space-y-3">
            {items.map((it) => (
              <li
                key={it.title}
                className={`rounded-lg border p-3 ${
                  dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/60 border-stone-200'
                }`}
              >
                <div className={`text-sm font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{it.title}</div>
                <p className={`mt-1 text-[13px] leading-relaxed ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                  {it.desc}
                </p>
                <p className={`mt-1.5 text-[12px] leading-relaxed ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  💡 {it.tip}
                </p>
              </li>
            ))}
          </ul>

          <div
            className={`mt-4 pt-3 border-t text-[12px] leading-relaxed ${
              dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-200 text-stone-600'
            }`}
          >
            <b>Типові комбінації:</b>
            <ul className="mt-1.5 space-y-1 list-disc list-inside">
              <li>
                <b>Обидва ✅</b> — менеджер бачить увесь шлях клієнта (заявка → оплата).
              </li>
              <li>
                <b>Тільки «🆕 Нова заявка»</b> — для того, хто відповідає за дзвінки і прогрів клієнтів.
              </li>
              <li>
                <b>Тільки «✅ Оплачено»</b> — для того, хто пакує і відправляє замовлення Новою Поштою.
              </li>
              <li>
                <b>Обидва ❌</b> — нічого не приходить (фактично як «Неактивний»).
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Instructions({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const dark = theme === 'dark';
  return (
    <AdminPanel theme={theme} padding="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FaTelegram className={`text-lg ${dark ? 'text-sky-400' : 'text-sky-600'}`} />
          <h3 className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            Як отримати свій Telegram chat_id
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-400 hover:text-stone-600'}`}
          aria-label="Закрити"
        >
          <HiOutlineXMark className="text-lg" />
        </button>
      </div>
      <ol className={`text-sm leading-relaxed space-y-2 list-decimal list-inside ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
        <li>
          Відкрийте бота:{' '}
          <a
            href={`https://t.me/${BOT_USERNAME}`}
            target="_blank"
            rel="noreferrer"
            className={`font-mono underline ${dark ? 'text-sky-300' : 'text-sky-700'}`}
          >
            @{BOT_USERNAME}
          </a>
        </li>
        <li>
          Натисніть <b>«Запустити»</b> або надішліть команду <code className={`px-1 rounded ${dark ? 'bg-white/[0.06]' : 'bg-stone-200'}`}>/start</code>
        </li>
        <li>
          Бот пришле ваш <b>chat_id</b> — це число (наприклад, <code className={`px-1 rounded ${dark ? 'bg-white/[0.06]' : 'bg-stone-200'}`}>123456789</code>)
        </li>
        <li>
          Скопіюйте число й вставте у поле <b>«Telegram chat_id»</b> у формі менеджера
        </li>
      </ol>
      <div className={`mt-4 pt-3 border-t text-[12px] ${dark ? 'border-white/[0.06] text-slate-500' : 'border-stone-200 text-stone-500'}`}>
        💡 Хочете отримувати сповіщення в груповий чат? Додайте бота в групу, надішліть туди <code>/start</code>, і
        бот пришле груповий chat_id (число з мінусом, напр. <code>-100123456789</code>).
      </div>
    </AdminPanel>
  );
}

function ManagerRow({
  m,
  theme,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdated,
  onDeleted,
  onError,
}: {
  m: Manager;
  theme: Theme;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdated: (m: Manager, msg: string) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const dark = theme === 'dark';
  const [busy, setBusy] = useState<'enable' | 'new' | 'paid' | 'test' | 'delete' | null>(null);

  async function patch(payload: Record<string, unknown>, marker: typeof busy) {
    setBusy(marker);
    try {
      const res = await fetch(`/api/admin/connector-managers/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.manager) {
        onUpdated(data.manager, 'Оновлено');
      } else {
        onError(data.error || 'Помилка оновлення');
      }
    } catch {
      onError('Помилка мережі');
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy('test');
    try {
      const res = await fetch(`/api/admin/connector-managers/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-test' }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        const okChannels = data.results.filter((r: { ok: boolean }) => r.ok).map((r: { channel: string }) => r.channel);
        const failChannels = data.results.filter((r: { ok: boolean }) => !r.ok);
        if (failChannels.length === 0) {
          onUpdated(m, `Тест відправлено (${okChannels.join(', ')})`);
        } else {
          const failMsg = failChannels.map((r: { channel: string; error?: string }) => `${r.channel}: ${r.error}`).join('; ');
          onError(`Помилка тесту: ${failMsg}`);
        }
      } else {
        onError(data.error || 'Помилка тесту');
      }
    } catch {
      onError('Помилка мережі');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Видалити менеджера "${m.label}"? Цю дію не можна скасувати.`)) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/connector-managers/${m.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted(m.id);
      else {
        const data = await res.json().catch(() => ({}));
        onError(data.error || 'Помилка видалення');
      }
    } catch {
      onError('Помилка мережі');
    } finally {
      setBusy(null);
    }
  }

  if (isEditing) {
    return (
      <li className="px-4 py-4">
        <ManagerForm
          theme={theme}
          initial={m}
          onCancel={onCancelEdit}
          onSaved={(updated, msg) => onUpdated(updated, msg)}
          onError={onError}
        />
      </li>
    );
  }

  const muted = !m.enabled;

  return (
    <li className={`px-4 py-3 ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{m.label}</span>
            {!m.enabled && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.06] text-slate-400' : 'bg-stone-200 text-stone-600'}`}>
                Вимкнений
              </span>
            )}
          </div>
          <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            {m.email && (
              <span className="inline-flex items-center gap-1">
                <HiOutlineEnvelope className="text-sm" />
                {m.email}
              </span>
            )}
            {m.telegramChatId && (
              <span className="inline-flex items-center gap-1 font-mono">
                <FaTelegram className={`text-sm ${dark ? 'text-sky-400' : 'text-sky-600'}`} />
                {m.telegramChatId}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ToggleChip
              theme={theme}
              checked={m.enabled}
              onChange={(v) => patch({ enabled: v }, 'enable')}
              label="Активний"
              loading={busy === 'enable'}
            />
            <ToggleChip
              theme={theme}
              checked={m.notifyOnNew}
              onChange={(v) => patch({ notifyOnNew: v }, 'new')}
              label="🆕 Нова заявка"
              loading={busy === 'new'}
            />
            <ToggleChip
              theme={theme}
              checked={m.notifyOnPaid}
              onChange={(v) => patch({ notifyOnPaid: v }, 'paid')}
              label="✅ Оплачено"
              loading={busy === 'paid'}
            />
            <InfoButton theme={theme} />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={sendTest}
            disabled={busy !== null}
            title="Відправити тестове повідомлення"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-100'
            } ${busy !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <HiOutlinePaperAirplane className="text-sm" />
            Тест
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy !== null}
            title="Редагувати"
            className={`p-1.5 rounded-lg border transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-100'
            } ${busy !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <HiOutlinePencil className="text-sm" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            title="Видалити"
            className={`p-1.5 rounded-lg border transition-colors ${
              dark
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20'
                : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
            } ${busy !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <HiOutlineTrash className="text-sm" />
          </button>
        </div>
      </div>
    </li>
  );
}

function InfoButton({ theme }: { theme: Theme }) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Що означають ці статуси?"
        aria-label="Що означають ці статуси?"
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border transition-colors ${
          dark
            ? 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:bg-white/[0.10] hover:text-amber-300 hover:border-amber-400/40'
            : 'bg-white/80 border-stone-300/60 text-stone-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-400/50'
        }`}
      >
        <HiOutlineInformationCircle className="text-[15px]" />
      </button>
      {open && <StatusHelpPopup theme={theme} onClose={() => setOpen(false)} />}
    </>
  );
}

function ToggleChip({
  theme,
  checked,
  onChange,
  label,
  loading,
}: {
  theme: Theme;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  loading: boolean;
}) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => !loading && onChange(!checked)}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition-colors ${
        checked
          ? dark
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-emerald-100 border-emerald-300 text-emerald-800'
          : dark
            ? 'bg-white/[0.04] border-white/[0.08] text-slate-500'
            : 'bg-stone-100 border-stone-300 text-stone-500'
      } ${loading ? 'opacity-50' : ''}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${checked ? (dark ? 'bg-emerald-400' : 'bg-emerald-600') : dark ? 'bg-slate-600' : 'bg-stone-400'}`}
      />
      {label}
    </button>
  );
}

function ManagerForm({
  theme,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  theme: Theme;
  initial?: Manager;
  onCancel: () => void;
  onSaved: (m: Manager, msg: string) => void;
  onError: (msg: string) => void;
}) {
  const dark = theme === 'dark';
  const [label, setLabel] = useState(initial?.label ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [chatId, setChatId] = useState(initial?.telegramChatId ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [notifyOnNew, setNotifyOnNew] = useState(initial?.notifyOnNew ?? true);
  const [notifyOnPaid, setNotifyOnPaid] = useState(initial?.notifyOnPaid ?? true);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initial);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      onError('Заповніть "Назва/Ім\'я"');
      return;
    }
    if (!email.trim() && !chatId.trim()) {
      onError('Вкажіть хоча б один канал — email або Telegram chat_id');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/connector-managers/${initial!.id}` : '/api/admin/connector-managers';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          email: email.trim() || null,
          telegramChatId: chatId.trim() || null,
          enabled,
          notifyOnNew,
          notifyOnPaid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.manager) {
        onSaved(data.manager, isEdit ? 'Менеджера оновлено' : 'Менеджера додано');
      } else {
        onError(data.error || 'Помилка збереження');
      }
    } catch {
      onError('Помилка мережі');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-xl border p-4 space-y-3 ${
        dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/70 border-stone-300/60'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
          {isEdit ? 'Редагувати менеджера' : 'Новий менеджер'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className={`p-1 rounded ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-400 hover:text-stone-600'}`}
          aria-label="Скасувати"
        >
          <HiOutlineXMark className="text-lg" />
        </button>
      </div>

      <Field theme={theme} label="Назва / Ім'я" required>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Напр. Тетяна / основна"
          required
          className={inputCls(dark)}
        />
      </Field>

      <Field theme={theme} label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="manager@example.com"
          className={inputCls(dark)}
        />
      </Field>

      <Field theme={theme} label="Telegram chat_id" hint={`Отримати: t.me/${BOT_USERNAME} → /start`}>
        <input
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="напр. 123456789"
          inputMode="numeric"
          className={`${inputCls(dark)} font-mono`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <label className={`inline-flex items-center gap-2 text-[13px] cursor-pointer ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Активний
        </label>
        <label className={`inline-flex items-center gap-2 text-[13px] cursor-pointer ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
          <input type="checkbox" checked={notifyOnNew} onChange={(e) => setNotifyOnNew(e.target.checked)} />
          🆕 Нова заявка
        </label>
        <label className={`inline-flex items-center gap-2 text-[13px] cursor-pointer ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
          <input type="checkbox" checked={notifyOnPaid} onChange={(e) => setNotifyOnPaid(e.target.checked)} />
          ✅ Оплачено
        </label>
        <InfoButton theme={theme} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
              : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
          }`}
        >
          Скасувати
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
            dark
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? 'Збереження…' : isEdit ? 'Зберегти' : 'Додати'}
        </button>
      </div>
    </form>
  );
}

function Field({
  theme,
  label,
  required,
  hint,
  children,
}: {
  theme: Theme;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <div>
      <label className={`block text-[12px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{hint}</p>}
    </div>
  );
}

function inputCls(dark: boolean): string {
  return `block w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
      : 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
  }`;
}
