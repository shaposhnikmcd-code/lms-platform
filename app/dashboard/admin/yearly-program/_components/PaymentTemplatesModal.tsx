'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlineInformationCircle,
  HiOutlineArrowUturnLeft,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineChevronRight,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import WysiwygEmailEditor from './WysiwygEmailEditor';
import {
  EmailPreviewFrame,
  RemovedPlaceholderAlert,
  PlaceholderLegend,
  extractUsedPlaceholders,
} from './EmailEditorParts';
import { PLACEHOLDER_DESCRIPTIONS } from '@/lib/emailTemplates/paymentTemplates';
import { REMINDER_PLACEHOLDER_DESCRIPTIONS } from '@/lib/emailTemplates/reminderTemplates';

/// Конфіг варіанту модалки. Через нього вирізаємо дублікат коду між Listами Платежів і Нагадувань —
/// логіка модалки спільна, відрізняються лише endpoint-и, тексти і палітра груп.
export interface EmailTemplatesModalConfig {
  apiBase: string;
  modalTitle: string;
  modalSubtitle: string;
  introText: string;
  placeholderDescriptions: Record<string, { what: string; consequence: string }>;
  groupAccents: Record<string, GroupAccent>;
  cacheKey: string;
}

type Theme = 'light' | 'dark';

/// Тонкий list-item — без HTML-тіла. Повертає GET /payment-templates.
interface TemplateListItem {
  key: string;
  group: string;
  title: string;
  when: string;
  placeholders: string[];
  sampleData: Record<string, string>;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/// Повна інформація про шаблон з HTML-тілом. Повертає GET /payment-templates/:key.
/// Композиція з ListItem + body-fields. Використовується у TemplateEditor.
type TemplateFullItem = TemplateListItem & {
  subject: string;
  bodyHtml: string;
  bodyInnerHtml: string;
  defaultSubject: string;
  defaultBodyHtml: string;
  defaultBodyInnerHtml: string;
};

interface GroupItem {
  id: string;
  title: string;
  description: string;
}

// ─── Module-level caches ──────────────────────────────────
// Кешуємо список і повні шаблони на рівні модуля — вижити закриття/відкриття модалки.
// Окрема пара кешів на кожен варіант (payment/reminder) щоб не перетиналось.
const listCaches = new Map<string, { items: TemplateListItem[]; groups: GroupItem[] }>();
const fullCaches = new Map<string, Record<string, TemplateFullItem>>();
function getFullCache(key: string): Record<string, TemplateFullItem> {
  let cache = fullCaches.get(key);
  if (!cache) { cache = {}; fullCaches.set(key, cache); }
  return cache;
}

/// Палітра по групах. amber=primary/payment/cyclical, indigo=plan-change, rose=admin-end/shared,
/// sky=manual (нагадування ручної оплати).
type GroupAccent = 'amber' | 'indigo' | 'rose' | 'slate' | 'sky';

const PAYMENT_CONFIG: EmailTemplatesModalConfig = {
  apiBase: '/api/admin/yearly-program/payment-templates',
  modalTitle: 'Листи Платежів',
  modalSubtitle: 'Транзакційні листи Річної програми · редагуються менеджером',
  introText: 'Тут зібрані всі листи, які сайт надсилає автоматично при оплатах і змінах підписки. Натисни на шаблон щоб подивитись прев\'ю чи відредагувати текст.',
  placeholderDescriptions: PLACEHOLDER_DESCRIPTIONS,
  groupAccents: { payment: 'amber', 'plan-change': 'indigo', 'admin-end': 'rose' },
  cacheKey: 'payment',
};

const REMINDER_CONFIG: EmailTemplatesModalConfig = {
  apiBase: '/api/admin/yearly-program/reminder-templates',
  modalTitle: 'Листи Нагадування',
  modalSubtitle: 'Email-нагадування про оплату · cron щодня о 04:00 UTC',
  introText: 'Листи-нагадування про оплату наступного місяця. Manual flow — для тих, хто платить вручну. Cyclical flow — для автосписання, шлемо лише при невдалому списанні з картки.',
  placeholderDescriptions: REMINDER_PLACEHOLDER_DESCRIPTIONS,
  groupAccents: { manual: 'sky', cyclical: 'amber', shared: 'rose' },
  cacheKey: 'reminder',
};

/// Wrapper-default — Listи Платежів.
export default function PaymentTemplatesModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  return <EmailTemplatesModal config={PAYMENT_CONFIG} theme={theme} onClose={onClose} />;
}

