'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Theme = 'light' | 'dark';

interface TemplateItem {
  key: string;
  title: string;
  when: string;
  placeholders: string[];
  sampleData: Record<string, string>;
  subject: string;
  bodyHtml: string;
  defaultSubject: string;
  defaultBodyHtml: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/// Модалка "Листи платежів" — редагує транзакційні email-шаблони Річної програми.
/// Дві в'ю: list (ліво/всі) і editor (один template, праворуч). Editor real-time
/// рендерить прев'ю через POST /preview (підставляючи sampleData в placeholder-и).
export default function PaymentTemplatesModal({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<TemplateItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    fetch('/api/admin/yearly-program/payment-templates')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) setItems(data.items);
        else setLoadError(data?.error ?? 'Не вдалось завантажити шаблони');
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const selected = selectedKey ? items?.find((i) => i.key === selectedKey) : null;

  const onSaved = (key: string, updated: { subject: string; bodyHtml: string; isCustomized: boolean; updatedAt: string | null; updatedBy: string | null }) => {
    setItems((prev) => prev?.map((i) => i.key === key ? { ...i, ...updated } : i) ?? null);
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'}`}>
          <h3 className="text-base font-bold flex items-center gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className={`text-[12px] font-medium underline-offset-2 hover:underline ${dark ? 'text-amber-300' : 'text-amber-800'}`}
              >
                ← До списку
              </button>
            )}
            <span>Листи платежів {selected ? `— ${selected.title}` : ''}</span>
          </h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-5 py-4">
          {loadError && (
            <div className={`p-3 rounded-lg text-[12px] ${dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-800'}`}>
              {loadError}
            </div>
          )}

          {!items && !loadError && (
            <div className={`text-[13px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Завантаження…</div>
          )}

          {items && !selected && (
            <TemplateList theme={theme} items={items} onSelect={setSelectedKey} />
          )}

          {items && selected && (
            <TemplateEditor
              theme={theme}
              item={selected}
              onSaved={(updated) => onSaved(selected.key, updated)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TemplateList({
  theme,
  items,
  onSelect,
}: {
  theme: Theme;
  items: TemplateItem[];
  onSelect: (key: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <div className="space-y-2">
      <p className={`text-[12px] mb-3 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
        Транзакційні листи Річної програми, які шлемо автоматично. Натисни на шаблон щоб переглянути або відредагувати.
      </p>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            dark ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]' : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] font-bold">{item.title}</div>
            {item.isCustomized && (
              <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800'
              }`}>
                Змінено
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-1 leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{item.when}</p>
        </button>
      ))}
    </div>
  );
}

function TemplateEditor({
  theme,
  item,
  onSaved,
}: {
  theme: Theme;
  item: TemplateItem;
  onSaved: (updated: { subject: string; bodyHtml: string; isCustomized: boolean; updatedAt: string | null; updatedBy: string | null }) => void;
}) {
  const dark = theme === 'dark';
  const [subject, setSubject] = useState(item.subject);
  const [bodyHtml, setBodyHtml] = useState(item.bodyHtml);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const dirty = subject !== item.subject || bodyHtml !== item.bodyHtml;

  // Real-time preview з debounce. POST /preview бо body може бути довгий.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/yearly-program/payment-templates/${encodeURIComponent(item.key)}/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, bodyHtml }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const text = await res.text();
        setPreviewHtml(text);
        setPreviewError(null);
      } catch (e) {
        setPreviewError((e as Error).message);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [item.key, subject, bodyHtml]);

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/payment-templates/${encodeURIComponent(item.key)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, bodyHtml }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved({
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        isCustomized: data.isCustomized,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
      setSaveOk('Збережено');
      setTimeout(() => setSaveOk(null), 2500);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!confirm('Скинути цей шаблон до дефолту з коду? Поточні правки буде втрачено.')) return;
    setResetting(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/payment-templates/${encodeURIComponent(item.key)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSubject(data.subject);
      setBodyHtml(data.bodyHtml);
      onSaved({
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        isCustomized: false,
        updatedAt: null,
        updatedBy: null,
      });
      setSaveOk('Скинуто до дефолту');
      setTimeout(() => setSaveOk(null), 2500);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const placeholdersHelp = useMemo(
    () => item.placeholders.map((p) => `{${p}}`).join(', '),
    [item.placeholders],
  );

  const inputBase = dark
    ? 'bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500'
    : 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400';

  return (
    <div className="space-y-4">
      <div className={`text-[12px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        <p>{item.when}</p>
        {item.placeholders.length > 0 && (
          <p className="mt-2">
            <b>Доступні placeholder-и:</b>{' '}
            <code className={dark ? 'text-amber-300' : 'text-amber-800'}>{placeholdersHelp}</code>{' '}
            <span className="opacity-70">— підставляться у момент відправки.</span>
          </p>
        )}
        {item.isCustomized && item.updatedAt && (
          <p className="mt-1 opacity-70">
            Останнє редагування: {new Date(item.updatedAt).toLocaleString('uk-UA')} {item.updatedBy ? `· ${item.updatedBy}` : ''}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          Тема листа
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={300}
          className={`w-full px-3 py-2 rounded-lg border text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${inputBase}`}
        />
      </div>

      <div className="space-y-2">
        <label className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          Тіло листа (HTML)
        </label>
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={14}
          spellCheck={false}
          className={`w-full px-3 py-2 rounded-lg border text-[12px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${inputBase}`}
        />
      </div>

      <div className="space-y-2">
        <label className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          Прев'ю (з тестовими даними)
        </label>
        {previewError && (
          <div className={`p-2 rounded text-[11px] ${dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-800'}`}>
            {previewError}
          </div>
        )}
        <iframe
          key={item.key}
          srcDoc={previewHtml}
          title={`Прев'ю: ${item.title}`}
          className={`w-full h-[440px] rounded-lg border bg-white ${dark ? 'border-white/10' : 'border-stone-200'}`}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {saveOk && (
            <span className={`text-[12px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>{saveOk}</span>
          )}
          {saveError && (
            <span className={`text-[12px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>{saveError}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.isCustomized && (
            <button
              type="button"
              onClick={onReset}
              disabled={resetting || saving}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-50 ${
                dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {resetting ? 'Скидаю…' : 'Скинути до дефолту'}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50 ${
              dark
                ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:hover:bg-amber-500'
                : 'bg-amber-500 text-white hover:bg-amber-600 disabled:hover:bg-amber-500'
            }`}
          >
            {saving ? 'Зберігаю…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
