'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaImage,
  FaChevronDown,
  FaExpand,
  FaTimes,
} from 'react-icons/fa';
import { useAdminTheme } from '../_components/adminTheme';
import { AdminShell, AdminPanel } from '../_components/AdminShell';
import NewsPagePreview from './_components/NewsPagePreview';
import InlineDatePicker, { formatDateChip } from '../_components/InlineDatePicker';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  category: string;
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
  createdAt: string;
  author?: { name: string | null };
}


function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface ContentBlock {
  id: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

function flattenBlocks(content: string): ContentBlock[] {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed.flatMap((item: any) => (item.blocks ? item.blocks : [item]));
  } catch {
    return [];
  }
}

function parseContentPreview(content: string): { text: string; firstImage: string | null } {
  const blocks = flattenBlocks(content);
  if (blocks.length === 0) {
    return { text: stripHtml(content).slice(0, 500), firstImage: null };
  }

  const textParts: string[] = [];
  let firstImage: string | null = null;

  for (const block of blocks) {
    if (!block.data) continue;
    if (['heading', 'text', 'hero', 'quote'].includes(block.type) && block.data.text) {
      textParts.push(stripHtml(block.data.text));
    }
    if (block.data.html) {
      textParts.push(stripHtml(block.data.html));
    }
    if (block.type === 'image' && block.data.url && !firstImage) {
      firstImage = block.data.url;
    }
    if (block.type === 'gallery' && block.data.images?.length && !firstImage) {
      firstImage = block.data.images[0].url || block.data.images[0];
    }
  }

  return { text: textParts.join(' ').slice(0, 500), firstImage };
}