/// Wrapper для Листів Нагадувань.
export function RemindersTemplatesModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  return <EmailTemplatesModal config={REMINDER_CONFIG} theme={theme} onClose={onClose} />;
}

function EmailTemplatesModal({
  config,
  theme,
  onClose,
}: {
  config: EmailTemplatesModalConfig;
  theme: Theme;
  onClose: () => void;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  // Стартуємо з кешу — якщо вже відкривали модалку, дані з'являться миттєво.
  const initialList = listCaches.get(config.cacheKey);
  const [items, setItems] = useState<TemplateListItem[] | null>(initialList?.items ?? null);
  const [groups, setGroups] = useState<GroupItem[]>(initialList?.groups ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFull, setSelectedFull] = useState<TemplateFullItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    if (listCaches.has(config.cacheKey)) return; // cache hit
    fetch(config.apiBase)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) {
          const cache = { items: data.items, groups: Array.isArray(data?.groups) ? data.groups : [] };
          listCaches.set(config.cacheKey, cache);
          setItems(cache.items);
          setGroups(cache.groups);
        } else {
          setLoadError(data?.error ?? 'Не вдалось завантажити шаблони');
        }
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [config.apiBase, config.cacheKey]);

  // Завантажуємо повний шаблон лазі, коли менеджер обирає рядок зі списку. Кеш per-key —
  // повторний клік на той самий шаблон миттєвий.
  useEffect(() => {
    if (!selectedKey) {
      setSelectedFull(null);
      return;
    }
    const fullCache = getFullCache(config.cacheKey);
    const cached = fullCache[selectedKey];
    if (cached) {
      setSelectedFull(cached);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`${config.apiBase}/${encodeURIComponent(selectedKey)}`)
      .then((r) => r.json())
      .then((data: TemplateFullItem & { error?: string }) => {
        if (cancelled) return;
        if (data?.error) {
          setLoadError(data.error);
          return;
        }
        // Метадані з list (when, placeholders, sampleData etc.) GET /:key не повертає —
        // склеюємо з list-item.
        const listCache = listCaches.get(config.cacheKey);
        const meta = listCache?.items.find((i) => i.key === selectedKey);
        const full: TemplateFullItem = { ...(meta ?? ({} as TemplateListItem)), ...data };
        fullCache[selectedKey] = full;
        setSelectedFull(full);
      })
      .catch((e) => { if (!cancelled) setLoadError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedKey, config.apiBase, config.cacheKey]);

  /// Після збереження шаблону: оновити обидва кеші (повний + list) щоб «Змінено»-бейдж
  /// з'явився одразу і в списку, і повторне відкриття не тягло stale data.
  const onSaved = (key: string, updated: { subject: string; bodyHtml: string; bodyInnerHtml: string; isCustomized: boolean; updatedAt: string | null; updatedBy: string | null }) => {
    const fullCache = getFullCache(config.cacheKey);
    if (fullCache[key]) {
      fullCache[key] = { ...fullCache[key], ...updated };
      setSelectedFull(fullCache[key]);
    }
    const listCache = listCaches.get(config.cacheKey);
    if (listCache) {
      const newCache = {
        ...listCache,
        items: listCache.items.map((i) => i.key === key
          ? { ...i, isCustomized: updated.isCustomized, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy }
          : i,
        ),
      };
      listCaches.set(config.cacheKey, newCache);
      setItems(newCache.items);
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(1240px, 96vw)' }}
      >
        {/* HEADER */}
        <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b backdrop-blur ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-800 border border-amber-300/60'
            }`}>
              <HiOutlineEnvelope />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">{config.modalTitle}</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                {selectedKey
                  ? <span className="flex items-center gap-1.5"><HiOutlineChevronRight className="text-[10px] opacity-50" />{items?.find((i) => i.key === selectedKey)?.title ?? '…'}</span>
                  : config.modalSubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedKey && (
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold border-2 transition-colors shadow-sm ${
                  dark
                    ? 'bg-amber-400/15 border-amber-400/50 text-amber-200 hover:bg-amber-400/25 hover:border-amber-400/70'
                    : 'bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200 hover:border-amber-500'
                }`}
              >
                <HiOutlineArrowUturnLeft className="text-[15px]" /> До списку шаблонів
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Закрити"
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
                dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'
              }`}
            >✕</button>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="px-6 py-5">
            {loadError && (
              <div className={`p-3 rounded-lg text-[12px] mb-4 ${dark ? 'bg-rose-500/15 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {loadError}
              </div>
            )}

            {!items && !loadError && (
              <div className={`text-[13px] py-12 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Завантаження шаблонів…
              </div>
            )}

            {items && !selectedKey && (
              <TemplateList theme={theme} items={items} groups={groups} config={config} onSelect={setSelectedKey} />
            )}

            {items && selectedKey && !selectedFull && loadingDetail && (
              <TemplateEditorSkeleton theme={theme} />
            )}

            {items && selectedKey && selectedFull && (
              <TemplateEditor
                key={selectedFull.key}
                theme={theme}
                item={selectedFull}
                config={config}
                onSaved={(updated) => onSaved(selectedFull.key, updated)}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────── LIST VIEW ───────────────────────

function TemplateList({
  theme,
  items,
  groups,
  config,
  onSelect,
}: {
  theme: Theme;
  items: TemplateListItem[];
  groups: GroupItem[];
  config: EmailTemplatesModalConfig;
  onSelect: (key: string) => void;
}) {
  const dark = theme === 'dark';
  const groupList = groups.length > 0
    ? groups
    : Array.from(new Set(items.map((i) => i.group))).map((id) => ({ id, title: id, description: '' }));

  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
        dark ? 'bg-amber-500/[0.05] border-amber-400/20 text-amber-100/90' : 'bg-amber-50/60 border-amber-200/70 text-amber-900'
      }`}>
        <HiOutlineSparkles className="text-base shrink-0 mt-0.5" />
        <p className="text-[12px] leading-relaxed">
          {config.introText}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {groupList.map((g) => {
          const groupItems = items.filter((i) => i.group === g.id);
          if (groupItems.length === 0) return null;
          const accent = config.groupAccents[g.id] ?? 'slate';
          return (
            <GroupCard key={g.id} dark={dark} group={g} accent={accent}>
              {groupItems.map((item) => (
                <TemplateRow key={item.key} dark={dark} item={item} accent={accent} onClick={() => onSelect(item.key)} />
              ))}
            </GroupCard>
          );
        })}
      </div>
    </div>
  );
}

