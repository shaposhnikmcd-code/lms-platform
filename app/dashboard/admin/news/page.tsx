'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
import NewsPagePreview from './_components/NewsPagePreview';
import InlineDatePicker, { formatDateChip } from '../_components/InlineDatePicker';
import {
  AbsoluteBlockRender,
  NEWS_BLOCK_CSS,
  PREVIEW_CARD_HEIGHT,
  PREVIEW_CARD_WIDTH,
  parseBlocks,
} from '@/lib/news/render';
import PreviewCardScale from '@/lib/news/PreviewCardScale';
import TemplatePreviewCard from '@/lib/news/templates/TemplatePreviewCard';
import { parseTemplateData, templateKindLabel, type TemplateKind } from '@/lib/news/templates/types';

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
  /** Якщо задано — render-имо через шаблонний компонент (lib/news/templates).
   *  В цьому разі `previewContent` ігнорується, превʼю автогенерується. */
  templateKind?: 'ARTICLE' | 'EVENT' | null;
  templateData?: string | null;
  suspendedAt: string | null;
  resumeAt: string | null;
  createdAt: string;
  author?: { name: string | null };
}


export default function AdminNewsPage() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [news, setNews] = useState<NewsItem[]>([]);
  const [templates, setTemplates] = useState<NewsItem[]>([]);
  // Створені з blueprint-ів — рендеряться у тій же секції «Шаблони» під blueprint-ами.
  const [templateNews, setTemplateNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Esc + body-scroll lock для будь-якої з модалок.
  const anyModalOpen = pagePreviewOpen || itemPreview !== null || stagedConfirm !== null;
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (itemPreview) setItemPreview(null);
      else if (stagedConfirm) setStagedConfirm(null);
      else if (pagePreviewOpen) setPagePreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [anyModalOpen, pagePreviewOpen, itemPreview, stagedConfirm]);

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
  const [scheduleInput, setScheduleInput] = useState<string>(''); // YYYY-MM-DD
  const [scheduleSaveState, setScheduleSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const scheduleDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setDatePickerPos({ top: r.bottom + 6, left: r.left });
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
    // Optimistic: миттєво прибираємо item з UI і закриваємо модалку — щоб
    // менеджер бачив reaction на клік без 500-1500мс лагу від API. На fail
    // — повертаємо state назад (rollback) + error-toast.
    const prevNews = news;
    const prevTpl = templateNews;
    setNews(prev => prev.filter(n => n.id !== id));
    setTemplateNews(prev => prev.filter(n => n.id !== id));
    setDeleteTarget(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setNews(prevNews);
        setTemplateNews(prevTpl);
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося видалити', type: 'error' });
        return;
      }
      setToast({ message: 'Новину видалено', type: 'success' });
    } catch {
      setNews(prevNews);
      setTemplateNews(prevTpl);
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

      {/* Двоколонковий лейаут (xl+):
            — зліва (1fr): операції зі сторінкою /news (live + staged);
            — справа (3fr): grid пар «превʼю-картка + новина» — на xl 2 пари в ряду,
              на нижчих — 1.
          У парі превʼю і дані — ОКРЕМІ блоки з невеликим gap-ом (3): зв'язок
          логічно очевидний, але це дві самостійні картки, що відповідає тому,
          що вони ведуть у РІЗНІ редактори (превʼю-картки vs контент новини).
          На вузьких екранах (<1280px) стек в одну колонку. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,3.6fr)] gap-6 items-start">
        {/* ╭─ ЛІВА КОЛОНКА: операції зі сторінкою /news ─────────────────╮ */}
        <aside className="min-w-0">
          <div className={`flex items-center gap-2 mb-4 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase">Сторінка /news</span>
            <span className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-stone-300/60'}`} />
          </div>

          {/* ─── Підсекція 1: ПОТОЧНА (live) ─── */}
          <div className={`flex items-center gap-2 mb-2.5 ${dark ? 'text-emerald-300/90' : 'text-emerald-700'}`}>
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
            className={`mb-6 rounded-xl border backdrop-blur-sm transition-all overflow-hidden shadow-sm ${
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

            {/* Header — клік відкриває превʼю на повний екран. */}
            <div
              className={`flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${
                dark ? 'hover:bg-white/[0.02]' : 'hover:bg-white/40'
              }`}
              onClick={() => setPagePreviewOpen(true)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Статус-pill з іконкою і коротким лейблом */}
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

              <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPagePreviewOpen(true); }}
                  title="Відкрити превʼю на повний екран"
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border transition-all text-[11px] font-medium ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
                  }`}
                >
                  <FaExpand className="text-[9px]" />
                  <span>Превʼю</span>
                </button>
              </div>
            </div>

        {/* Footer-панель: завжди стек вертикально — панель живе у вузькій лівій
            колонці на xl+ (0.85fr від 4.45fr ≈ 19% ширини), де горизонталь
            давала overflow. Primary CTA зверху на повну ширину, destructive нижче. */}
        <div className={`px-5 py-3 border-t flex flex-col gap-2 ${
          dark ? 'border-white/[0.04] bg-white/[0.015]' : 'border-stone-200/50 bg-white/40'
        }`}>
          <Link
            href="/dashboard/admin/news/page-builder"
            className={`group relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden border whitespace-nowrap ${
              dark
                ? 'bg-transparent border-amber-300/40 text-amber-200 hover:border-amber-300/70 hover:bg-amber-300/10 hover:shadow-[0_0_18px_-4px_rgba(251,191,36,0.45)]'
                : 'bg-white/60 border-amber-700/40 text-amber-800 hover:border-amber-700/70 hover:bg-amber-50 hover:shadow-[0_4px_14px_-6px_rgba(180,83,9,0.35)]'
            }`}
            title="Редагувати live-сторінку /news (миттєве оновлення)"
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
                dark ? 'bg-amber-300/20' : 'bg-amber-300/30'
              }`}
            />
            <FaPlus className="relative text-[11px]" />
            <span className="relative">Редагувати поточну</span>
          </Link>
          <button
            type="button"
            onClick={togglePagePublish}
            disabled={pagePublished === null || togglingPublish}
            title={pagePublished ? 'Прибрати сторінку з сайту (показуватиметься empty state)' : 'Показати сторінку на сайті'}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium border transition-colors disabled:opacity-50 ${
              pagePublished
                ? dark
                  ? 'bg-rose-500/10 text-rose-200 border-rose-400/30 hover:bg-rose-500/20'
                  : 'bg-rose-100/60 text-rose-800 border-rose-300/60 hover:bg-rose-100'
                : dark
                  ? 'bg-emerald-400/90 text-stone-900 border-transparent hover:bg-emerald-300 shadow-[0_0_14px_-4px_rgba(16,185,129,0.5)]'
                  : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm'
            }`}
          >
            {togglingPublish ? '...' : pagePublished ? 'Деактивувати' : 'Активувати'}
          </button>
        </div>
      </div>

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
            <div className={`flex items-center gap-2 mb-2.5 ${dark ? 'text-amber-300/90' : 'text-amber-800'}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                hasStaged
                  ? overdue
                    ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                    : 'bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                  : 'bg-stone-400'
              }`} />
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase">Наступна сторінка Новин</span>
              <span className={`text-[10px] font-normal opacity-70 normal-case tracking-normal`}>
                {hasStaged ? '· чернетка готова' : '· немає чернетки'}
              </span>
            </div>

            {hasStaged ? (
              <div className={`mb-4 rounded-xl border backdrop-blur-sm overflow-hidden ${
                dark ? 'bg-amber-400/[0.06] border-amber-300/25' : 'bg-amber-50/80 border-amber-500/30'
              }`}>
                <div className="px-5 py-3">
                  <div className="flex items-start gap-3 min-w-0 mb-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${
                      overdue
                        ? dark ? 'bg-rose-400/20 text-rose-200' : 'bg-rose-100 text-rose-800'
                        : dark ? 'bg-amber-400/25 text-amber-100' : 'bg-amber-200/80 text-amber-900'
                    }`} style={{ fontSize: '13px' }}>{'🕒'}</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${dark ? 'text-amber-200/85' : 'text-amber-800/85'}`}>
                        Запланована публікація
                      </div>
                      <div className={`text-[11px] ${dark ? 'text-amber-200/70' : 'text-amber-800/75'}`}>
                        {publishOn ? countdown : 'дату не встановлено — чекає ручної публікації'}
                      </div>
                    </div>
                    {scheduleSaveState !== 'idle' && (
                      <span className={`text-[10px] flex-shrink-0 mt-1 ${
                        scheduleSaveState === 'saving'
                          ? (dark ? 'text-amber-200/60' : 'text-amber-800/60')
                          : (dark ? 'text-emerald-300' : 'text-emerald-700')
                      }`}>
                        {scheduleSaveState === 'saving' ? 'збереження...' : '✓ збережено'}
                      </span>
                    )}
                  </div>

                  {/* Один рядок: date-pill (з ✕ для скидання) + ⚡ Опублікувати зараз.
                      Календар відкривається випадаючим меню під date-pill —
                      компактний (240px), щоб не розпирав панель. */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          ref={dateTriggerRef}
                          onClick={() => setDatePickerOpen(o => !o)}
                          className={`flex-1 min-w-0 inline-flex items-center justify-between gap-2 px-3 py-2 text-[12px] rounded-lg border transition-colors ${
                            dark
                              ? 'bg-white/[0.06] text-amber-100 border-amber-300/30 hover:border-amber-300/60'
                              : 'bg-white text-amber-900 border-amber-500/40 hover:border-amber-700'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <span aria-hidden>📅</span>
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
                            title="Прибрати дату — чернетка чекатиме ручної публікації"
                            className={`flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors text-[11px] ${
                              dark
                                ? 'bg-white/[0.04] text-amber-200 border-white/[0.10] hover:bg-white/[0.10]'
                                : 'bg-white/70 text-amber-800 border-stone-300/60 hover:bg-white'
                            }`}
                          >✕</button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStagedConfirm('publishNow')}
                        disabled={stagedActionPending !== null}
                        title="Опублікувати чернетку негайно (без очікування дати)"
                        className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg transition-all disabled:opacity-50 ${
                          dark
                            ? 'bg-emerald-400/90 text-stone-900 hover:bg-emerald-300 shadow-[0_0_14px_-4px_rgba(16,185,129,0.5)]'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}
                      >{stagedActionPending === 'publishNow' ? '...' : '⚡ Опублікувати зараз'}</button>
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
                          value={scheduleInput}
                          onChange={(v) => { setScheduleInput(v); setDatePickerOpen(false); }}
                          theme={theme}
                          min={minDate}
                        />
                        <p className={`px-2.5 pb-2 -mt-1 text-[10px] leading-snug ${dark ? 'text-amber-200/55' : 'text-amber-800/65'}`}>
                          Заміна вранці обраного дня (06:00 Київ).
                        </p>
                      </div>,
                      document.body,
                    )}
                  </div>

                </div>

                {/* Footer-панель: зліва — destructive «Очистити чернетку»
                    (рідкісна дія, але має бути доступна), справа — основний CTA
                    «Редагувати наступну». */}
                <div className={`px-5 py-3 border-t flex flex-col gap-2 ${
                  dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-amber-500/20 bg-amber-50/50'
                }`}>
                  {/* Primary CTA — повну ширину зверху */}
                  <Link
                    href="/dashboard/admin/news/page-builder/next"
                    className={`group relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden border whitespace-nowrap ${
                      dark
                        ? 'bg-amber-400/15 border-amber-300/60 text-amber-200 hover:bg-amber-400/25 hover:shadow-[0_0_18px_-4px_rgba(251,191,36,0.45)]'
                        : 'bg-amber-100/80 border-amber-700/50 text-amber-900 hover:bg-amber-100 hover:shadow-[0_4px_14px_-6px_rgba(180,83,9,0.35)]'
                    }`}
                    title="Редагувати чернетку наступної сторінки"
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
                        dark ? 'bg-amber-300/20' : 'bg-amber-300/30'
                      }`}
                    />
                    <span aria-hidden className="relative text-[11px]">{'🕒'}</span>
                    <span className="relative">Редагувати наступну</span>
                  </Link>
                  {/* Secondary row: Превʼю + Очистити, 50/50 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPagePreviewSource({ kind: 'next' })}
                      title="Превʼю чернетки наступної сторінки"
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium border transition-colors ${
                        dark
                          ? 'bg-white/[0.04] text-amber-200 border-white/[0.10] hover:bg-white/[0.10]'
                          : 'bg-white/70 text-amber-900 border-amber-700/40 hover:bg-white'
                      }`}
                    >
                      <span aria-hidden>👁</span>
                      <span>Превʼю</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStagedConfirm('discard')}
                      disabled={stagedActionPending !== null}
                      title="Видалити чернетку: контент і дату публікації буде стерто"
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium border transition-colors disabled:opacity-50 ${
                        dark
                          ? 'bg-rose-500/10 text-rose-200 border-rose-400/30 hover:bg-rose-500/20'
                          : 'bg-rose-100/60 text-rose-800 border-rose-300/60 hover:bg-rose-100'
                      }`}
                    >{stagedActionPending === 'discard' ? '...' : 'Очистити чернетку'}</button>
                  </div>
                </div>
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

      {/* ─── Підсекція 3: АРХІВ замінених версій ─── */}
      {(archive && archive.length > 0) && (
        <>
          <div className={`flex items-center gap-2 mb-2.5 mt-6 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
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
                    <button
                      type="button"
                      onClick={() => setPagePreviewSource({ kind: 'archive', id: entry.id, archivedAt: entry.archivedAt })}
                      title="Превʼю архівної версії"
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-[11px] font-medium transition-colors ${
                        dark
                          ? 'bg-white/[0.04] text-slate-300 border-white/[0.10] hover:bg-white/[0.10] hover:text-slate-100'
                          : 'bg-white/70 text-stone-700 border-stone-300/60 hover:bg-white hover:text-stone-900'
                      }`}
                    >
                      <span aria-hidden>👁</span>
                      <span>Превʼю</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

        </aside>
        {/* ╰─ кінець лівої колонки ──────────────────────────────────────╯ */}

        {/* ╭─ ПРАВА КОЛОНКА: список новин — превʼю-картка + дані + дії в ОДНОМУ ряду ─╮
            Об'єднує функціонал колонок «Превʼю Новин» і «Новини» з попередньої
            версії: ліва частина ряду — реальний рендер `previewContent` через
            AbsoluteBlockRender (1-в-1 з білдером і публічним /news), права —
            title/excerpt/date + action-row. Зв'язок «картка ↔ новина» очевидний. */}
        <section className="min-w-0">
          {/* ─── Секція ШАБЛОНИ ─── */}
          {/* Шаблони — зверстані заготовки «Превʼю + Новина», які менеджер
              наповнює інформацією. Структура попередньо професійно дизайнерська
              (editorial article + event announcement) — досить замінити плейсхолдери
              на власний текст/фото. Edit-кнопки відкривають ті ж білдери, що й
              у новин: /[id]/preview для превʼю-картки і /[id]/edit для контенту. */}
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-10">
            {templates.map((tpl) => {
              const kind = (tpl.templateKind || 'ARTICLE') as TemplateKind;
              const data = parseTemplateData(kind, tpl.templateData);
              const cleanTitle = tpl.title.replace(/^\[Шаблон\]\s*/i, '');
              const children = templateNews.filter(tn => tn.templateKind === kind);
              const childrenPub = children.filter(c => c.published).length;
              const isEvent = kind === 'EVENT';
              // Розмір preview blueprint-а у вузькій колонці: компактніше, ніж було.
              // ARTICLE — портрет 180×200, EVENT — горизонтал 240×160.
              const bpPreviewW = isEvent ? 240 : 180;
              const bpPreviewH = isEvent
                ? Math.round(bpPreviewW * (400 / 600))
                : Math.round(bpPreviewW * (PREVIEW_CARD_HEIGHT / PREVIEW_CARD_WIDTH));
              return (
                <div key={tpl.id} className="flex flex-col">
                  {/* ── BLUEPRINT card (full width, key visual для родини) ── */}
                  <article
                    className={`rounded-2xl border transition-all ${
                      dark
                        ? 'bg-sky-400/[0.04] border-sky-300/20 hover:border-sky-300/40'
                        : 'bg-sky-50/65 border-sky-300/45 hover:border-sky-500/55'
                    }`}
                  >
                    <header className="flex items-center gap-2.5 px-4 pt-3 pb-2.5 min-w-0">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[14px] flex-shrink-0 ${
                        dark
                          ? 'bg-sky-400/15 border border-sky-300/25'
                          : 'bg-sky-100/80 border border-sky-600/25'
                      }`} aria-hidden>
                        {isEvent ? '🎟' : '📰'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[10px] font-bold tracking-[0.16em] uppercase ${
                          dark ? 'text-sky-300/85' : 'text-sky-700/80'
                        }`}>
                          Шаблон · Blueprint
                        </div>
                        <div className={`text-[15px] font-semibold leading-tight mt-0.5 ${
                          dark ? 'text-slate-100' : 'text-stone-900'
                        }`}>
                          {templateKindLabel(kind)}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 h-[24px] rounded-full text-[10px] font-semibold ${
                        dark
                          ? 'bg-sky-400/10 text-sky-200/90 border border-sky-300/20'
                          : 'bg-white/80 text-sky-800/85 border border-sky-600/20'
                      }`}>
                        <span aria-hidden>📂</span>
                        <span>{children.length} створено{children.length > 0 ? ` · ${childrenPub} на /news` : ''}</span>
                      </span>
                    </header>

                    <div className="flex gap-4 px-4 pb-4 items-stretch flex-wrap md:flex-nowrap">
                      {/* Preview blueprint-а — kind-aware (portrait/horizontal) */}
                      <div
                        className={`group/preview relative flex-shrink-0 rounded-xl overflow-hidden border ${
                          dark ? 'border-sky-300/20' : 'border-sky-300/40'
                        }`}
                        style={{
                          width: bpPreviewW,
                          height: bpPreviewH,
                          background: '#FFFFFF',
                        }}
                      >
                        <div className="w-full h-full" style={{ pointerEvents: 'none' }} aria-hidden>
                          <PreviewCardScale
                            baseWidth={isEvent ? 600 : PREVIEW_CARD_WIDTH}
                            baseHeight={isEvent ? 400 : PREVIEW_CARD_HEIGHT}
                            initialScale={1}
                          >
                            <TemplatePreviewCard kind={kind} data={data} />
                          </PreviewCardScale>
                        </div>
                      </div>

                      {/* Meta + actions */}
                      <div
                        className={`flex-1 min-w-0 rounded-xl border backdrop-blur-sm flex flex-col p-4 ${
                          dark
                            ? 'bg-white/[0.04] border-white/[0.08]'
                            : 'bg-white/85 border-stone-300/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-[15px] font-semibold leading-snug ${
                            dark ? 'text-slate-100' : 'text-stone-900'
                          }`}>
                            {cleanTitle}
                          </h3>
                          {tpl.excerpt && (
                            <p className={`mt-2 text-[12.5px] leading-relaxed line-clamp-3 ${
                              dark ? 'text-slate-400' : 'text-stone-500'
                            }`}>
                              {tpl.excerpt}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/admin/news/from-template', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ blueprintId: tpl.id }),
                                });
                                if (!res.ok) {
                                  const j = await res.json().catch(() => ({}));
                                  setToast({ message: j?.error || 'Не вдалось створити з шаблону', type: 'error' });
                                  return;
                                }
                                const j = await res.json();
                                window.location.href = `/dashboard/admin/news/${j.id}/template`;
                              } catch (e) {
                                setToast({ message: e instanceof Error ? e.message : 'Помилка мережі', type: 'error' });
                              }
                            }}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 h-10 text-[13px] font-semibold rounded-lg transition-all ${
                              dark
                                ? 'bg-sky-400/90 text-stone-900 hover:bg-sky-300 shadow-[0_0_16px_-4px_rgba(56,189,248,0.45)]'
                                : 'bg-sky-700 text-white hover:bg-sky-800 shadow-[0_2px_8px_-2px_rgba(2,132,199,0.35)]'
                            }`}
                          >
                            <FaPlus className="text-[11px]" />
                            Створити з шаблону
                          </button>
                          <Link
                            href={`/dashboard/admin/news/${tpl.id}/template`}
                            className={`inline-flex items-center justify-center gap-1.5 px-4 h-10 text-[12px] font-medium rounded-lg border transition-colors ${
                              dark
                                ? 'bg-white/[0.04] border-white/[0.10] text-slate-300 hover:bg-white/[0.10] hover:text-slate-100'
                                : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
                            }`}
                          >
                            <FaEdit className="text-[10px]" />
                            Дефолти
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>

                  {/* ── CHILDREN — створені з цього blueprint-у ── */}
                  {/* Indent + ліва акцентна смужка → візуально читається як children
                      tree. Empty state ненав'язливий. */}
                  <div
                    className={`relative ml-6 mt-3 pl-6 ${
                      dark ? 'border-l-2 border-sky-400/15' : 'border-l-2 border-sky-300/40'
                    }`}
                  >
                    {/* Connector "tee" — маленька горизонтальна риска від смужки до header-а */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-3 w-4 h-px ${
                        dark ? 'bg-sky-400/15' : 'bg-sky-300/40'
                      }`}
                    />
                    <div className={`flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      dark ? 'text-slate-500' : 'text-stone-500'
                    }`}>
                      <span>Створені з цього шаблону</span>
                      <span className={`font-normal opacity-70 normal-case tracking-normal text-[11px]`}>
                        · {children.length}
                      </span>
                    </div>

                    {children.length === 0 ? (
                      <div className={`rounded-xl border border-dashed px-4 py-5 text-[12px] ${
                        dark
                          ? 'border-white/[0.08] text-slate-500 bg-white/[0.02]'
                          : 'border-stone-300/60 text-stone-500 bg-white/40'
                      }`}>
                        Поки що нічого не створено. Натисни <strong>«+ Створити з шаблону»</strong> вище — заповнюй поля, і нова новина зʼявиться тут.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {children.map((tn) => {
                          const tnData = parseTemplateData(kind, tn.templateData);
                          const created = new Date(tn.createdAt);
                          const dateStr = created.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
                          const isPublished = !!tn.published;
                          // Дитяча preview-картка: kind-aware aspect, ширина адаптивна
                          const previewBaseW = isEvent ? 600 : PREVIEW_CARD_WIDTH;
                          const previewBaseH = isEvent ? 400 : PREVIEW_CARD_HEIGHT;
                          return (
                            <article
                              key={tn.id}
                              className={`group/tn rounded-xl border overflow-hidden flex flex-col transition-all ${
                                dark
                                  ? 'bg-white/[0.025] border-white/[0.08] hover:border-sky-400/35 hover:bg-white/[0.04]'
                                  : 'bg-white/85 border-stone-300/55 hover:border-sky-500/45 hover:bg-white'
                              }`}
                            >
                              {/* Preview thumbnail — натуральне співвідношення kind-у */}
                              <Link
                                href={`/dashboard/admin/news/${tn.id}/template`}
                                className="block relative w-full"
                                style={{ aspectRatio: `${previewBaseW} / ${previewBaseH}`, background: tn.pageBgColor || '#FFFFFF' }}
                                aria-label={`Редагувати «${tn.title}»`}
                              >
                                <div className="absolute inset-0" style={{ pointerEvents: 'none' }} aria-hidden>
                                  <PreviewCardScale
                                    baseWidth={previewBaseW}
                                    baseHeight={previewBaseH}
                                    initialScale={1}
                                  >
                                    <TemplatePreviewCard kind={kind} data={tnData} disableLinks />
                                  </PreviewCardScale>
                                </div>
                                {/* Status overlay — top-right */}
                                <span className={`absolute top-2 right-2 z-[1] inline-flex items-center gap-1 px-2 h-[20px] rounded-full text-[9px] font-bold uppercase tracking-[0.08em] backdrop-blur-md ${
                                  isPublished
                                    ? dark
                                      ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                                      : 'bg-emerald-500/85 text-white border border-emerald-600/40'
                                    : dark
                                      ? 'bg-amber-500/30 text-amber-100 border border-amber-400/40'
                                      : 'bg-amber-500/85 text-white border border-amber-600/40'
                                }`}>
                                  <span className={`inline-block w-1 h-1 rounded-full ${isPublished ? 'bg-emerald-300' : 'bg-amber-100'}`} />
                                  <span>{isPublished ? 'На /news' : 'Чернетка'}</span>
                                </span>
                              </Link>

                              {/* Body */}
                              <div className="flex flex-col gap-1.5 p-3 flex-1 min-h-0">
                                <h3 className={`text-[13.5px] font-semibold leading-snug line-clamp-2 ${
                                  dark ? 'text-slate-100' : 'text-stone-900'
                                }`} title={tn.title}>
                                  {tn.title}
                                </h3>
                                <div className={`text-[10.5px] inline-flex items-center gap-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                                  <FaCalendar className="text-[9px] opacity-70" />
                                  <span>{dateStr}</span>
                                  <span className="opacity-40">·</span>
                                  <span className="font-mono opacity-70 truncate">{tn.slug}</span>
                                </div>
                              </div>

                              {/* Footer-actions */}
                              <div className={`flex items-center gap-1.5 px-3 py-2 border-t ${
                                dark ? 'border-white/[0.06]' : 'border-stone-300/40'
                              }`}>
                                <Link
                                  href={`/dashboard/admin/news/${tn.id}/template`}
                                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 h-8 text-[12px] font-semibold rounded-md transition-all ${
                                    dark
                                      ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300'
                                      : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
                                  }`}
                                >
                                  <FaEdit className="text-[10px]" />
                                  Редагувати
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget({ id: tn.id, title: tn.title })}
                                  title="Видалити"
                                  aria-label="Видалити"
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${
                                    dark
                                      ? 'bg-rose-500/[0.08] border-rose-400/20 text-rose-300 hover:bg-rose-500/20'
                                      : 'bg-rose-50/60 border-rose-300/50 text-rose-700 hover:bg-rose-100'
                                  }`}
                                >
                                  <FaTrash className="text-[10px]" />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Секція НОВИНИ ─── */}
          {/* Section header: лейбл + лічильник + primary CTA «Створити новину». */}
          <div className={`flex items-center gap-3 mb-4 h-[36px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase whitespace-nowrap">
              Новини <span className={`font-normal opacity-70`}>· {news.length}</span>
            </span>
            <span className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-stone-300/60'}`} />
            <Link
              href="/dashboard/admin/news/new"
              className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden ${
                dark
                  ? 'bg-amber-400/90 text-stone-900 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)] hover:bg-amber-300 hover:shadow-[0_0_28px_-2px_rgba(251,191,36,0.65)]'
                  : 'bg-stone-900 text-amber-100 shadow-sm hover:bg-stone-800 hover:shadow-[0_6px_18px_-6px_rgba(41,37,36,0.35)]'
              }`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
                  dark ? 'bg-white/30' : 'bg-amber-200/30'
                }`}
              />
              <FaPlus className="relative text-[11px]" />
              <span className="relative">Створити новину</span>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div
                className={`w-10 h-10 border-2 rounded-full animate-spin ${
                  dark ? 'border-white/[0.1] border-t-amber-300' : 'border-stone-200 border-t-amber-600'
                }`}
              />
            </div>
          ) : filtered.length === 0 ? (
            <AdminPanel theme={theme} className="py-16 text-center">
              <p className={`mb-5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Новин ще немає</p>
              <Link
                href="/dashboard/admin/news/new"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
                  dark
                    ? 'bg-amber-400/90 text-stone-900 shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)] hover:bg-amber-300'
                    : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
                }`}
              >
                <FaPlus /> Створити першу новину
              </Link>
            </AdminPanel>
          ) : (
            <>
              {/* NEWS_BLOCK_CSS injectиться раз — забезпечує типографічну парність
                  превʼю-картки в адмінці та публічного `/news`. */}
              <style>{NEWS_BLOCK_CSS}</style>
              {/* Grid пар: на xl — 2 пари в ряду. Великий gap (8/7) між парами —
                  щоб око одразу читало їх як окремі групи. Всередині пари — інша
                  візуальна логіка: outer frame з фоном, маленький gap між sub-cards. */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-7 gap-y-6">
                {filtered.map((item, idx) => {
                  const date = new Date(item.createdAt);
                  const dateStr = date.toLocaleDateString('uk-UA');
                  const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                  const excerptText = item.excerpt && item.excerpt.trim();
                  const parsed = parseBlocks(item.previewContent || '');
                  const hasPreview = parsed.isJson && parsed.blocks.length > 0;
                  const cardBg = item.pageBgColor || '#FFFFFF';
                  // Двозначний номер ("01", "02") — читається як артикул/ID, навіть
                  // коли новин > 9. Допомагає менеджеру referencing-ом усно.
                  const pairNum = String(idx + 1).padStart(2, '0');

                  // Template-based новина: рендер preview автоматично з templateData,
                  // edit-кнопка веде на form-based template editor.
                  const isTemplateNews = !!item.templateKind;
                  const tplKind = item.templateKind as TemplateKind | null;
                  const tplData = isTemplateNews && tplKind
                    ? parseTemplateData(tplKind, item.templateData)
                    : null;
                  const editHref = isTemplateNews
                    ? `/dashboard/admin/news/${item.id}/template`
                    : `/dashboard/admin/news/${item.id}/edit`;
                  const previewEditHref = isTemplateNews
                    ? `/dashboard/admin/news/${item.id}/template`
                    : `/dashboard/admin/news/${item.id}/preview`;

                  // Висота sub-cards. 220 дає preview візуальну вагу, та чітку
                  // ритмічну сітку рядків з 2 пар.
                  const PAIR_H = 220;

                  return (
                    <article
                      key={item.id}
                      className={`group/pair rounded-2xl border transition-all ${
                        dark
                          ? 'bg-white/[0.025] border-white/[0.06] hover:border-amber-400/35 hover:bg-white/[0.04]'
                          : 'bg-stone-100/55 border-stone-300/55 hover:border-amber-500/40 hover:bg-stone-50/80'
                      }`}
                    >
                      {/* ── HEADER пари: номер + назва + pill «Картка» справа ── */}
                      {/* Pair-header читається як "обкладинка" групи: "Новина №01 ·
                          День міста". Звідси одразу зрозуміло, ЩО за пара під ним.
                          Пілл «Картка» — в правому-верхньому куті блока, як акцент-метка. */}
                      <header className="flex items-center gap-2.5 px-3.5 pt-2.5 pb-2 min-w-0">
                        <span className={`inline-flex items-center justify-center px-2 h-[22px] rounded-md text-[10px] font-bold tracking-[0.06em] flex-shrink-0 ${
                          dark
                            ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                            : 'bg-amber-100/80 text-amber-800 border border-amber-600/25'
                        }`}>
                          № {pairNum}
                        </span>
                        <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] ${
                          dark ? 'text-slate-500' : 'text-stone-400'
                        }`}>
                          Новина
                        </span>
                        <span className={`flex-1 truncate text-[12px] font-medium ${
                          dark ? 'text-slate-300' : 'text-stone-700'
                        }`} title={item.title}>
                          {item.title}
                        </span>
                        {isTemplateNews && tplKind && (
                          <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 h-[22px] rounded-md text-[9px] font-bold uppercase tracking-[0.1em] ${
                            dark
                              ? 'bg-sky-400/15 text-sky-200 border border-sky-300/25'
                              : 'bg-sky-50/80 text-sky-800 border border-sky-600/25'
                          }`}>
                            <span aria-hidden>{tplKind === 'ARTICLE' ? '📰' : '🎟'}</span>
                            <span>{templateKindLabel(tplKind)}</span>
                          </span>
                        )}
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 h-[22px] rounded-md text-[9px] font-bold uppercase tracking-[0.1em] ${
                          dark
                            ? 'bg-stone-900/40 text-amber-200 border border-amber-300/25'
                            : 'bg-amber-50/80 text-amber-800 border border-amber-600/25'
                        }`}>
                          <span aria-hidden>🃏</span>
                          <span>Картка</span>
                        </span>
                      </header>

                      {/* ── BODY пари: preview + news ── */}
                      {/* gap-2.5 (10px) — мала «щілина» між sub-cards, щоб видно
                          було що це 2 елементи, але вони «під одним дахом». */}
                      <div className="flex gap-2.5 px-2.5 pb-2.5" style={{ minHeight: PAIR_H }}>
                        {/* ── ПРЕВ'Ю sub-card ── */}
                        <div
                          className={`group/preview relative flex-shrink-0 rounded-xl overflow-hidden border transition-all ${
                            dark
                              ? 'border-white/[0.08] hover:border-amber-400/55 hover:shadow-[0_10px_28px_-12px_rgba(251,191,36,0.30)]'
                              : 'border-stone-300/55 hover:border-amber-500/55 hover:shadow-[0_10px_28px_-12px_rgba(180,83,9,0.25)]'
                          }`}
                          style={{
                            height: PAIR_H,
                            aspectRatio: `${PREVIEW_CARD_WIDTH} / ${PREVIEW_CARD_HEIGHT}`,
                            background: cardBg,
                          }}
                        >
                          {isTemplateNews && tplKind && tplData ? (
                            <div className="w-full h-full" style={{ pointerEvents: 'none' }} aria-hidden>
                              <PreviewCardScale
                                baseWidth={PREVIEW_CARD_WIDTH}
                                baseHeight={PREVIEW_CARD_HEIGHT}
                                initialScale={1}
                              >
                                <TemplatePreviewCard kind={tplKind} data={tplData} disableLinks />
                              </PreviewCardScale>
                            </div>
                          ) : hasPreview ? (
                            <div className="w-full h-full" style={{ pointerEvents: 'none' }} aria-hidden>
                              <PreviewCardScale
                                baseWidth={PREVIEW_CARD_WIDTH}
                                baseHeight={PREVIEW_CARD_HEIGHT}
                                initialScale={1}
                              >
                                {parsed.blocks.map((b) => (
                                  <AbsoluteBlockRender key={b.id} block={b} locale="uk" />
                                ))}
                              </PreviewCardScale>
                            </div>
                          ) : (
                            <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 text-center px-3 ${
                              dark ? 'bg-amber-500/[0.04]' : 'bg-amber-50/50'
                            }`}>
                              <span aria-hidden className="text-[28px] leading-none">🃏</span>
                              <p className={`text-[11px] font-semibold leading-snug ${dark ? 'text-amber-200' : 'text-amber-900'}`}>
                                Превʼю не зверстано
                              </p>
                              <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                dark ? 'text-amber-300' : 'text-amber-700'
                              }`}>
                                Відкрити білдер →
                              </span>
                            </div>
                          )}

                          {/* Invisible Link — клік по всій картці → відповідний редактор. */}
                          <Link
                            href={previewEditHref}
                            aria-label={`Редагувати «${item.title}»`}
                            title={isTemplateNews ? 'Відкрити шаблонний редактор' : 'Редагувати превʼю-картку'}
                            className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 rounded-xl"
                          />

                          {/* Floating fullscreen-кнопка — top-right preview canvas-у
                              (підпис «Картка» тепер в header-і пари, не дублюємо). */}
                          <button
                            type="button"
                            onClick={() => setItemPreview({ kind: 'card', slug: item.slug, title: item.title })}
                            title="Переглянути картку у контексті /news"
                            aria-label="Превʼю у /news"
                            className={`absolute top-2 right-2 z-[2] inline-flex items-center justify-center w-7 h-7 rounded-lg border backdrop-blur-md transition-all opacity-0 group-hover/preview:opacity-100 focus:opacity-100 ${
                              dark
                                ? 'bg-stone-900/70 border-white/15 text-white/90 hover:bg-stone-900/90 hover:border-amber-300/50 hover:text-amber-200'
                                : 'bg-white/85 border-stone-900/15 text-stone-800 hover:bg-white hover:border-amber-600/45 hover:text-amber-800'
                            }`}
                          >
                            <FaExpand className="text-[10px]" />
                          </button>
                        </div>

                        {/* ── НОВИНА sub-card ── */}
                        <div
                          className={`flex-1 min-w-0 rounded-xl border backdrop-blur-sm transition-all flex flex-col ${
                            dark
                              ? 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
                              : 'bg-white/85 border-stone-300/50 hover:bg-white hover:border-stone-300/80'
                          }`}
                          style={{ height: PAIR_H }}
                        >
                          <div className="flex-1 min-w-0 px-4 pt-3.5 pb-2 flex flex-col">
                            <h3
                              className={`text-[15px] font-semibold leading-snug line-clamp-2 ${
                                dark ? 'text-slate-100' : 'text-stone-900'
                              }`}
                            >
                              {item.title}
                            </h3>
                            {excerptText && (
                              <p className={`mt-1.5 text-[12px] leading-snug line-clamp-2 ${
                                dark ? 'text-slate-400' : 'text-stone-500'
                              }`}>
                                {excerptText}
                              </p>
                            )}
                            <div className={`mt-auto inline-flex items-center gap-1.5 text-[11px] ${
                              dark ? 'text-slate-500' : 'text-stone-400'
                            }`}>
                              <FaCalendar className="text-[9px] opacity-70" />
                              {dateStr} · {timeStr}
                            </div>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-2.5 border-t ${
                            dark ? 'border-white/[0.06]' : 'border-stone-300/40'
                          }`}>
                            <Link
                              href={editHref}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-9 text-[12.5px] font-semibold rounded-lg transition-all ${
                                dark
                                  ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_16px_-4px_rgba(251,191,36,0.50)]'
                                  : 'bg-stone-900 text-amber-100 hover:bg-stone-800 shadow-[0_2px_8px_-2px_rgba(28,37,38,0.30)]'
                              }`}
                            >
                              <FaEdit className="text-[11px]" />
                              Редагувати
                            </Link>
                            <button
                              type="button"
                              onClick={() => setItemPreview({ kind: 'article', slug: item.slug, title: item.title })}
                              title="Переглянути сторінку статті /news/{slug}"
                              aria-label="Превʼю статті"
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                                dark
                                  ? 'bg-white/[0.04] border-white/[0.10] text-slate-300 hover:bg-white/[0.10] hover:text-slate-100'
                                  : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
                              }`}
                            >
                              <FaExpand className="text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                              title="Видалити новину"
                              aria-label="Видалити новину"
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                                dark
                                  ? 'bg-rose-500/[0.08] border-rose-400/20 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200'
                                  : 'bg-rose-50/60 border-rose-300/50 text-rose-700 hover:bg-rose-100 hover:text-rose-900'
                              }`}
                            >
                              <FaTrash className="text-[11px]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
        {/* ╰─ кінець правої колонки ─────────────────────────────────────╯ */}
      </div>

      {/* Fullscreen-превʼю «Поточної сторінки». Рендериться 1-в-1 публічний
          /news через NewsPagePreview (auto-scale до доступної ширини). Esc /
          клік по бекдропу / X — закривають. */}
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
            className="flex-1 overflow-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="mx-auto rounded-lg overflow-hidden shadow-2xl"
              style={{ maxWidth: '1280px', background: '#FFFFFF' }}
            >
              <NewsPagePreview
                source={pagePreviewSource.kind}
                archiveId={pagePreviewSource.kind === "archive" ? pagePreviewSource.id : undefined}
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