export default function AdminNewsPage() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Стан публікації сторінки /news (NewsPage.published) + локальний toggle.
  const [pagePublished, setPagePublished] = useState<boolean | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [pagePreviewOpen, setPagePreviewOpen] = useState(false);

  // Превʼю окремої новини — або превʼю-картки в контексті /news, або
  // повної сторінки статті /news/{slug}. Iframe-режим — точна копія
  // публічного рендера (без drift).
  const [itemPreview, setItemPreview] = useState<
    | { kind: 'card' | 'article'; slug: string; title: string }
    | null
  >(null);

  // Esc + body-scroll lock для будь-якої з двох превʼю-модалок.
  const anyModalOpen = pagePreviewOpen || itemPreview !== null;
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (itemPreview) setItemPreview(null);
      else if (pagePreviewOpen) setPagePreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [anyModalOpen, pagePreviewOpen, itemPreview]);

  // Staged ("Наступна сторінка") стан — для countdown і дій у адмінці.
  // `publishOn` — Київ-календарна дата (YYYY-MM-DD); час фіксований 06:00 Київ.
  const [staged, setStaged] = useState<{ hasStaged: boolean; publishOn: string | null; nextUpdatedAt: string | null } | null>(null);
  const [stagedActionPending, setStagedActionPending] = useState<null | 'publishNow' | 'discard'>(null);
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
  }, []);

  const publishStagedNow = async () => {
    if (!confirm('Опублікувати наступну сторінку зараз? Поточна live-версія буде замінена.')) return;
    setStagedActionPending('publishNow');
    try {
      const res = await fetch('/api/admin/news/page-content/next', { method: 'POST' });
      if (res.ok) {
        setToast({ message: 'Опубліковано — наступна сторінка стала live', type: 'success' });
        refreshStaged();
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
    if (!confirm('Очистити чернетку «Наступної сторінки»? Контент і дату публікації буде видалено.')) return;
    setStagedActionPending('discard');
    try {
      const res = await fetch('/api/admin/news/page-content/next', { method: 'DELETE' });
      if (res.ok) {
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
        const r = await fetch('/api/admin/news');
        if (!r.ok) throw new Error('Не вдалося завантажити новини');
        const d = await r.json();
        setNews(Array.isArray(d) ? d : []);
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
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося видалити', type: 'error' });
        return;
      }
      setNews(news.filter(n => n.id !== id));
      setToast({ message: 'Новину видалено', type: 'success' });
      setDeleteTarget(null);
    } catch {
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

      {/* Триколонковий лейаут (xl+) з ОДНАКОВОЮ шириною всіх трьох колонок.
            — зліва: операції зі сторінкою /news (live + staged);
            — посередині: «Превʼю Новин» — список карток-превʼю (`/[id]/preview`);
            — справа: «Новини» — список новин (`/[id]/edit`).
          На вузьких екранах (<1280px) стек в одну колонку. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
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

        {/* Footer-панель: зліва — Активувати/Деактивувати (toggle видимості
            сторінки на сайті), справа — основний CTA «Редагувати поточну». */}
        <div className={`px-5 py-3 border-t flex items-center justify-between gap-3 ${
          dark ? 'border-white/[0.04] bg-white/[0.015]' : 'border-stone-200/50 bg-white/40'
        }`}>
          <button
            type="button"
            onClick={togglePagePublish}
            disabled={pagePublished === null || togglingPublish}
            title={pagePublished ? 'Прибрати сторінку з сайту (показуватиметься empty state)' : 'Показати сторінку на сайті'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium border transition-colors disabled:opacity-50 ${
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
          <Link
            href="/dashboard/admin/news/page-builder"
            className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden border ${
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
                        onClick={publishStagedNow}
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
                <div className={`px-5 py-3 border-t flex items-center justify-between gap-3 ${
                  dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-amber-500/20 bg-amber-50/50'
                }`}>
                  <button
                    type="button"
                    onClick={discardStaged}
                    disabled={stagedActionPending !== null}
                    title="Видалити чернетку: контент і дату публікації буде стерто"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium border transition-colors disabled:opacity-50 ${
                      dark
                        ? 'bg-rose-500/10 text-rose-200 border-rose-400/30 hover:bg-rose-500/20'
                        : 'bg-rose-100/60 text-rose-800 border-rose-300/60 hover:bg-rose-100'
                    }`}
                  >{stagedActionPending === 'discard' ? '...' : 'Очистити чернетку'}</button>
                  <Link
                    href="/dashboard/admin/news/page-builder/next"
                    className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden border ${
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

        </aside>
        {/* ╰─ кінець лівої колонки ──────────────────────────────────────╯ */}

        {/* ╭─ СЕРЕДНЯ КОЛОНКА: «Превʼю Новин» — компактний список карток ─╮
            Кожен item → preview-only білдер (`/[id]/preview`).
            Тут НЕ дублюємо повну функціональність правої колонки (категорії,
            статуси, видалення) — це окремий focus на редагуванні картки. */}
        <section className="min-w-0">
          {/* h-[36px] mb-4 — синхронізована висота section-header-а з правою
              колонкою (де є CTA-pill «Створити новину»), щоб ряди обох
              списків стартували на одному baseline-і. */}
          <div className={`flex items-center gap-3 mb-4 h-[36px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase whitespace-nowrap">
              Превʼю Новин <span className={`font-normal opacity-70`}>· {news.length}</span>
            </span>
            <span className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-stone-300/60'}`} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className={`w-8 h-8 border-2 rounded-full animate-spin ${
                  dark ? 'border-white/[0.1] border-t-amber-300' : 'border-stone-200 border-t-amber-600'
                }`}
              />
            </div>
          ) : news.length === 0 ? (
            <AdminPanel theme={theme} className="py-10 text-center">
              <p className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Спочатку створіть новину справа, потім зможете відредагувати її превʼю.
              </p>
            </AdminPanel>
          ) : (
            // space-y-3 + h-[124px] на кожному item-і — синхронізуємось 1-в-1
            // з блоком «Новини» (той самий gap і висота рядка), щоб картки
            // у двох колонках зливались у пари по горизонталі.
            <div className="space-y-3">
              {news.map(item => {
                const { firstImage: contentImage } = parseContentPreview(item.content);
                const thumbnail = item.imageUrl || contentImage;
                return (
                  <Link
                    key={item.id}
                    href={`/dashboard/admin/news/${item.id}/preview`}
                    title="Редагувати превʼю-картку цієї новини"
                    className={`group relative flex items-center gap-3 px-4 rounded-xl border backdrop-blur-sm transition-all h-[124px] ${
                      dark
                        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-amber-400/30'
                        : 'bg-white/60 border-stone-300/50 hover:bg-white/85 hover:border-amber-500/40 hover:shadow-[0_2px_10px_-4px_rgba(180,83,9,0.18)]'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-28 aspect-video rounded-lg overflow-hidden border ${
                        dark
                          ? 'bg-white/[0.04] border-white/[0.08]'
                          : 'bg-stone-100/70 border-stone-300/60'
                      }`}
                    >
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
                          <FaImage size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-[12px] font-semibold leading-snug line-clamp-2 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                        {item.title}
                      </h3>
                      <span className={`mt-0.5 inline-block text-[10px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
                        {new Date(item.createdAt).toLocaleDateString('uk-UA')}
                      </span>
                    </div>
                    {/* «Превʼю» — окрема кнопка, відкриває fullscreen iframe
                        сторінки /news (картка показується в реальному контексті
                        списку). Stop-propagation щоб не тригерити Link. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setItemPreview({ kind: 'card', slug: item.slug, title: item.title });
                      }}
                      title="Переглянути картку у контексті /news"
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border transition-all text-[11px] font-medium ${
                        dark
                          ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.10] hover:text-slate-100'
                          : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
                      }`}
                    >
                      <FaExpand className="text-[9px]" />
                      Превʼю
                    </button>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        {/* ╰─ кінець середньої колонки ──────────────────────────────────╯ */}

        {/* ╭─ ПРАВА КОЛОНКА: список новин + дії над новинами ─────────────╮ */}
        <section className="min-w-0">
          {/* Section header: лейбл + лічильник + CTA "Створити новину" в одному рядку.
              h-[36px] — щоб збігалось з section-header-ом блоку «Превʼю Новин». */}
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
        <div className="space-y-3">
          {filtered.map(item => {
            const date = new Date(item.createdAt);
            const dateStr = date.toLocaleDateString('uk-UA');
            const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={item.id}
                // h-[124px] — синхронізована висота з картками блоку
                // «Превʼю Новин» зліва (щоб пари вирівнювались по горизонталі).
                className={`rounded-xl border backdrop-blur-sm transition-all h-[124px] ${
                  dark
                    ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                    : 'bg-white/60 border-stone-300/50 hover:bg-white/80 hover:border-stone-300/70'
                }`}
              >
                <div className="flex items-center gap-4 px-5 h-full">
                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-[13px] font-semibold leading-snug line-clamp-2 ${
                        dark ? 'text-slate-100' : 'text-stone-900'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <div className="mt-0.5">
                      <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
                        {dateStr} {timeStr}
                      </span>
                    </div>
                  </div>

                  {/* Actions stack — Превʼю + Редагувати + Видалити. */}
                  <div className="flex flex-col gap-1.5 items-stretch w-[140px] flex-shrink-0">
                    <Link
                      href={`/dashboard/admin/news/${item.id}/edit`}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                        dark
                          ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_14px_-4px_rgba(251,191,36,0.5)]'
                          : 'bg-stone-900 text-amber-100 hover:bg-stone-800 shadow-sm'
                      }`}
                    >
                      <FaEdit className="text-[10px]" />
                      Редагувати
                    </Link>
                    <button
                      type="button"
                      onClick={() => setItemPreview({ kind: 'article', slug: item.slug, title: item.title })}
                      title="Переглянути сторінку статті /news/{slug} у повноекранному превʼю"
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                        dark
                          ? 'bg-white/[0.04] border-white/[0.10] text-slate-200 hover:bg-white/[0.10]'
                          : 'bg-white/70 border-stone-300/60 text-stone-800 hover:bg-white'
                      }`}
                    >
                      <FaExpand className="text-[10px]" />
                      Превʼю
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                        dark
                          ? 'bg-rose-500/10 text-rose-200 border-rose-400/25 hover:bg-rose-500/20'
                          : 'bg-rose-200/40 text-rose-800 border-rose-500/30 hover:bg-rose-200/70'
                      }`}
                    >
                      <FaTrash className="text-[10px]" />
                      Видалити
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </section>
        {/* ╰─ кінець правої колонки ─────────────────────────────────────╯ */}
      </div>

      {/* Fullscreen-превʼю «Поточної сторінки». Рендериться 1-в-1 публічний
          /news через NewsPagePreview (auto-scale до доступної ширини). Esc /
          клік по бекдропу / X — закривають. */}
      {pagePreviewOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-stone-900/85 backdrop-blur-md"
          onClick={() => setPagePreviewOpen(false)}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3 text-white/90">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase">
                Превʼю · /news
              </span>
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
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPagePreviewOpen(false); }}
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
              <NewsPagePreview />
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
