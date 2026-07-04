'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaExpand,
  FaTimes,
  FaCalendar,
} from 'react-icons/fa';
import { useAdminTheme } from '../_components/adminTheme';
import { AdminShell, AdminPanel } from '../_components/AdminShell';
import InlineDatePicker, { formatDateChip } from '../_components/InlineDatePicker';
import {
  NEWS_BLOCK_CSS,
  PREVIEW_CARD_HEIGHT,
  PREVIEW_CARD_WIDTH,
  parseBlocks,
} from '@/lib/news/render';
import PreviewCardScale from '@/lib/news/PreviewCardScale';
import TemplatePreviewCard from '@/lib/news/templates/TemplatePreviewCard';
import TemplateBlocksPreview from '@/lib/news/templates/TemplateBlocksPreview';
import { parseTemplateData, type TemplateKind } from '@/lib/news/templates/types';
import { hasUnfilledPlaceholders } from '@/lib/news/placeholderCheck';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  /** JSON-блоки превʼю-картки (білдер `/[id]/preview`, канвас 360×400).
   *  Рендериться 1-в-1 у адмін-списку «Превʼю Новин» через AbsoluteBlockRender —
   *  тим самим pipeline-ом, що й публічний `/news`. */
  previewContent: string | null;
  pageBgColor: string | null;
  category: string;
  published: boolean;
  isTemplate?: boolean;
  /** FK на blueprint, з якого створено цей запис. Дефолтні blueprint-и мають null;
   *  кастомні blueprint-и менеджера мають id дефолтного; звичайні новини мають
   *  id того blueprint-у (дефолтного або кастомного), з якого створено. */
  parentTemplateId?: string | null;
  /** Якщо задано — render-имо через шаблонний компонент (lib/news/templates).
   *  В цьому разі `previewContent` ігнорується, превʼю автогенерується. */
  templateKind?: 'ARTICLE' | 'EVENT' | null;
  templateData?: string | null;
  /** Новий block-based формат шаблонів (Session 3+). Якщо є — рендеримо превʼю
   *  через AbsoluteBlockRender 1-в-1 з TemplateConstructor; інакше fallback
   *  на legacy TemplatePreviewCard з templateData. */
  templateBlocks?: string | null;
  templateCanvas?: string | null;
  suspendedAt: string | null;
  resumeAt: string | null;
  createdAt: string;
  author?: { name: string | null };
}