function GroupCard({
  dark, group, accent, children,
}: {
  dark: boolean;
  group: GroupItem;
  accent: GroupAccent;
  children: React.ReactNode;
}) {
  const accentClasses = ACCENT_CLASSES[accent];
  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col ${
      dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white'
    }`}>
      <div className={`px-4 py-3 border-b ${dark ? accentClasses.headerDark : accentClasses.headerLight}`}>
        <div className={`text-[13px] font-bold leading-tight ${dark ? accentClasses.textDark : accentClasses.textLight}`}>
          {group.title}
        </div>
        {group.description && (
          <p className={`text-[11px] leading-snug mt-1 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            {group.description}
          </p>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        {children}
      </div>
    </div>
  );
}

function TemplateRow({
  dark, item, accent, onClick,
}: {
  dark: boolean;
  item: TemplateListItem;
  accent: GroupAccent;
  onClick: () => void;
}) {
  const accentClasses = ACCENT_CLASSES[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left p-3 rounded-lg border transition-all ${
        dark
          ? 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.16]'
          : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className={`text-[12.5px] font-bold leading-snug ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
          {item.title}
        </div>
        {item.isCustomized && (
          <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            dark ? accentClasses.pillDark : accentClasses.pillLight
          }`}>
            <span className="w-1 h-1 rounded-full bg-current" /> Змінено
          </span>
        )}
      </div>
      <p className={`text-[10.5px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        {item.when}
      </p>
      <div className={`mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
        dark ? accentClasses.textDark : accentClasses.textLight
      }`}>
        Відкрити <HiOutlineChevronRight className="text-[10px]" />
      </div>
    </button>
  );
}

// ─────────────────────── EDITOR VIEW ───────────────────────

function TemplateEditor({
  theme,
  item,
  config,
  onSaved,
}: {
  theme: Theme;
  item: TemplateFullItem;
  config: EmailTemplatesModalConfig;
  onSaved: (updated: { subject: string; bodyHtml: string; bodyInnerHtml: string; isCustomized: boolean; updatedAt: string | null; updatedBy: string | null }) => void;
}) {
  const dark = theme === 'dark';
  const [subject, setSubject] = useState(item.subject);
  const [bodyInnerHtml, setBodyInnerHtml] = useState(item.bodyInnerHtml);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(true);
  const [previewHeight, setPreviewHeight] = useState<number>(420);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const dirty = subject !== item.subject || bodyInnerHtml !== item.bodyInnerHtml;
  const accent = config.groupAccents[item.group] ?? 'slate';
  const accentClasses = ACCENT_CLASSES[accent];

  // Детектор видалення плейсхолдерів. Тримаємо ref на попередній набір використаних полів.
  // Коли менеджер забирає поле з тексту — показуємо warning з кнопкою «Повернути».
  const prevUsedRef = useRef<Set<string>>(extractUsedPlaceholders(item.bodyInnerHtml));
  const [removedPlaceholder, setRemovedPlaceholder] = useState<string | null>(null);
  // Поля, які менеджер свідомо вирішив залишити прибраними — більше не мордуємо warning-ом.
  const [dismissedRemovals, setDismissedRemovals] = useState<Set<string>>(new Set());

  useEffect(() => {
    const current = extractUsedPlaceholders(bodyInnerHtml);
    const prev = prevUsedRef.current;
    // Які поля БУЛИ і ЗАРАЗ зникли — і це поле взагалі очікується для цього шаблону.
    for (const ph of prev) {
      if (!current.has(ph) && item.placeholders.includes(ph) && !dismissedRemovals.has(ph)) {
        setRemovedPlaceholder(ph);
        break;
      }
    }
    // Якщо менеджер сам повернув поле — забути попередження.
    if (removedPlaceholder && current.has(removedPlaceholder)) {
      setRemovedPlaceholder(null);
    }
    prevUsedRef.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyInnerHtml]);

  const restorePlaceholder = (name: string) => {
    // Просте рішення — додаємо в кінець `{name}`. Менеджер потім перетягне у потрібне місце.
    const token = `{${name}}`;
    if (!bodyInnerHtml.includes(token)) {
      setBodyInnerHtml((b) => `${b}<p>${token}</p>`);
    }
    setRemovedPlaceholder(null);
  };

  const dismissPlaceholderRemoval = (name: string) => {
    setDismissedRemovals((s) => {
      const n = new Set(s);
      n.add(name);
      return n;
    });
    setRemovedPlaceholder(null);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPreviewLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${config.apiBase}/${encodeURIComponent(item.key)}/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, bodyInnerHtml }),
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
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [item.key, subject, bodyInnerHtml, config.apiBase]);

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`${config.apiBase}/${encodeURIComponent(item.key)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, bodyInnerHtml }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved({
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyInnerHtml: data.bodyInnerHtml,
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
      const res = await fetch(`${config.apiBase}/${encodeURIComponent(item.key)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSubject(data.subject);
      setBodyInnerHtml(data.bodyInnerHtml);
      onSaved({
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyInnerHtml: data.bodyInnerHtml,
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
    () => item.placeholders.map((p) => `{${p}}`).join(' · '),
    [item.placeholders],
  );

  const inputBase = dark
    ? 'bg-zinc-950 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/40 focus:ring-amber-400/20'
    : 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400 focus:border-amber-500/60 focus:ring-amber-500/20';

  return (
    <div className="space-y-4">
      {/* Інфо-картка про шаблон */}
      <div className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white'}`}>
        <div className={`px-4 py-3 flex items-start gap-3 ${dark ? accentClasses.headerDark : accentClasses.headerLight}`}>
          <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
            dark ? accentClasses.iconDark : accentClasses.iconLight
          }`}>
            <HiOutlineInformationCircle className="text-[15px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[12px] font-bold leading-tight mb-1 ${dark ? accentClasses.textDark : accentClasses.textLight}`}>
              Коли надсилається
            </div>
            <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
              {item.when}
            </p>
            {item.isCustomized && item.updatedAt && (
              <p className={`mt-2 text-[10.5px] inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded ${
                dark ? 'bg-white/[0.06] text-slate-400' : 'bg-stone-100 text-stone-600'
              }`}>
                <HiOutlinePencilSquare className="text-[11px]" />
                Останнє редагування: {new Date(item.updatedAt).toLocaleString('uk-UA')}
                {item.updatedBy ? ` · ${item.updatedBy}` : ''}
              </p>
            )}
          </div>
        </div>
        {item.placeholders.length > 0 && (
          <div className={`px-4 py-2.5 border-t text-[11px] ${
            dark ? 'border-white/[0.06] bg-white/[0.02] text-slate-400' : 'border-stone-200 bg-stone-50 text-stone-600'
          }`}>
            <span className={`font-semibold uppercase tracking-wider text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Доступні поля:
            </span>{' '}
            <code className={`font-mono ${dark ? 'text-amber-300' : 'text-amber-800'}`}>{placeholdersHelp}</code>
            <span className={`ml-2 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              — вставляйте через кнопки <code className="font-mono">{'{…}'}</code> у тулбарі редактора
            </span>
          </div>
        )}
      </div>

      {/* SECTION 1: Тема */}
      <SectionCard theme={theme} num={1} title="Тема листа" hint="Те, що отримувач бачить у списку папки «Вхідні»">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={300}
          placeholder="Наприклад: Дякуємо за оплату — Річна програма"
          className={`w-full px-3.5 py-2.5 rounded-lg border text-[13.5px] font-medium outline-none focus:ring-2 transition-colors ${inputBase}`}
        />
      </SectionCard>

      {/* SECTION 2: Прев'ю */}
      <SectionCard
        theme={theme}
        num={2}
        title="Прев'ю — як побачить отримувач"
        hint="Підставлено тестові дані для прикладу. Оновлюється автоматично при редагуванні"
        icon={<HiOutlineEye />}
      >
        {previewError && (
          <div className={`mb-2 p-2 rounded text-[11px] ${dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-800'}`}>
            {previewError}
          </div>
        )}
        <EmailPreviewFrame dark={dark} subject={subject} loading={previewLoading} loadingHeight={previewHeight}>
          <iframe
            ref={iframeRef}
            key={item.key}
            srcDoc={previewHtml}
            title={`Прев'ю: ${item.title}`}
            scrolling="no"
            onLoad={() => {
              const ifr = iframeRef.current;
              if (!ifr) return;
              try {
                const doc = ifr.contentDocument;
                if (!doc) return;
                const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
                if (h > 0) setPreviewHeight(h + 4);
              } catch {
                /* cross-origin would throw — srcDoc same-origin, тут безпечно */
              }
            }}
            style={{ height: `${previewHeight}px` }}
            className={`w-full bg-white border-0 block transition-opacity duration-200 ${previewLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        </EmailPreviewFrame>
      </SectionCard>

      {/* SECTION 3: Текст */}
      <SectionCard
        theme={theme}
        num={3}
        title="Редактор листа"
        hint="Жирний / курсив / списки / посилання · вставка полів"
        icon={<HiOutlinePencilSquare />}
      >
        {removedPlaceholder && (
          <RemovedPlaceholderAlert
            dark={dark}
            placeholder={removedPlaceholder}
            descriptions={config.placeholderDescriptions}
            onRestore={() => restorePlaceholder(removedPlaceholder)}
            onDismiss={() => dismissPlaceholderRemoval(removedPlaceholder)}
          />
        )}
        <WysiwygEmailEditor
          value={bodyInnerHtml}
          onChange={setBodyInnerHtml}
          theme={theme}
          placeholders={item.placeholders}
        />
        {item.placeholders.length > 0 && (
          <div className="mt-3">
            <PlaceholderLegend
              dark={dark}
              placeholders={item.placeholders}
              sampleData={item.sampleData}
              descriptions={config.placeholderDescriptions}
            />
          </div>
        )}
        <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-lg text-[10.5px] leading-snug ${
          dark ? 'bg-white/[0.03] text-slate-400 border border-white/[0.06]' : 'bg-stone-100 text-stone-600 border border-stone-200/70'
        }`}>
          <HiOutlineInformationCircle className="text-[13px] shrink-0 mt-0.5 opacity-70" />
          <span>
            Підпис «<strong>— Команда UIMP</strong>» і контактний email <code className="font-mono">edu@uimp.com.ua</code> додаються автоматично — їх редагувати не треба.
          </span>
        </div>
      </SectionCard>

      {/* STICKY FOOTER — sticky-bottom у скролл-контейнері модалки, з негативними маргінами щоб
          охопити всю ширину тіла модалки і виглядати приклеєним до її нижнього краю. */}
      <div className={`sticky bottom-0 -mx-6 -mb-5 mt-5 z-10 flex items-center justify-between gap-3 px-6 py-3 border-t backdrop-blur ${
        dark ? 'bg-zinc-950/95 border-white/10' : 'bg-stone-100/95 border-stone-200'
      }`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {dirty && !saving && !saveOk && !saveError && (
            <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Є незбережені зміни
            </span>
          )}
          {saveOk && (
            <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              <HiOutlineCheck className="text-[13px]" /> {saveOk}
            </span>
          )}
          {saveError && (
            <span className={`inline-flex items-center gap-1.5 text-[11.5px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
              <HiOutlineXMark className="text-[13px]" /> {saveError}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.isCustomized && (
            <button
              type="button"
              onClick={onReset}
              disabled={resetting || saving}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-50 ${
                dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <HiOutlineArrowUturnLeft className="text-[13px]" />
              {resetting ? 'Скидаю…' : 'Скинути до дефолту'}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dark
                ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_18px_rgba(212,168,67,0.20)]'
                : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
            }`}
          >
            <HiOutlineCheck className="text-[14px]" />
            {saving ? 'Зберігаю…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── PRIMITIVES ───────────────────────

/// Пронумерована секція-картка з кружком-номером і заголовком — патерн з LaunchProgramModal.
function SectionCard({
  theme, num, title, hint, icon, children,
}: {
  theme: Theme;
  num: number;
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <section className={`rounded-xl border ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white shadow-sm'}`}>
      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${
        dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200/70 bg-stone-50/60'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
            dark ? 'bg-amber-400/15 border-amber-400/30 text-amber-200' : 'bg-amber-100 border-amber-300/60 text-amber-900'
          }`}>
            {num}
          </div>
          <h4 className={`text-[13.5px] font-bold flex items-center gap-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            {icon && <span className={`text-[15px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{icon}</span>}
            {title}
          </h4>
        </div>
        {hint && (
          <p className={`text-[10.5px] hidden sm:block text-right max-w-[55%] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {hint}
          </p>
        )}
      </div>
      <div className="px-4 py-3.5">
        {children}
      </div>
    </section>
  );
}


/// Skeleton-плейсхолдер під час завантаження повного шаблону через GET /:key.
/// Дублює форму майбутнього editor-у, щоб layout не стрибав коли дані прийдуть.
function TemplateEditorSkeleton({ theme }: { theme: Theme }) {
  const dark = theme === 'dark';
  const block = (h: string, w: string, delay = 0) => (
    <div
      className={`rounded animate-pulse ${dark ? 'bg-white/[0.06]' : 'bg-stone-200/80'}`}
      style={{ height: h, width: w, animationDelay: `${delay}ms` }}
    />
  );
  const card = (children: React.ReactNode) => (
    <div className={`rounded-xl border ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white shadow-sm'}`}>
      {children}
    </div>
  );
  return (
    <div className="space-y-4">
      {card(
        <div className="px-4 py-3.5 space-y-2">
          {block('14px', '40%', 0)}
          {block('11px', '85%', 60)}
        </div>,
      )}
      {card(
        <>
          <div className={`px-4 py-3 border-b flex items-center gap-2.5 ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200/70 bg-stone-50/60'}`}>
            <div className={`w-6 h-6 rounded-full ${dark ? 'bg-amber-400/20' : 'bg-amber-100'}`} />
            {block('14px', '120px', 0)}
          </div>
          <div className="px-4 py-3.5">{block('40px', '100%', 100)}</div>
        </>,
      )}
      {card(
        <>
          <div className={`px-4 py-3 border-b flex items-center gap-2.5 ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200/70 bg-stone-50/60'}`}>
            <div className={`w-6 h-6 rounded-full ${dark ? 'bg-amber-400/20' : 'bg-amber-100'}`} />
            {block('14px', '180px', 0)}
          </div>
          <div className="px-4 py-3.5">{block('320px', '100%', 200)}</div>
        </>,
      )}
      <div className={`flex items-center justify-center gap-2 py-2 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Завантажую шаблон…
      </div>
    </div>
  );
}

// ─────────────────────── ACCENT CLASSES ───────────────────────

const ACCENT_CLASSES: Record<GroupAccent, {
  headerLight: string; headerDark: string;
  textLight: string; textDark: string;
  pillLight: string; pillDark: string;
  iconLight: string; iconDark: string;
}> = {
  amber: {
    headerLight: 'bg-amber-50/70 border-amber-200/40',
    headerDark: 'bg-amber-500/[0.08]',
    textLight: 'text-amber-900',
    textDark: 'text-amber-200',
    pillLight: 'bg-amber-100 text-amber-800',
    pillDark: 'bg-amber-500/15 text-amber-300',
    iconLight: 'bg-white/80 text-amber-900',
    iconDark: 'bg-amber-400/20 text-amber-200',
  },
  indigo: {
    headerLight: 'bg-indigo-50/70 border-indigo-200/40',
    headerDark: 'bg-indigo-500/[0.08]',
    textLight: 'text-indigo-900',
    textDark: 'text-indigo-200',
    pillLight: 'bg-indigo-100 text-indigo-800',
    pillDark: 'bg-indigo-500/15 text-indigo-300',
    iconLight: 'bg-white/80 text-indigo-900',
    iconDark: 'bg-indigo-400/20 text-indigo-200',
  },
  rose: {
    headerLight: 'bg-rose-50/70 border-rose-200/40',
    headerDark: 'bg-rose-500/[0.08]',
    textLight: 'text-rose-900',
    textDark: 'text-rose-200',
    pillLight: 'bg-rose-100 text-rose-800',
    pillDark: 'bg-rose-500/15 text-rose-300',
    iconLight: 'bg-white/80 text-rose-900',
    iconDark: 'bg-rose-400/20 text-rose-200',
  },
  slate: {
    headerLight: 'bg-stone-100 border-stone-200',
    headerDark: 'bg-white/[0.04]',
    textLight: 'text-stone-800',
    textDark: 'text-slate-200',
    pillLight: 'bg-stone-200 text-stone-700',
    pillDark: 'bg-white/[0.06] text-slate-300',
    iconLight: 'bg-white/80 text-stone-700',
    iconDark: 'bg-white/[0.06] text-slate-300',
  },
  sky: {
    headerLight: 'bg-sky-50/70 border-sky-200/40',
    headerDark: 'bg-sky-500/[0.08]',
    textLight: 'text-sky-900',
    textDark: 'text-sky-200',
    pillLight: 'bg-sky-100 text-sky-800',
    pillDark: 'bg-sky-500/15 text-sky-300',
    iconLight: 'bg-white/80 text-sky-900',
    iconDark: 'bg-sky-400/20 text-sky-200',
  },
};