// Thumb-превʼю сторінки /news через iframe з /uk/news/preview?source=live|next.
// CSS-scale (transform) масштабує "натуральний" 1280×720 iframe до фактичної
// ширини контейнера, зберігаючи aspect-ratio. ResizeObserver — щоб scale
// підлаштовувався при ресайзі вікна / sidebar-у.
function PagePreviewIframeThumb({
  source,
  title,
  dark,
  variant,
}: {
  source: 'live' | 'next';
  title: string;
  dark: boolean;
  variant: 'emerald' | 'amber';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const NATURAL_W = 1280;
  const NATURAL_H = 720;
  const [scale, setScale] = useState(0.25);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScale(w / NATURAL_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const borderColor = variant === 'emerald'
    ? (dark ? 'rgba(16,185,129,0.20)' : 'rgba(5,150,105,0.25)')
    : (dark ? 'rgba(245,158,11,0.20)' : 'rgba(217,119,6,0.25)');

  return (
    <div
      ref={ref}
      className="relative w-full block overflow-hidden border-b"
      style={{
        aspectRatio: `${NATURAL_W} / ${NATURAL_H}`,
        background: dark ? '#0F1414' : '#FFFFFF',
        borderBottomColor: borderColor,
      }}
    >
      <iframe
        src={`/uk/news/preview?source=${source}`}
        title={title}
        loading="lazy"
        style={{
          width: `${NATURAL_W}px`,
          height: `${NATURAL_H}px`,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// Масштабує дитячий канвас baseWidth×baseHeight у фіксований батьківський бокс,
// зберігаючи aspect: scale = min(W/baseW, H/baseH), центрується. Використовується
// для preview новинного тайла, що сидить у row-боксі фіксованих розмірів — щоб
// preview не клипався і не тягнувся непропорційно при будь-якій кількості тайлів.
function FitInBox({
  baseWidth,
  baseHeight,
  children,
}: {
  baseWidth: number;
  baseHeight: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      setScale(Math.min(r.width / baseWidth, r.height / baseHeight));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth, baseHeight]);
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Підбирає cols×rows для N тайлів так, щоб вони компактно лягали в бокс
// без надмірно вузьких смуг. Емпірика: до 2 — в один ряд, 3-4 — 2×2,
// 5-6 — 3×2, 7-9 — 3×3, 10-12 — 4×3, далі — 4 колонки і ріст рядків.
function tileGridFor(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

export default function AdminNewsPage() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';
  const router = useRouter();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [templates, setTemplates] = useState<NewsItem[]>([]);
  // Створені з blueprint-ів — рендеряться у тій же секції «Шаблони» під blueprint-ами.
  const [templateNews, setTemplateNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // «Створити новину» — клік по «+» тайлу справа від шаблону створює News
  // (asBlueprint=false) на основі того шаблону і веде в редактор.
  const [creatingFromTpl, setCreatingFromTpl] = useState(false);

  // Стан публікації сторінки /news (NewsPage.published) + локальний toggle.
  const [pagePublished, setPagePublished] = useState<boolean | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);
  // Превʼю сторінки /news — або поточна live-версія, або staged "наступна",
  // або конкретний архівний snapshot. null → закрито.
  const [pagePreviewSource, setPagePreviewSource] = useState<
    null | { kind: "live" } | { kind: "next" } | { kind: "archive"; id: string; archivedAt: string }
  >(null);
  const pagePreviewOpen = pagePreviewSource !== null;
  const setPagePreviewOpen = (open: boolean) => setPagePreviewSource(open ? { kind: "live" } : null);

  // Превʼю окремої новини — або превʼю-картки в контексті /news, або
  // повної сторінки статті /news/{slug}. Iframe-режим — точна копія
  // публічного рендера (без drift).
  const [itemPreview, setItemPreview] = useState<
    | { kind: 'card' | 'article'; slug: string; title: string }
    | null
  >(null);

  // Який confirm-діалог відкритий для staged-секції (`null` — закрито).
  // Оголошуємо до Esc-handler-а нижче, інакше TDZ.
  const [stagedConfirm, setStagedConfirm] = useState<null | 'publishNow' | 'discard'>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<null | {
    id: string;
    action: 'load' | 'restore';
    dateLabel: string;
  }>(null);
  const [archiveConfirmPending, setArchiveConfirmPending] = useState(false);

  // Esc + body-scroll lock для будь-якої з модалок.
  const anyModalOpen = pagePreviewOpen || itemPreview !== null || stagedConfirm !== null || archiveConfirm !== null;
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (itemPreview) setItemPreview(null);
      else if (stagedConfirm) setStagedConfirm(null);
      else if (archiveConfirm) setArchiveConfirm(null);
      else if (pagePreviewOpen) setPagePreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [anyModalOpen, pagePreviewOpen, itemPreview, stagedConfirm, archiveConfirm]);

  // Staged ("Наступна сторінка") стан — для countdown і дій у адмінці.
  // `publishOn` — Київ-календарна дата (YYYY-MM-DD); час фіксований 06:00 Київ.
  const [staged, setStaged] = useState<{ hasStaged: boolean; publishOn: string | null; nextUpdatedAt: string | null } | null>(null);
  const [stagedActionPending, setStagedActionPending] = useState<null | 'publishNow' | 'discard'>(null);
  // Архів замінених live-сторінок. Заповнюється з GET /api/admin/news/page-content/archive.
  // null до першого fetch-у; [] якщо архів порожній.
  const [archive, setArchive] = useState<Array<{ id: string; archivedAt: string; wasPublished: boolean; contentLength: number }> | null>(null);
  const refreshArchive = React.useCallback(() => {
    fetch('/api/admin/news/page-content/archive')
      .then(r => r.ok ? r.json() : [])
      .then((d: unknown) => setArchive(Array.isArray(d) ? d as typeof archive : []))
      .catch(() => setArchive([]));
  }, []);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [scheduleInput, setScheduleInput] = useState<string>(''); // YYYY-MM-DD (committed)
  // Локальний draft вибраної дати у popover-і — комітиться у scheduleInput
  // тільки після кліку «Підтвердити». Без цього draft-у вибір дати миттєво
  // зберігав би і закривав picker — менеджеру здається що нічого не сталось.
  const [scheduleDraft, setScheduleDraft] = useState<string>('');
  const [scheduleSaveState, setScheduleSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const scheduleDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // При відкритті picker-а — синхронізуємо draft з commited значенням.
  useEffect(() => {
    if (datePickerOpen) setScheduleDraft(scheduleInput);
  }, [datePickerOpen, scheduleInput]);

  // Date-picker popover рендериться через portal до body — щоб не клипатись
  // overflow:hidden батьківської staged-панелі. Координати рахуємо з рефу
  // trigger-а; при resize/scroll переоцінюємо.
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const [datePickerPos, setDatePickerPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!datePickerOpen) { setDatePickerPos(null); return; }
    const recalc = () => {
      const el = dateTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Якщо знизу мало місця (popover ~390px з кнопкою підтвердження + підказкою)
      // — відкриваємо догори над кнопкою. Аналогічна логіка як у select-flip патернах.
      const POPOVER_H = 390;
      const GAP = 6;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const flipUp = spaceBelow < POPOVER_H && spaceAbove > spaceBelow;
      const top = flipUp
        ? Math.max(8, r.top - POPOVER_H - GAP)
        : r.bottom + GAP;
      setDatePickerPos({ top, left: r.left });
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [datePickerOpen]);
  // Закриваємо popover при click outside.
  useEffect(() => {
    if (!datePickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dateTriggerRef.current?.contains(t)) return;
      const pop = document.getElementById('news-date-popover');
      if (pop?.contains(t)) return;
      setDatePickerOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [datePickerOpen]);

  // Live tick для countdown — оновлюємо раз на годину (днева точність).
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick(n => n + 1), 3_600_000);
    return () => clearInterval(t);
  }, []);

  // Завтрашня дата в Київ-зоні (мінімум для пікера). Розраховуємо клієнтсько
  // через Intl — без залежності від рантайм-таймзони браузера.
  const minDate = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todayKyiv = fmt.format(new Date());
    const [y, m, d] = todayKyiv.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    return fmt.format(tomorrow);
  }, []);

  const refreshStaged = () => {
    fetch('/api/admin/news/page-content/next')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.hasStaged) {
          setStaged({ hasStaged: true, publishOn: d.publishOn, nextUpdatedAt: d.nextUpdatedAt });
          setScheduleInput(d.publishOn || '');
        } else {
          setStaged({ hasStaged: false, publishOn: null, nextUpdatedAt: null });
          setScheduleInput('');
        }
      })
      .catch(() => setStaged({ hasStaged: false, publishOn: null, nextUpdatedAt: null }));
  };

  // Auto-save scheduleInput з debounce 700мс. Тригериться лише при реальній
  // зміні (не на перший рендер після завантаження staged).
  const lastSavedScheduleRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!staged?.hasStaged) return;
    const target = scheduleInput || null;
    const current = staged.publishOn;
    if (target === current) return;
    if (lastSavedScheduleRef.current === target) return;
    if (scheduleDebounceRef.current) clearTimeout(scheduleDebounceRef.current);
    scheduleDebounceRef.current = setTimeout(async () => {
      setScheduleSaveState('saving');
      try {
        const res = await fetch('/api/admin/news/page-content/next', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publishOn: target }),
        });
        if (res.ok) {
          lastSavedScheduleRef.current = target;
          setStaged(s => s ? { ...s, publishOn: target } : s);
          setScheduleSaveState('saved');
          setTimeout(() => setScheduleSaveState('idle'), 1500);
        } else {
          const body = await res.json().catch(() => ({}));
          setToast({ message: body?.error || 'Не вдалось зберегти дату', type: 'error' });
          setScheduleSaveState('idle');
        }
      } catch {
        setToast({ message: 'Помилка мережі при збереженні дати', type: 'error' });
        setScheduleSaveState('idle');
      }
    }, 700);
    return () => { if (scheduleDebounceRef.current) clearTimeout(scheduleDebounceRef.current); };
  }, [scheduleInput, staged]);

  useEffect(() => {
    fetch('/api/admin/news/page-content')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPagePublished(!!d.published); else setPagePublished(false); })
      .catch(() => setPagePublished(false));
    refreshStaged();
    refreshArchive();
  }, [refreshArchive]);

  const publishStagedNow = async () => {
    setStagedConfirm(null);
    setStagedActionPending('publishNow');
    try {
      const res = await fetch('/api/admin/news/page-content/next', { method: 'POST' });
      if (res.ok) {
        // Staged консумовано → локальну editor-чернетку теж тру (див. коментар у discardStaged).
        try { localStorage.removeItem('uimp_draft_page___news_page_next__'); } catch { /* ignore */ }
        setToast({ message: 'Опубліковано — наступна сторінка стала live', type: 'success' });
        refreshStaged();
        refreshArchive();
      } else {
        const body = await res.json().catch(() => ({}));
        setToast({ message: body?.error || 'Не вдалось опублікувати', type: 'error' });
      }
    } catch {
      setToast({ message: 'Помилка мережі', type: 'error' });
    } finally {
      setStagedActionPending(null);
    }
  };

  const discardStaged = async () => {
    setStagedConfirm(null);
    setStagedActionPending('discard');
    try {
      const res = await fetch('/api/admin/news/page-content/next', { method: 'DELETE' });
      if (res.ok) {
        // Бекенд очистив staged, але NewsEditor у білдері /page-builder/next
        // має ще й локальну чернетку у localStorage (`uimp_draft_page___news_page_next__`)
        // — без її видалення «Створити наступну» відкриється з тими ж блоками,
        // що й до Очищення (editor-draft restore-иться поверх порожнього API-payload).
        try { localStorage.removeItem('uimp_draft_page___news_page_next__'); } catch { /* ignore */ }
        setToast({ message: 'Чернетку видалено', type: 'success' });
        refreshStaged();
      } else {
        setToast({ message: 'Не вдалось видалити', type: 'error' });
      }
    } catch {
      setToast({ message: 'Помилка мережі', type: 'error' });
    } finally {
      setStagedActionPending(null);
    }
  };

  const togglePagePublish = async () => {
    if (pagePublished === null || togglingPublish) return;
    const next = !pagePublished;
    setTogglingPublish(true);
    setPagePublished(next); // optimistic
    try {
      const res = await fetch('/api/admin/news/page-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) {
        setPagePublished(!next);
        const body = await res.json().catch(() => ({}));
        setToast({ message: body?.error || 'Не вдалося змінити статус сторінки', type: 'error' });
      } else {
        setToast({ message: next ? 'Сторінку /news активовано' : 'Сторінку /news деактивовано', type: 'success' });
      }
    } catch {
      setPagePublished(!next);
      setToast({ message: 'Помилка запиту', type: 'error' });
    } finally {
      setTogglingPublish(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      try {
        // Паралельно: 3 списки — blueprints + template-news (створені з шаблонів)
        // + free-form news. Структура UI: «Шаблони» = blueprints+template-news,
        // «Новини» = free-form. Розділення на API-рівні щоб не міксувати в клієнті.
        const [rNews, rTpl, rTplNews] = await Promise.all([
          fetch('/api/admin/news'),
          fetch('/api/admin/news?type=templates'),
          fetch('/api/admin/news?type=template-news'),
        ]);
        if (!rNews.ok) throw new Error('Не вдалося завантажити новини');
        const dNews = await rNews.json();
        setNews(Array.isArray(dNews) ? dNews : []);
        if (rTpl.ok) {
          const dTpl = await rTpl.json();
          setTemplates(Array.isArray(dTpl) ? dTpl : []);
        }
        if (rTplNews.ok) {
          const dTplNews = await rTplNews.json();
          setTemplateNews(Array.isArray(dTplNews) ? dTplNews : []);
        }
      } catch (err) {
        setToast({
          message: err instanceof Error ? err.message : 'Помилка завантаження',
          type: 'error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const performDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    // Optimistic: миттєво прибираємо item з усіх 3 списків (news, templateNews,
    // templates — кастомні blueprint-и) і закриваємо модалку. На fail повертаємо
    // state назад (rollback) + error-toast.
    const prevNews = news;
    const prevTpl = templateNews;
    const prevTemplates = templates;
    setNews(prev => prev.filter(n => n.id !== id));
    setTemplateNews(prev => prev.filter(n => n.id !== id));
    setTemplates(prev => prev.filter(n => n.id !== id));
    setDeleteTarget(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setNews(prevNews);
        setTemplateNews(prevTpl);
        setTemplates(prevTemplates);
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося видалити', type: 'error' });
        return;
      }
      setToast({ message: 'Видалено', type: 'success' });
    } catch {
      setNews(prevNews);
      setTemplateNews(prevTpl);
      setTemplates(prevTemplates);
      setToast({ message: 'Помилка запиту', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = news;
  const publishedCount = news.filter(n => n.published).length;

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Новини"
      title="Новини"
      subtitle={`Всього: ${news.length} · Опубліковано: ${publishedCount}`}
      maxWidth="max-w-[1640px]"
    >
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-sm ${
            toast.type === 'success'
              ? dark
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200'
                : 'bg-emerald-100/90 border-emerald-500/30 text-emerald-800'
              : dark
                ? 'bg-rose-500/15 border-rose-400/30 text-rose-200'
                : 'bg-rose-100/90 border-rose-500/30 text-rose-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 2-col layout: ліворуч — операції зі сторінкою /news 1/4 (Поточна+Наступна
          вертикально, опційно Архів знизу), праворуч — Шаблони 3/4. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:items-start">
        {/* ╭─ БЛОК: операції зі сторінкою /news (вертикально, 1/4) ──────╮ */}
        <div className="min-w-0 lg:col-span-1">
          <div className={`flex items-center gap-2 mb-4 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase">Сторінка /news</span>
            <span className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-stone-300/60'}`} />
          </div>

        <div className="flex flex-col gap-4">
          {/* ─── Колонка 1: ПОТОЧНА (live) ─── */}
          <div className="min-w-0">
          {/* ─── Підсекція 1: ПОТОЧНА (live) ─── */}
          <div className={`flex items-center gap-2 mb-2 ${dark ? 'text-emerald-300/90' : 'text-emerald-700'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              pagePublished ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-stone-400'
            }`} />
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase">Поточна сторінка Новин</span>
            <span className={`text-[10px] font-normal opacity-70 normal-case tracking-normal`}>
              {pagePublished === null ? '' : pagePublished ? '· live' : '· неактивна'}
            </span>
          </div>

          {/* Панель "Поточна сторінка" — стейт-aware дизайн з градієнтним
              акцентом зверху (emerald коли live, amber коли прихована). */}
          <div
            className={`rounded-xl border backdrop-blur-sm transition-all overflow-hidden shadow-sm ${
              pagePublished
                ? dark
                  ? 'bg-gradient-to-br from-emerald-500/[0.06] to-white/[0.02] border-emerald-300/20'
                  : 'bg-gradient-to-br from-emerald-50/70 to-white/60 border-emerald-500/25'
                : dark
                  ? 'bg-gradient-to-br from-amber-500/[0.05] to-white/[0.02] border-amber-300/20'
                  : 'bg-gradient-to-br from-amber-50/60 to-white/60 border-amber-500/25'
            }`}
          >
            {/* Тонка градієнтна смужка зверху — кольоровий "статусний прапорець" блока */}
            <div className={`h-0.5 ${
              pagePublished
                ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500/70 to-emerald-500/0'
                : 'bg-gradient-to-r from-amber-500/0 via-amber-500/70 to-amber-500/0'
            }`} />

            {/* Thumb-превʼю поточного контенту /news — щоб менеджер відразу бачив
                що показано відвідувачам. Клік → fullscreen-превʼю. */}
            <PagePreviewIframeThumb
              source="live"
              title="Превʼю поточної сторінки /news"
              dark={dark}
              variant={pagePublished ? 'emerald' : 'amber'}
            />

            {/* Header — інфо про стан + icon-only Прев'ю (👁). Симетрично з НАСТУПНА. */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.08em] flex-shrink-0 ${
                  pagePublished
                    ? dark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-100 text-emerald-800 border border-emerald-500/20'
                    : dark ? 'bg-amber-500/15 text-amber-300 border border-amber-400/20' : 'bg-amber-100 text-amber-800 border border-amber-500/25'
                }`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    pagePublished ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-amber-500'
                  }`} />
                  <span>{pagePublished === null ? '...' : pagePublished ? 'На сайті' : 'Прихована'}</span>
                </div>
                <span className={`text-[11px] truncate ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  {pagePublished === null
                    ? ''
                    : pagePublished
                      ? 'видима відвідувачам'
                      : '/news показує empty state'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPagePreviewOpen(true)}
                title="Превʼю поточної сторінки"
                aria-label="Превʼю"
                className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.10] text-slate-300 hover:bg-white/[0.10] hover:text-slate-100'
                    : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
                }`}
              >
                <span aria-hidden className="text-[13px]">👁</span>
              </button>
            </div>

            {/* Actions row — 2 рівноважні pill-кнопки. */}
            <div className={`px-3 py-2 border-t flex items-center gap-2 ${
              dark ? 'border-white/[0.04] bg-white/[0.015]' : 'border-stone-200/50 bg-white/40'
            }`}>
              <Link
                href="/dashboard/admin/news/page-builder"
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-full text-[11.5px] font-medium border transition-colors whitespace-nowrap ${
                  dark
                    ? 'bg-transparent border-amber-300/40 text-amber-200 hover:border-amber-300/70 hover:bg-amber-300/10'
                    : 'bg-white/60 border-amber-700/40 text-amber-800 hover:border-amber-700/70 hover:bg-amber-50'
                }`}
                title="Редагувати live-сторінку /news"
              >
                <FaPlus className="text-[10px]" />
                <span>Редагувати</span>
              </Link>
              <button
                type="button"
                onClick={togglePagePublish}
                disabled={pagePublished === null || togglingPublish}
                title={pagePublished ? 'Прибрати сторінку з сайту' : 'Показати сторінку на сайті'}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-full text-[11.5px] font-medium border transition-colors whitespace-nowrap disabled:opacity-50 ${
                  pagePublished
                    ? dark
                      ? 'bg-rose-500/10 text-rose-200 border-rose-400/30 hover:bg-rose-500/20'
                      : 'bg-rose-100/60 text-rose-800 border-rose-300/60 hover:bg-rose-100'
                    : dark
                      ? 'bg-emerald-400/90 text-stone-900 border-transparent hover:bg-emerald-300'
                      : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700'
                }`}
              >
                {togglingPublish ? '...' : pagePublished ? 'Деактивувати' : 'Активувати'}
              </button>
            </div>
          </div>
          </div>
          {/* ╰─ кінець колонки 1 ─╯ */}

          {/* ─── Колонка 2: НАСТУПНА (staged) ─── */}
          <div className="min-w-0">
      {/* ─── Підсекція 2: НАСТУПНА (staged) ─── */}
      {(() => {
        const hasStaged = !!staged?.hasStaged;
        const publishOn = staged?.publishOn || null;

        // Дневна різниця в Київ-зоні. publishOn зберігається як YYYY-MM-DD,
        // тому порівнюємо саме календарні дати, без розрахунків часу.
        let countdown = '';
        let overdue = false;
        if (publishOn) {
          // Різниця у Київ-календарних днях. Якщо publishOn раніше за today —
          // overdue (cron колись захопить, або read-time при візиті).
          const [py, pm, pd] = publishOn.split('-').map(Number);
          const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
          });
          const [ty, tm, td] = fmt.format(new Date()).split('-').map(Number);
          const days = Math.round(
            (Date.UTC(py, pm - 1, pd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
          );
          const formatted = formatDateChip(publishOn);
          if (days < 0) { overdue = true; countdown = `минула дата — опублікується при наступному відвідуванні /news`; }
          else if (days === 0) countdown = `сьогодні зранку (${formatted})`;
          else if (days === 1) countdown = `завтра зранку (${formatted})`;
          else countdown = `через ${days} ${days < 5 ? 'дні' : 'днів'} (${formatted})`;
        }

        return (
          <>
            <div className={`flex items-center gap-2 mb-2 ${dark ? 'text-amber-300/90' : 'text-amber-800'}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                hasStaged
                  ? overdue
                    ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                    : 'bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                  : 'bg-stone-400'
              }`} />
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase">Наступна сторінка новин</span>
              <span className={`text-[10px] font-normal opacity-70 normal-case tracking-normal`}>
                {hasStaged ? '· чернетка готова' : '· немає чернетки'}
              </span>
            </div>

            {hasStaged ? (
              <div className={`rounded-xl border backdrop-blur-sm overflow-hidden shadow-sm ${
                dark
                  ? overdue ? 'bg-gradient-to-br from-rose-500/[0.06] to-white/[0.02] border-rose-300/25' : 'bg-gradient-to-br from-amber-500/[0.06] to-white/[0.02] border-amber-300/25'
                  : overdue ? 'bg-gradient-to-br from-rose-50/70 to-white/60 border-rose-500/25' : 'bg-gradient-to-br from-amber-50/70 to-white/60 border-amber-500/30'
              }`}>
                {/* Accent-смужка зверху (симетрично з Поточна) */}
                <div className={`h-0.5 ${
                  overdue
                    ? 'bg-gradient-to-r from-rose-500/0 via-rose-500/70 to-rose-500/0'
                    : 'bg-gradient-to-r from-amber-500/0 via-amber-500/70 to-amber-500/0'
                }`} />

                {/* Thumb-превʼю наступної сторінки — клік відкриває fullscreen. */}
                <PagePreviewIframeThumb
                  source="next"
                  title="Превʼю чернетки наступної сторінки /news"
                  dark={dark}
                  variant="amber"
                />

                {/* Header — status + countdown + Превʼю icon-button (симетрично з Поточна). */}
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.08em] flex-shrink-0 ${
                      overdue
                        ? dark ? 'bg-rose-500/15 text-rose-300 border border-rose-400/25' : 'bg-rose-100 text-rose-800 border border-rose-500/25'
                        : dark ? 'bg-amber-500/15 text-amber-300 border border-amber-400/25' : 'bg-amber-100 text-amber-800 border border-amber-500/25'
                    }`}>
                      <span aria-hidden>🕒</span>
                      <span>{overdue ? 'Прострочено' : 'Заплановано'}</span>
                    </div>
                    <span className={`text-[11px] truncate ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                      {publishOn ? countdown : 'дату не встановлено — чекає ручної публікації'}
                    </span>
                    {scheduleSaveState !== 'idle' && (
                      <span className={`text-[10px] flex-shrink-0 ${
                        scheduleSaveState === 'saving'
                          ? (dark ? 'text-amber-200/60' : 'text-amber-800/60')
                          : (dark ? 'text-emerald-300' : 'text-emerald-700')
                      }`}>
                        {scheduleSaveState === 'saving' ? '· збереження…' : '· ✓ збережено'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPagePreviewSource({ kind: 'next' })}
                    title="Превʼю чернетки наступної сторінки"
                    aria-label="Превʼю"
                    className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                      dark
                        ? 'bg-white/[0.04] border-white/[0.10] text-slate-300 hover:bg-white/[0.10] hover:text-slate-100'
                        : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
                    }`}
                  >
                    <span aria-hidden className="text-[13px]">👁</span>
                  </button>
                </div>

                {/* Footer — schedule зверху (повна ширина), state-actions знизу
                    окремою смужкою. Дві колонки б ставали б тісними при малій
                    ширині картки (4 контроли + crowded gap), тому розділив. */}
                <div className={`border-t flex flex-col ${
                  dark ? 'border-white/[0.06] bg-white/[0.015]' : 'border-amber-500/15 bg-white/40'
                }`}>
                  {/* Row 1 — schedule input. Date pill full-width + reset праворуч. */}
                  <div className={`px-3 pt-2.5 pb-2 flex items-center gap-2 ${
                    dark ? 'border-b border-white/[0.04]' : 'border-b border-amber-500/10'
                  }`}>
                    <span className={`flex-shrink-0 text-[9.5px] font-bold tracking-[0.14em] uppercase ${
                      dark ? 'text-amber-300/55' : 'text-amber-800/55'
                    }`}>Публікація</span>
                    <button
                      type="button"
                      ref={dateTriggerRef}
                      onClick={() => setDatePickerOpen(o => !o)}
                      className={`flex-1 min-w-0 inline-flex items-center justify-between gap-2 px-3 h-8 text-[11.5px] rounded-full border transition-colors ${
                        dark
                          ? 'bg-white/[0.06] text-amber-100 border-amber-300/30 hover:border-amber-300/60'
                          : 'bg-white text-amber-900 border-amber-500/40 hover:border-amber-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <svg
                          aria-hidden
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="flex-shrink-0"
                        >
                          <rect x="3" y="5" width="18" height="16" rx="2" />
                          <path d="M3 10h18" />
                          <path d="M8 3v4" />
                          <path d="M16 3v4" />
                        </svg>
                        <span className="font-medium truncate">
                          {scheduleInput ? formatDateChip(scheduleInput) : 'Обрати дату'}
                        </span>
                      </span>
                      <FaChevronDown className={`text-[9px] flex-shrink-0 transition-transform ${datePickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {scheduleInput && (
                      <button
                        type="button"
                        onClick={() => { setScheduleInput(''); setDatePickerOpen(false); }}
                        title="Скинути дату публікації"
                        aria-label="Скинути дату публікації"
                        className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                          dark
                            ? 'bg-rose-500/15 text-rose-200 border-rose-400/40 hover:bg-rose-500/25'
                            : 'bg-rose-100/70 text-rose-800 border-rose-400/55 hover:bg-rose-100'
                        }`}
                      >
                        <svg
                          aria-hidden
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 6l12 12" />
                          <path d="M6 18L18 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Row 2 — state-actions: Publish (primary, flex-1) + Edit + Discard. */}
                  <div className="px-3 py-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStagedConfirm('publishNow')}
                      disabled={stagedActionPending !== null}
                      title="Опублікувати чернетку негайно"
                      className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-3 h-8 text-[11.5px] font-medium rounded-full border transition-colors whitespace-nowrap disabled:opacity-50 ${
                        dark
                          ? 'bg-emerald-400/90 text-stone-900 border-transparent hover:bg-emerald-300'
                          : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700'
                      }`}
                    >
                      <span aria-hidden className="text-[11px]">⚡</span>
                      <span>{stagedActionPending === 'publishNow' ? '...' : 'Опублікувати'}</span>
                    </button>
                    <Link
                      href="/dashboard/admin/news/page-builder/next"
                      title="Редагувати чернетку наступної сторінки"
                      className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3 h-8 text-[11.5px] font-medium rounded-full border transition-colors whitespace-nowrap ${
                        dark
                          ? 'bg-transparent border-amber-300/40 text-amber-200 hover:border-amber-300/70 hover:bg-amber-300/10'
                          : 'bg-white/60 border-amber-700/40 text-amber-800 hover:border-amber-700/70 hover:bg-amber-50'
                      }`}
                    >
                      <FaPlus className="text-[10px]" />
                      <span>Редагувати</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setStagedConfirm('discard')}
                      disabled={stagedActionPending !== null}
                      title="Видалити чернетку"
                      aria-label="Очистити чернетку"
                      className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors disabled:opacity-50 ${
                        dark
                          ? 'bg-rose-500/10 text-rose-200 border-rose-400/30 hover:bg-rose-500/20'
                          : 'bg-rose-100/60 text-rose-800 border-rose-300/60 hover:bg-rose-100'
                      }`}
                    >
                      <span aria-hidden className="text-[12px]">{stagedActionPending === 'discard' ? '…' : '🗑'}</span>
                    </button>
                  </div>
                </div>

                {datePickerOpen && datePickerPos && typeof document !== 'undefined' && createPortal(
                  <div
                    id="news-date-popover"
                    style={{
                      position: 'fixed',
                      top: datePickerPos.top,
                      left: datePickerPos.left,
                      width: 240,
                      zIndex: 70,
                    }}
                    className={`rounded-lg shadow-xl overflow-hidden ${
                      dark ? 'bg-[#1a1d26]' : 'bg-white'
                    }`}
                  >
                    <InlineDatePicker
                      value={scheduleDraft}
                      onChange={(v) => setScheduleDraft(v)}
                      theme={theme}
                      min={minDate}
                    />
                    <p className={`px-2.5 pb-1.5 -mt-1 text-[10px] leading-snug ${dark ? 'text-amber-200/55' : 'text-amber-800/65'}`}>
                      Заміна вранці обраного дня (06:00 Київ).
                    </p>
                    <div className={`flex items-center gap-2 px-2.5 py-2 border-t ${
                      dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-amber-500/15 bg-amber-50/40'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setDatePickerOpen(false)}
                        className={`flex-shrink-0 px-3 h-8 rounded-full text-[11px] font-medium border transition-colors ${
                          dark
                            ? 'bg-transparent text-stone-300 border-white/[0.10] hover:bg-white/[0.05]'
                            : 'bg-transparent text-stone-700 border-stone-300/70 hover:bg-stone-100/60'
                        }`}
                      >Скасувати</button>
                      <button
                        type="button"
                        disabled={!scheduleDraft || scheduleDraft === scheduleInput}
                        onClick={() => { setScheduleInput(scheduleDraft); setDatePickerOpen(false); }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-[11.5px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          dark
                            ? 'bg-emerald-400/90 text-stone-900 border-transparent hover:bg-emerald-300'
                            : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700'
                        }`}
                      >
                        <svg
                          aria-hidden
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        <span>Підтвердити</span>
                      </button>
                    </div>
                  </div>,
                  document.body,
                )}
              </div>
            ) : (
              // Без чернетки: пояснювальний текст + standalone pill "Створити наступну".
              // Pill тут окремо бо немає панелі-контейнера для footer-у.
              <>
                <p className={`mb-3 text-[11px] leading-relaxed ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Створи чернетку наступної версії сторінки /news і обери дату публікації — заміна відбудеться вранці того дня (06:00 Київ).
                </p>
                <Link
                  href="/dashboard/admin/news/page-builder/next"
                  className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden border ${
                    dark
                      ? 'bg-transparent border-emerald-300/40 text-emerald-200 hover:border-emerald-300/70 hover:bg-emerald-300/10 hover:shadow-[0_0_18px_-4px_rgba(16,185,129,0.45)]'
                      : 'bg-white/60 border-emerald-700/40 text-emerald-800 hover:border-emerald-700/70 hover:bg-emerald-50 hover:shadow-[0_4px_14px_-6px_rgba(5,150,105,0.35)]'
                  }`}
                  title="Створити чернетку наступної сторінки із запланованою публікацією"
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
                      dark ? 'bg-emerald-300/20' : 'bg-emerald-300/30'
                    }`}
                  />
                  <span aria-hidden className="relative text-[11px]">{'🕒'}</span>
                  <span className="relative">Створити наступну</span>
                </Link>
              </>
            )}
          </>
        );
      })()}
          </div>
          {/* ╰─ кінець колонки 2 ─╯ */}

          {/* ─── Колонка 3: АРХІВ (conditional) ─── */}
          {(archive && archive.length > 0) && (
            <div className="min-w-0">
      {/* ─── Підсекція 3: АРХІВ замінених версій ─── */}
      {(archive && archive.length > 0) && (
        <>
          <div className={`flex items-center gap-2 mb-2.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${dark ? 'bg-stone-500' : 'bg-stone-400'}`} />
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase">Архів</span>
            <span className="text-[10px] font-normal opacity-70 normal-case tracking-normal">
              · {archive.length} {archive.length === 1 ? 'версія' : archive.length < 5 ? 'версії' : 'версій'}
            </span>
          </div>
          <div className={`rounded-xl border overflow-hidden ${
            dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/40 border-stone-300/40'
          }`}>
            <ul className="divide-y divide-stone-200/40 dark:divide-white/[0.05]">
              {archive.map(entry => {
                const date = new Date(entry.archivedAt);
                const dateLabel = date.toLocaleDateString('uk-UA', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });
                const timeLabel = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                return (
                  <li key={entry.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12px] font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                        {dateLabel}
                      </div>
                      <div className={`text-[10.5px] opacity-70 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                        замінено о {timeLabel}{entry.wasPublished ? ' · була live' : ' · була прихована'}
                      </div>
                    </div>
                    <div className="flex-shrink-0 inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPagePreviewSource({ kind: 'archive', id: entry.id, archivedAt: entry.archivedAt })}
                        title="Превʼю архівної версії"
                        aria-label="Превʼю"
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
                          dark
                            ? 'bg-white/[0.04] text-slate-300 border-white/[0.10] hover:bg-white/[0.10] hover:text-slate-100'
                            : 'bg-white/70 text-stone-700 border-stone-300/60 hover:bg-white hover:text-stone-900'
                        }`}
                      >
                        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveConfirm({ id: entry.id, action: 'load', dateLabel })}
                        title="Відкрити у білдері (як чернетку наступної сторінки)"
                        aria-label="Відкрити"
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
                          dark
                            ? 'bg-amber-300/10 text-amber-200 border-amber-300/30 hover:bg-amber-300/20'
                            : 'bg-amber-100/60 text-amber-800 border-amber-500/40 hover:bg-amber-100'
                        }`}
                      >
                        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveConfirm({ id: entry.id, action: 'restore', dateLabel })}
                        title="Повернути на live"
                        aria-label="Повернути"
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
                          dark
                            ? 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30 hover:bg-emerald-400/20'
                            : 'bg-emerald-100/60 text-emerald-800 border-emerald-500/40 hover:bg-emerald-100'
                        }`}
                      >
                        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 3-6.7" />
                          <polyline points="3 4 3 10 9 10" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
            </div>
          )}
          {/* ╰─ кінець колонки 3 ─╯ */}
        </div>
        {/* ╰─ кінець вертикального стеку ───────────────────────────────╯ */}

        </div>
        {/* ╰─ кінець блоку «Сторінка /news» ─────────────────────────────╯ */}

        {/* ╭─ БЛОК: Шаблони + список новин (3/4 ширини) ────────────────╮ */}
        <section className="min-w-0 lg:col-span-3">
          {/* ─── Секція ШАБЛОНИ ─── */}
          {/* Шаблони — зверстані заготовки «Превʼю + Новина», які менеджер
              наповнює інформацією. Структура попередньо професійно дизайнерська
              (editorial article + event announcement) — досить замінити плейсхолдери
              на власний текст/фото. Клік по blueprint-у або по створеній із нього
              новині відкриває блоковий конструктор /[id]/template (TemplateConstructor):
              для новини він у content-режимі, де Save = одразу публікація. */}
          <style>{NEWS_BLOCK_CSS}</style>
          <div className={`flex items-center gap-3 mb-4 h-[36px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase whitespace-nowrap">
              Шаблони <span className={`font-normal opacity-70`}>· {templates.length}</span>
            </span>
            <span className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-stone-300/60'}`} />
          </div>

          {/* «Blueprint families» — 2-колонковий лейаут на десктопі: кожен kind
              у власній колонці, всередині — blueprint card зверху і список
              створених під ним. Чітка ієрархія parent→children, при цьому
              паралельні колонки за kind-ом — менеджер одразу бачить ARTICLE
              окремо від EVENT, не перемішується. */}
          {(() => {
            // Сплітимо blueprint-и: дефолтні (parentTemplateId=null) показуємо як
            // основні картки; кастомні групуємо під своїм parent-ом нижче.
            // ARTICLE blueprint приховано з адмінки — менеджер працює лише з EVENT.
            const defaultTemplates = templates.filter(t => !t.parentTemplateId && (t.templateKind || 'ARTICLE') !== 'ARTICLE');
            const customByParent = new Map<string, NewsItem[]>();
            templates.filter(t => !!t.parentTemplateId).forEach(t => {
              const arr = customByParent.get(t.parentTemplateId!) || [];
              arr.push(t);
              customByParent.set(t.parentTemplateId!, arr);
            });
            // Аспект для тайла «Новини» — беремо canvas першого кастомного
            // шаблону (або дефолтного), щоб тайл був тієї ж висоти/пропорції,
            // що й прев'ю шаблону зліва.
            const refTplForAspect =
              templates.find(t => !!t.parentTemplateId) || defaultTemplates[0] || null;
            let newsAspectW = 800;
            let newsAspectH = 448;
            if (refTplForAspect?.templateCanvas) {
              const m = refTplForAspect.templateCanvas.match(/^(\d+)x(\d+)$/);
              if (m) {
                const w = Number(m[1]);
                const h = Number(m[2]);
                if (Number.isFinite(w) && Number.isFinite(h) && w >= 60 && h >= 60) {
                  newsAspectW = w;
                  newsAspectH = h;
                }
              }
            }
            return (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-10 items-start">
            {defaultTemplates.map((tpl) => {
              const kind = (tpl.templateKind || 'ARTICLE') as TemplateKind;
              const customs = customByParent.get(tpl.id) || [];
              const customIds = new Set(customs.map(c => c.id));
              // Новини під цим деревом:
              //   1) безпосередньо з дефолтного (parentTemplateId === tpl.id)
              //   2) з кастомного blueprint-у цього дефолтного (parentTemplateId in customIds)
              //   3) legacy: створені до запровадження parentTemplateId — групуємо за kind
              const children = templateNews.filter(tn =>
                tn.parentTemplateId === tpl.id
                || (tn.parentTemplateId && customIds.has(tn.parentTemplateId))
                || (!tn.parentTemplateId && tn.templateKind === kind)
              );
              const childrenPub = children.filter(c => c.published).length;
              const isEvent = kind === 'EVENT';
              return (
                <div key={tpl.id} className="flex flex-col">
                  {/* ── BLUEPRINT card — компактна горизонтальна смужка ── */}
                  <article
                    className={`rounded-xl border transition-all ${
                      dark
                        ? 'bg-sky-400/[0.04] border-sky-300/20 hover:border-sky-300/40'
                        : 'bg-sky-50/65 border-sky-300/45 hover:border-sky-500/55'
                    }`}
                  >
                    <header className="flex items-center gap-3 px-3 py-2.5 min-w-0 flex-wrap sm:flex-nowrap">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-[16px] flex-shrink-0 ${
                        dark
                          ? 'bg-sky-400/15 border border-sky-300/25'
                          : 'bg-sky-100/80 border border-sky-600/25'
                      }`} aria-hidden>
                        {isEvent ? '🎟' : '📰'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[15px] font-semibold leading-tight truncate ${
                          dark ? 'text-slate-100' : 'text-stone-900'
                        }`}>
                          Білдер Шаблонів
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2 h-[24px] rounded-full text-[10px] font-semibold ${
                          dark
                            ? 'bg-sky-400/10 text-sky-200/90 border border-sky-300/20'
                            : 'bg-white/80 text-sky-800/85 border border-sky-600/20'
                        }`}>
                          <span aria-hidden>📂</span>
                          <span>{children.length}{children.length > 0 ? ` · ${childrenPub} на /news` : ''}</span>
                        </span>
                        {/* «Створити Новину» прибрано 2026-05-15: з головного
                            шаблону менеджер створює тільки СВІЙ шаблон. Самі
                            новини добавляються на /news через білдер сторінки
                            (drag-and-drop блока з потрібного власного шаблону). */}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/admin/news/from-template', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ blueprintId: tpl.id, asBlueprint: true }),
                              });
                              if (!res.ok) {
                                const j = await res.json().catch(() => ({}));
                                setToast({ message: j?.error || 'Не вдалось створити свій шаблон', type: 'error' });
                                return;
                              }
                              const j = await res.json();
                              window.location.href = `/dashboard/admin/news/${j.id}/template`;
                            } catch (e) {
                              setToast({ message: e instanceof Error ? e.message : 'Помилка мережі', type: 'error' });
                            }
                          }}
                          className={`inline-flex items-center justify-center gap-1 px-3 h-8 text-[11.5px] font-medium rounded-lg border transition-colors ${
                            dark
                              ? 'bg-amber-400/15 border-amber-300/30 text-amber-100 hover:bg-amber-400/25 hover:border-amber-300/45'
                              : 'bg-amber-50/85 border-amber-500/35 text-amber-800 hover:bg-amber-100 hover:border-amber-600/55'
                          }`}
                          title="Створити новий шаблон на основі дефолтного"
                        >
                          <span aria-hidden className="text-[11px]">⊕</span>
                          Створити Новий Шаблон
                        </button>
                      </div>
                    </header>
                  </article>

                  {/* ── МОЇ ШАБЛОНИ — кастомні blueprint-и менеджера на основі цього дефолтного ──
                      Рендеримо лише якщо є хоч один кастомний. Міні-картки
                      менші за children-newsItem-и (це проміжна сутність —
                      підписаний пресет, не публікація). Кнопки: «Створити з
                      шаблону» (звичайна новина), «Редагувати», «Видалити». */}
                  {customs.length > 0 && (
                    <div
                      className={`relative ml-6 mt-3 pl-6 ${
                        dark ? 'border-l-2 border-amber-400/20' : 'border-l-2 border-amber-400/45'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-3 w-4 h-px ${
                          dark ? 'bg-amber-400/25' : 'bg-amber-400/55'
                        }`}
                      />
                      <div className={`flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-[0.14em] ${
                        dark ? 'text-amber-200/80' : 'text-amber-800/80'
                      }`}>
                        <span aria-hidden>📑</span>
                        <span>Мої шаблони</span>
                        <span className={`font-normal opacity-70 normal-case tracking-normal text-[11px]`}>
                          · {customs.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {customs.map((cust) => {
                          const custData = parseTemplateData(kind, cust.templateData);
                          const custTitle = cust.title.replace(/^\[Шаблон\]\s*/i, '');
                          // Розміри канвасу. Block-based templateCanvas (формат "WxH")
                          // має пріоритет — це те, що менеджер ресайзив у TemplateConstructor.
                          let custBaseW = isEvent ? 600 : PREVIEW_CARD_WIDTH;
                          let custBaseH = isEvent ? 400 : PREVIEW_CARD_HEIGHT;
                          if (cust.templateCanvas) {
                            const m = cust.templateCanvas.match(/^(\d+)x(\d+)$/);
                            if (m) {
                              const w = Number(m[1]);
                              const h = Number(m[2]);
                              if (Number.isFinite(w) && Number.isFinite(h) && w >= 60 && h >= 60) {
                                custBaseW = w;
                                custBaseH = h;
                              }
                            }
                          }
                          // Block-based render (Session 3+) — якщо є templateBlocks,
                          // рендеримо 1-в-1 з конструктором через AbsoluteBlockRender.
                          // Інакше fallback на legacy TemplatePreviewCard з templateData.
                          const tplBlocks = cust.templateBlocks ? parseBlocks(cust.templateBlocks) : null;
                          const hasBlocks = !!(tplBlocks && tplBlocks.isJson && tplBlocks.blocks.length > 0);
                          return (
                            <article
                              key={cust.id}
                              className={`group/cust relative rounded-lg border overflow-hidden flex flex-col transition-all ${
                                dark
                                  ? 'bg-amber-400/[0.04] border-amber-300/15 hover:border-amber-300/35'
                                  : 'bg-amber-50/55 border-amber-400/40 hover:border-amber-500/65'
                              }`}
                            >
                              <Link
                                href={`/dashboard/admin/news/${cust.id}/template`}
                                className="block relative w-full"
                                style={{ aspectRatio: `${custBaseW} / ${custBaseH}`, background: cust.pageBgColor || '#FFFFFF' }}
                                aria-label={`Редагувати «${custTitle}»`}
                              >
                                <div className="absolute inset-0" style={{ pointerEvents: 'none' }} aria-hidden>
                                  <PreviewCardScale
                                    baseWidth={custBaseW}
                                    baseHeight={custBaseH}
                                    initialScale={1}
                                  >
                                    {hasBlocks ? (
                                      <TemplateBlocksPreview
                                        blocks={tplBlocks!.blocks}
                                        width={custBaseW}
                                        height={custBaseH}
                                        background={cust.pageBgColor || '#FFFFFF'}
                                      />
                                    ) : (
                                      <TemplatePreviewCard kind={kind} data={custData} disableLinks />
                                    )}
                                  </PreviewCardScale>
                                </div>
                                <span
                                  className={`absolute top-1.5 left-1.5 z-[1] inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-[11px] font-semibold leading-snug backdrop-blur-md max-w-[calc(100%-3rem)] ${
                                    dark
                                      ? 'bg-amber-500/35 text-amber-50 border border-amber-300/40'
                                      : 'bg-amber-500/85 text-white border border-amber-600/40'
                                  }`}
                                  title={custTitle}
                                >
                                  <span aria-hidden className="text-[10px]">📑</span>
                                  <span className="line-clamp-2 break-words">{custTitle}</span>
                                </span>
                                {/* Розмір канвасу шаблону — окремий блок ПІД title-pill-ом,
                                    зліва. Допомагає менеджеру одразу побачити, на який
                                    aspect шаблон розрахований, без переходу в редактор. */}
                                <span
                                  className={`absolute left-1.5 z-[1] inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold leading-snug backdrop-blur-md tabular-nums whitespace-nowrap shadow-sm ${
                                    dark
                                      ? 'bg-slate-900/55 text-amber-100/95 border border-amber-300/30'
                                      : 'bg-white/85 text-stone-800 border border-amber-500/45'
                                  }`}
                                  style={{ top: 38 }}
                                  title={`Розмір шаблону: ${custBaseW}×${custBaseH} px`}
                                >
                                  <span className="opacity-70 font-medium">Розмір:</span>
                                  <span>{custBaseW}<span className="opacity-60 mx-0.5 font-normal">×</span>{custBaseH}</span>
                                </span>
                              </Link>
                              {/* Кнопка видалення — у верхньому правому куті прев'ю,
                                  поверх Link (sibling з position:absolute щоб не вкладатись
                                  в interactive parent). */}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ id: cust.id, title: custTitle })}
                                className={`absolute top-1.5 right-1.5 z-[2] inline-flex items-center justify-center w-[26px] h-[26px] rounded-md border backdrop-blur-md transition-colors ${
                                  dark
                                    ? 'bg-red-500/25 border-red-400/40 text-red-100 hover:bg-red-500/45 hover:border-red-400/65'
                                    : 'bg-red-50/85 border-red-400/55 text-red-700 hover:bg-red-100 hover:border-red-500/70'
                                }`}
                                title="Видалити цей шаблон (новини, створені з нього, лишаться)"
                              >
                                ✕
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* «Створені з цього шаблону» прибрано 2026-05-16: з цієї
                      сторінки новини не створюються — лише шаблони. Новини
                      додаються через білдер сторінки /news. */}
                </div>
              );
            })}

            {/* Контейнер «Новини» — сюди менеджер створює новини на основі
                шаблонів зліва. Висота секції зі списком = ширина шаблону
                (1:1 з template-канвасом колонки), щоб новини візуально були
                в одному розмірному ряді з прев'ю шаблонів. */}
            <div className="flex flex-col">
              <article
                className={`rounded-xl border transition-all ${
                  dark
                    ? 'bg-sky-400/[0.04] border-sky-300/20 hover:border-sky-300/40'
                    : 'bg-sky-50/65 border-sky-300/45 hover:border-sky-500/55'
                }`}
              >
                <header className="flex items-center gap-3 px-3 py-2.5 min-w-0 flex-wrap sm:flex-nowrap">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-[16px] flex-shrink-0 ${
                    dark
                      ? 'bg-sky-400/15 border border-sky-300/25'
                      : 'bg-sky-100/80 border border-sky-600/25'
                  }`} aria-hidden>
                    📰
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13.5px] font-semibold leading-tight truncate ${
                      dark ? 'text-slate-100' : 'text-stone-900'
                    }`}>
                      Новини
                    </div>
                  </div>
                </header>
              </article>
              {/* Колонка «+» тайлів — по одному на КОЖЕН custom-шаблон зліва.
                  Структура ДЗЕРКАЛЬНА до «Мої шаблони» зліва (ml-6+pl-6 wrapper,
                  spacer-label, grid-cols-1 gap-2.5, articles з aspect-ratio
                  preview), щоб кожен «+» опинявся рівно навпроти свого
                  шаблону по висоті. Жодного пікера — клік одразу створює
                  News з відповідного шаблону. */}
              {(() => {
                const visibleCustoms = defaultTemplates.flatMap(tpl => customByParent.get(tpl.id) || []);
                if (visibleCustoms.length === 0) return null;
                return (
                  <div className="relative ml-6 mt-3 pl-6">
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-[0.14em] opacity-0 select-none" aria-hidden>
                      <span>📰</span>
                      <span>Новини</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {visibleCustoms.map(cust => {
                        let tileW = newsAspectW;
                        let tileH = newsAspectH;
                        if (cust.templateCanvas) {
                          const m = cust.templateCanvas.match(/^(\d+)x(\d+)$/);
                          if (m) {
                            const w = Number(m[1]);
                            const h = Number(m[2]);
                            if (Number.isFinite(w) && Number.isFinite(h) && w >= 60 && h >= 60) {
                              tileW = w;
                              tileH = h;
                            }
                          }
                        }
                        const custTitle = cust.title.replace(/^\[Шаблон\]\s*/i, '');
                        // Новини, створені з цього кастомного шаблону. Рендеримо
                        // як sibling-карточки після «+» тайла — менеджер одразу
                        // бачить що вже створено.
                        const custNews = templateNews.filter(tn => tn.parentTemplateId === cust.id);
                        const tileCount = 1 + custNews.length;
                        const grid = tileGridFor(tileCount);
                        return (
                          <div
                            key={cust.id}
                            className="grid gap-2 w-full"
                            style={{
                              aspectRatio: `${tileW} / ${tileH}`,
                              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
                              gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
                            }}
                          >
                            <article
                              className={`min-w-0 min-h-0 rounded-lg border overflow-hidden transition-all ${
                                dark
                                  ? 'bg-sky-400/[0.04] border-sky-300/20 hover:border-sky-300/40'
                                  : 'bg-sky-50/40 border-sky-400/40 hover:border-sky-500/55'
                              }`}
                            >
                              <div className="relative w-full h-full">
                                <button
                                  type="button"
                                  disabled={creatingFromTpl}
                                  onClick={async () => {
                                    setCreatingFromTpl(true);
                                    try {
                                      const res = await fetch('/api/admin/news/from-template', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ blueprintId: cust.id, asBlueprint: false }),
                                      });
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}));
                                        setToast({ message: j?.error || 'Не вдалось створити новину', type: 'error' });
                                        setCreatingFromTpl(false);
                                        return;
                                      }
                                      const j = await res.json();
                                      window.location.href = `/dashboard/admin/news/${j.id}/template`;
                                    } catch (e) {
                                      setToast({ message: e instanceof Error ? e.message : 'Помилка мережі', type: 'error' });
                                      setCreatingFromTpl(false);
                                    }
                                  }}
                                  className={`group absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all ${
                                    dark
                                      ? 'hover:bg-sky-400/[0.06]'
                                      : 'hover:bg-sky-50/55'
                                  } ${creatingFromTpl ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                                  title={`Створити новину з шаблону «${custTitle}»`}
                                >
                                  <span
                                    className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-[28px] font-light transition-transform group-hover:scale-110 ${
                                      dark
                                        ? 'bg-sky-400/15 text-sky-200 border border-sky-300/30'
                                        : 'bg-white text-sky-700 border border-sky-400/50 shadow-sm'
                                    }`}
                                    aria-hidden
                                  >
                                    +
                                  </span>
                                  <span className={`text-[12.5px] font-semibold ${dark ? 'text-sky-200/90' : 'text-sky-800/85'}`}>
                                    Створити новину
                                  </span>
                                  <span className={`text-[11px] truncate max-w-[80%] ${dark ? 'text-slate-400/80' : 'text-stone-500'}`}>
                                    з: {custTitle}
                                  </span>
                                </button>
                              </div>
                            </article>
                            {custNews.map(n => {
                              const nTitle = n.title.replace(/^\[Шаблон\]\s*/i, '');
                              const nBlocks = n.templateBlocks ? parseBlocks(n.templateBlocks) : null;
                              const hasBlocks = !!(nBlocks && nBlocks.isJson && nBlocks.blocks.length > 0);
                              const nData = !hasBlocks && n.templateData ? parseTemplateData((n.templateKind || 'ARTICLE') as TemplateKind, n.templateData) : null;
                              const hasPlaceholders = hasUnfilledPlaceholders(n.templateData ?? null, n.templateBlocks ?? null);
                              return (
                                <article
                                  key={n.id}
                                  className={`group/news relative min-w-0 min-h-0 rounded-lg border overflow-hidden transition-all ${
                                    dark
                                      ? 'bg-sky-500/[0.10] border-sky-400/35 hover:border-sky-300/60'
                                      : 'bg-sky-50/70 border-sky-500/50 hover:border-sky-600/70'
                                  }`}
                                >
                                  <Link
                                    href={`/dashboard/admin/news/${n.id}/template`}
                                    className="block relative w-full h-full"
                                    style={{ background: n.pageBgColor || '#FFFFFF' }}
                                    aria-label={`Редагувати новину «${nTitle}»`}
                                  >
                                    <div className="absolute inset-0" style={{ pointerEvents: 'none' }} aria-hidden>
                                      <FitInBox baseWidth={tileW} baseHeight={tileH}>
                                        {hasBlocks ? (
                                          <TemplateBlocksPreview
                                            blocks={nBlocks!.blocks}
                                            width={tileW}
                                            height={tileH}
                                            background={n.pageBgColor || '#FFFFFF'}
                                            mode="content"
                                          />
                                        ) : nData ? (
                                          <TemplatePreviewCard kind={(n.templateKind || 'ARTICLE') as TemplateKind} data={nData} disableLinks />
                                        ) : null}
                                      </FitInBox>
                                    </div>
                                    <span
                                      className={`absolute top-1.5 left-1.5 z-[1] inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-[11px] font-semibold leading-snug backdrop-blur-md max-w-[calc(100%-1rem)] ${
                                        dark
                                          ? 'bg-slate-700/70 text-slate-100 border border-slate-500/40'
                                          : 'bg-white/85 text-stone-800 border border-stone-400/45'
                                      }`}
                                      title={nTitle}
                                    >
                                      <span aria-hidden className="text-[10px]">📰</span>
                                      <span className="line-clamp-2 break-words">{nTitle}</span>
                                    </span>
                                    {n.published && !hasPlaceholders && (
                                      <span
                                        className={`absolute bottom-1.5 left-1.5 z-[1] inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider backdrop-blur-md ${
                                          dark
                                            ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                                            : 'bg-emerald-500/85 text-white border border-emerald-600/40'
                                        }`}
                                      >
                                        <span aria-hidden>●</span> На /news
                                      </span>
                                    )}
                                    {hasPlaceholders && (
                                      <span
                                        className={`absolute bottom-1.5 left-1.5 z-[1] inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider backdrop-blur-md ${
                                          dark
                                            ? 'bg-amber-500/30 text-amber-100 border border-amber-400/45'
                                            : 'bg-amber-500/90 text-white border border-amber-600/40'
                                        }`}
                                        title="У шаблоні залишились незаповнені поля (плейсхолдери). На /news така новина прихована."
                                      >
                                        <span aria-hidden>⚠</span> Незаповнено
                                      </span>
                                    )}
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDeleteTarget({ id: n.id, title: nTitle });
                                    }}
                                    className={`absolute top-1.5 right-1.5 z-[5] inline-flex items-center justify-center w-[26px] h-[26px] rounded-md border backdrop-blur-md transition-colors ${
                                      dark
                                        ? 'bg-red-500/25 border-red-400/40 text-red-100 hover:bg-red-500/45 hover:border-red-400/65'
                                        : 'bg-red-50/85 border-red-400/55 text-red-700 hover:bg-red-100 hover:border-red-500/70'
                                    }`}
                                    title="Видалити цю новину"
                                  >
                                    ✕
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
            );
          })()}

          {/* Секція «Новини» (вільні, без шаблону) — прибрана 2026-05-15.
              За домовленістю з користувачем: всі новини UIMP створюються
              виключно з шаблонів. Free-form формат більше не потрібен. */}

        </section>
        {/* ╰─ кінець блоку «Шаблони + список новин» ─────────────────────╯ */}
      </div>

      {/* Fullscreen-превʼю «Поточної сторінки». Iframe → /uk/news/preview
          з повним layout (Navbar + Hero + Content + Footer + CookieBanner)
          з [locale]/layout.tsx — 1-в-1 публічний вигляд. Esc / клік по
          бекдропу / X — закривають. */}
      {pagePreviewSource !== null && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-stone-900/85 backdrop-blur-md"
          onClick={() => setPagePreviewSource(null)}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3 text-white/90">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase">
                Превʼю · {pagePreviewSource.kind === "next" ? "наступна /news" : pagePreviewSource.kind === "archive" ? "архів /news" : "/news"}
              </span>
              {pagePreviewSource.kind === "next" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-400/30">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Чернетка
                </span>
              ) : pagePreviewSource.kind === "archive" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-stone-500/20 text-stone-200 border border-stone-400/30">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-400" />
                  Архів · {formatDateChip(pagePreviewSource.archivedAt.slice(0, 10))}
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                  pagePublished
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                }`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    pagePublished ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  {pagePublished === null ? '...' : pagePublished ? 'На сайті' : 'Прихована'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPagePreviewSource(null); }}
              title="Закрити (Esc)"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 text-white/80 hover:bg-white/[0.12] hover:text-white transition-colors"
            >
              <FaTimes />
            </button>
          </div>
          <div
            className="flex-1 overflow-hidden p-6"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="mx-auto h-full rounded-lg overflow-hidden shadow-2xl bg-white"
              style={{ maxWidth: '1440px' }}
            >
              <iframe
                key={`page-preview:${pagePreviewSource.kind}:${pagePreviewSource.kind === "archive" ? pagePreviewSource.id : ""}`}
                src={(() => {
                  const base = "/uk/news/preview";
                  if (pagePreviewSource.kind === "next") return `${base}?source=next`;
                  if (pagePreviewSource.kind === "archive") return `${base}?source=archive&id=${encodeURIComponent(pagePreviewSource.id)}`;
                  return `${base}?source=live`;
                })()}
                title="Превʼю /news"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen-превʼю окремої новини. Iframe — точна копія публічного
          рендера (без drift). kind="card" → /uk/news (картка в контексті
          списку), kind="article" → /uk/news/{slug} (повна сторінка статті). */}
      {itemPreview && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-stone-900/85 backdrop-blur-md"
          onClick={() => setItemPreview(null)}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3 text-white/90 min-w-0">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase whitespace-nowrap">
                Превʼю · {itemPreview.kind === 'article' ? `/news/${itemPreview.slug}` : '/news'}
              </span>
              <span className="text-[12px] text-white/60 truncate">
                {itemPreview.title}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setItemPreview(null); }}
              title="Закрити (Esc)"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 text-white/80 hover:bg-white/[0.12] hover:text-white transition-colors"
            >
              <FaTimes />
            </button>
          </div>
          <div
            className="flex-1 overflow-hidden p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto h-full rounded-lg overflow-hidden shadow-2xl bg-white"
              style={{ maxWidth: '1280px' }}
            >
              <iframe
                key={`${itemPreview.kind}:${itemPreview.slug}`}
                src={
                  itemPreview.kind === 'article'
                    ? `/uk/news/${itemPreview.slug}?preview=1`
                    : `/uk/news?preview=1`
                }
                title={`Превʼю · ${itemPreview.title}`}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirm-modal для дій над staged-сторінкою (publishNow / discard).
          Заміщає native confirm() — у тому ж візуальному коді, що delete-модалка
          (rounded-2xl, кремовий/темний фон, kremowa/dark тема). */}
      {stagedConfirm && (() => {
        const isDiscard = stagedConfirm === 'discard';
        const cfg = isDiscard
          ? {
              icon: '🗑',
              title: 'Очистити чернетку?',
              body: (
                <>
                  Чернетку «<span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>Наступна сторінка</span>» —
                  контент і дату публікації — буде видалено. Поточна live-сторінка не зміниться.
                </>
              ),
              confirmLabel: 'Очистити',
              confirmClass: dark
                ? 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-[0_0_20px_-4px_rgba(244,63,94,0.5)]'
                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
            }
          : {
              icon: '⚡',
              title: 'Опублікувати наступну сторінку зараз?',
              body: (
                <>
                  Поточна live-версія буде замінена негайно — без очікування запланованої дати.
                  Сторінку <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>/news</span> побачать відвідувачі одразу.
                </>
              ),
              confirmLabel: 'Опублікувати зараз',
              confirmClass: dark
                ? 'bg-emerald-400/90 text-stone-900 hover:bg-emerald-300 shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)]'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
            };
        const pending = stagedActionPending !== null;
        return (
          <div
            className={`fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm ${
              dark ? 'bg-black/60' : 'bg-stone-900/30'
            }`}
            onClick={() => !pending && setStagedConfirm(null)}
          >
            <div
              className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
                dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className={`flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full text-[18px] ${
                  isDiscard
                    ? dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700'
                    : dark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                }`}>{cfg.icon}</span>
                <h3 className={`text-lg font-semibold leading-snug pt-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                  {cfg.title}
                </h3>
              </div>
              <p className={`text-sm mb-5 leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                {cfg.body}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStagedConfirm(null)}
                  disabled={pending}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
                  }`}
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={() => isDiscard ? discardStaged() : publishStagedNow()}
                  disabled={pending}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${cfg.confirmClass}`}
                >
                  {pending ? '...' : cfg.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Archive confirm — Відкрити / Повернути архівну версію /news. */}
      {archiveConfirm && (() => {
        const isRestore = archiveConfirm.action === 'restore';
        const cfg = isRestore
          ? {
              iconBg: dark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <polyline points="3 4 3 10 9 10" />
                </svg>
              ),
              title: 'Повернути цю версію на live?',
              body: (
                <>
                  Версія від <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{archiveConfirm.dateLabel}</span> стане
                  новою live-сторінкою <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>/news</span>.
                  Поточна live-версія автоматично перейде в архів — повернути її можна буде звідти.
                </>
              ),
              confirmLabel: 'Повернути на live',
              confirmClass: dark
                ? 'bg-emerald-400/90 text-stone-900 hover:bg-emerald-300 shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)]'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
            }
          : {
              iconBg: dark ? 'bg-amber-300/15 text-amber-300' : 'bg-amber-100 text-amber-800',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              ),
              title: 'Відкрити цю версію у білдері?',
              body: (
                <>
                  Версію від <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{archiveConfirm.dateLabel}</span> буде
                  завантажено як чернетку <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>наступної сторінки</span>.
                  Поточну чернетку, якщо вона є, буде перезаписано.
                </>
              ),
              confirmLabel: 'Відкрити',
              confirmClass: dark
                ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)]'
                : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm',
            };
        const runAction = async () => {
          if (archiveConfirmPending) return;
          setArchiveConfirmPending(true);
          try {
            const res = await fetch(`/api/admin/news/page-content/archive/${archiveConfirm.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: archiveConfirm.action }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              setToast({ type: 'error', message: body?.error || 'Не вдалось виконати дію' });
              setArchiveConfirm(null);
              return;
            }
            if (archiveConfirm.action === 'load') {
              // Архів-load записав nextContent на бекенді → hasStaged=true, тож
              // білдер /page-builder/next НЕ очистить локальну чернетку сам
              // (він робить це лише коли staged немає). Прибираємо editor-draft
              // тут, інакше стара локальна чернетка перекриє завантажену версію
              // банером «відновити чернетку». Симетрично з discardStaged/publishStagedNow.
              try { localStorage.removeItem('uimp_draft_page___news_page_next__'); } catch { /* ignore */ }
              router.push('/dashboard/admin/news/page-builder/next');
            } else {
              setToast({ type: 'success', message: `Версію від ${archiveConfirm.dateLabel} повернуто на live` });
              setArchiveConfirm(null);
              // Перевантажуємо архів і staged-статус.
              fetch('/api/admin/news/page-content/archive')
                .then(r => r.ok ? r.json() : [])
                .then((d: unknown) => setArchive(Array.isArray(d) ? d as typeof archive : []))
                .catch(() => {/* ignore */});
            }
          } finally {
            setArchiveConfirmPending(false);
          }
        };
        return (
          <div
            className={`fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm ${
              dark ? 'bg-black/60' : 'bg-stone-900/30'
            }`}
            onClick={() => !archiveConfirmPending && setArchiveConfirm(null)}
          >
            <div
              className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
                dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className={`flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${cfg.iconBg}`}>
                  {cfg.icon}
                </span>
                <h3 className={`text-lg font-semibold leading-snug pt-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                  {cfg.title}
                </h3>
              </div>
              <p className={`text-sm mb-5 leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                {cfg.body}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setArchiveConfirm(null)}
                  disabled={archiveConfirmPending}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
                  }`}
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={runAction}
                  disabled={archiveConfirmPending}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${cfg.confirmClass}`}
                >
                  {archiveConfirmPending ? '...' : cfg.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete modal */}
      {deleteTarget && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm ${
            dark ? 'bg-black/60' : 'bg-stone-900/30'
          }`}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
              dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
              Видалити новину?
            </h3>
            <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              Новина{' '}
              <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                «{deleteTarget.title}»
              </span>{' '}
              буде видалена назавжди. Цю дію не можна відмінити.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                    : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
                }`}
              >
                Скасувати
              </button>
              <button
                onClick={performDelete}
                disabled={deleting}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                  dark
                    ? 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-[0_0_20px_-4px_rgba(244,63,94,0.5)]'
                    : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
                }`}
              >
                {deleting ? '...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
