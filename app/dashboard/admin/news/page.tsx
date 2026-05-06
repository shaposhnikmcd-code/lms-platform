'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaImage,
  FaChevronDown,
} from 'react-icons/fa';
import { useAdminTheme } from '../_components/adminTheme';
import { AdminShell, AdminPanel } from '../_components/AdminShell';
import NewsPublishButton from './_components/NewsPublishButton';
import CategoryPicker from './_components/CategoryPicker';
import StatusPicker from './_components/StatusPicker';
import ScheduledTimerPill from './_components/ScheduledTimerPill';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { parseBlocks } from '@/lib/news/render';
import ScaledNewsPreview from '@/lib/news/ScaledNewsPreview';
import NewsPagePreview from './_components/NewsPagePreview';

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

// Експанд-превью новини в адмін-списку рендериться через <ScaledNewsPreview/>
// (lib/news/ScaledNewsPreview.tsx) — це точна копія public-рендера, масштабована
// під доступну ширину картки. НЕ повертай сюди локальний рендер — він drift-итиме
// від builder/public. Рендер блоків — у lib/news/render.tsx.

export default function AdminNewsPage() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Стан публікації сторінки /news (NewsPage.published) + локальний toggle.
  const [pagePublished, setPagePublished] = useState<boolean | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [pagePreviewOpen, setPagePreviewOpen] = useState(false);

  // Staged ("Наступна сторінка") стан — для countdown і дій у адмінці.
  const [staged, setStaged] = useState<{ hasStaged: boolean; publishAt: string | null; nextUpdatedAt: string | null } | null>(null);
  const [stagedActionPending, setStagedActionPending] = useState<null | 'publishNow' | 'discard'>(null);
  // Inline пікер дати публікації (datetime-local). Зберігається з debounce
  // ~700мс після останньої зміни — без зайвих кнопок "Save".
  const [scheduleInput, setScheduleInput] = useState<string>('');
  const [scheduleSaveState, setScheduleSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const scheduleDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live tick для countdown — оновлюємо раз на хвилину (точність достатня).
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Helpers для datetime-local <-> ISO. datetime-local не приймає TZ —
  // менеджер працює в локальній зоні, БД зберігає UTC.
  const isoToLocalInput = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const localInputToIso = (s: string): string | null => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const refreshStaged = () => {
    fetch('/api/admin/news/page-content/next')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.hasStaged) {
          setStaged({ hasStaged: true, publishAt: d.publishAt, nextUpdatedAt: d.nextUpdatedAt });
          setScheduleInput(isoToLocalInput(d.publishAt));
        } else {
          setStaged({ hasStaged: false, publishAt: null, nextUpdatedAt: null });
          setScheduleInput('');
        }
      })
      .catch(() => setStaged({ hasStaged: false, publishAt: null, nextUpdatedAt: null }));
  };

  // Auto-save scheduleInput з debounce 700мс. Не запускається на перший рендер
  // (коли input ще порожній і staged ще не завантажений).
  const lastSavedScheduleRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!staged?.hasStaged) return;
    const targetIso = localInputToIso(scheduleInput);
    const currentSavedIso = staged.publishAt;
    if (targetIso === currentSavedIso) return;
    if (lastSavedScheduleRef.current === targetIso) return;
    if (scheduleDebounceRef.current) clearTimeout(scheduleDebounceRef.current);
    scheduleDebounceRef.current = setTimeout(async () => {
      setScheduleSaveState('saving');
      try {
        const res = await fetch('/api/admin/news/page-content/next', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publishAt: targetIso }),
        });
        if (res.ok) {
          lastSavedScheduleRef.current = targetIso;
          setStaged(s => s ? { ...s, publishAt: targetIso } : s);
          setScheduleSaveState('saved');
          setTimeout(() => setScheduleSaveState('idle'), 1500);
        } else {
          const body = await res.json().catch(() => ({}));
          setToast({ message: body?.error || 'Не вдалось зберегти час', type: 'error' });
          setScheduleSaveState('idle');
        }
      } catch {
        setToast({ message: 'Помилка мережі при збереженні часу', type: 'error' });
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
    if (!confirm('Видалити чернетку наступної сторінки?')) return;
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

  const updateNewsLocal = (id: string, patch: Partial<NewsItem>) => {
    setNews(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
  };

  const changeCategory = async (id: string, oldCategory: string, next: string) => {
    if (next === oldCategory) return;
    updateNewsLocal(id, { category: next });
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: next }),
      });
      if (!res.ok) {
        updateNewsLocal(id, { category: oldCategory });
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося змінити категорію', type: 'error' });
      }
    } catch {
      updateNewsLocal(id, { category: oldCategory });
      setToast({ message: 'Помилка запиту', type: 'error' });
    }
  };

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
      if (expandedId === id) setExpandedId(null);
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
      maxWidth="max-w-7xl"
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

      {/* Двоколонковий лейаут (lg+): зліва — операції зі сторінкою /news,
          справа — список новин. На вузьких екранах стекаємо в одну колонку. */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
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
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase">Поточна сторінка</span>
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

            {/* Header — клік розгортає інлайн-превʼю; chevron-індикатор наявний */}
            <div
              className={`flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${
                dark ? 'hover:bg-white/[0.02]' : 'hover:bg-white/40'
              }`}
              onClick={() => setPagePreviewOpen(o => !o)}
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
                  onClick={togglePagePublish}
                  disabled={pagePublished === null || togglingPublish}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all disabled:opacity-50 ${
                    pagePublished
                      ? dark
                        ? 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25'
                        : 'bg-rose-100/70 text-rose-800 border border-rose-300/60 hover:bg-rose-100'
                      : dark
                        ? 'bg-emerald-400/90 text-stone-900 hover:bg-emerald-300 shadow-[0_0_14px_-4px_rgba(16,185,129,0.5)]'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  }`}
                >
                  {togglingPublish ? '...' : pagePublished ? 'Деактивувати' : 'Активувати'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPagePreviewOpen(o => !o); }}
                  title={pagePreviewOpen ? 'Згорнути превʼю' : 'Розгорнути превʼю на сайті'}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                      : 'bg-white/70 border-stone-300/60 text-stone-500 hover:bg-white hover:text-stone-700'
                  }`}
                >
                  <FaChevronDown className={`text-[10px] transition-transform ${pagePreviewOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

        {pagePreviewOpen && (
          <div className="p-4">
            <div
              className={`rounded-lg overflow-hidden border ${
                dark ? 'border-white/[0.06]' : 'border-stone-300/50'
              }`}
              style={{ background: '#FFFFFF' }}
            >
              <NewsPagePreview />
            </div>
          </div>
        )}

        {/* Footer-CTA: «Редагувати поточну» — основна дія для live-сторінки.
            Тримаємо в межах того самого блоку (одна логічна одиниця "Поточна
            сторінка"). Тонкий border-t розділяє action-зону від статус-секції. */}
        <div className={`px-5 py-3 border-t flex items-center justify-end ${
          dark ? 'border-white/[0.04] bg-white/[0.015]' : 'border-stone-200/50 bg-white/40'
        }`}>
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
        const now = new Date();
        const at = staged?.publishAt ? new Date(staged.publishAt) : null;
        let countdown = '';
        let overdue = false;
        if (at) {
          const diff = at.getTime() - now.getTime();
          if (diff <= 0) { overdue = true; countdown = 'час настав — публікується найближчим cron-тиком'; }
          else {
            const min = Math.floor(diff / 60_000);
            const h = Math.floor(min / 60);
            const d = Math.floor(h / 24);
            if (d >= 1) countdown = `через ${d} ${d === 1 ? 'день' : d < 5 ? 'дні' : 'днів'} ${h % 24} год`;
            else if (h >= 1) countdown = `через ${h} год ${min % 60} хв`;
            else countdown = `через ${min} хв`;
          }
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
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase">Наступна сторінка</span>
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
                        {at ? countdown : 'таймер не встановлено — чекає ручної публікації'}
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

                  {/* Inline datetime пікер. Авто-зберігається з debounce 700мс
                      (без зайвої кнопки "Save"). ✕ — скинути таймер. */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="datetime-local"
                      value={scheduleInput}
                      onChange={(e) => setScheduleInput(e.target.value)}
                      className={`flex-1 px-3 py-1.5 text-[12px] rounded-lg border transition-colors focus:outline-none ${
                        dark
                          ? 'bg-white/[0.06] text-amber-100 border-amber-300/30 focus:border-amber-300/60'
                          : 'bg-white text-amber-900 border-amber-500/40 focus:border-amber-700'
                      }`}
                    />
                    {scheduleInput && (
                      <button
                        type="button"
                        onClick={() => setScheduleInput('')}
                        title="Прибрати таймер — чернетка чекатиме ручної публікації"
                        className={`flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors text-[12px] ${
                          dark
                            ? 'bg-white/[0.04] text-amber-200 border-white/[0.10] hover:bg-white/[0.10]'
                            : 'bg-white/70 text-amber-800 border-stone-300/60 hover:bg-white'
                        }`}
                      >✕</button>
                    )}
                  </div>

                  {/* Управління чернеткою: Скасувати + ⚡ Опублікувати зараз.
                      Кнопка "Редагувати" звідси прибрана — її переніс у footer
                      панелі як основний CTA-pill (одна логічна одиниця). */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={discardStaged}
                      disabled={stagedActionPending !== null}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                        dark
                          ? 'bg-rose-500/10 text-rose-200 border-rose-400/25 hover:bg-rose-500/20'
                          : 'bg-rose-100/70 text-rose-800 border-rose-300/60 hover:bg-rose-100'
                      }`}
                    >{stagedActionPending === 'discard' ? '...' : 'Скасувати'}</button>
                    <button
                      type="button"
                      onClick={publishStagedNow}
                      disabled={stagedActionPending !== null}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all disabled:opacity-50 ${
                        dark
                          ? 'bg-emerald-400/90 text-stone-900 hover:bg-emerald-300 shadow-[0_0_14px_-4px_rgba(16,185,129,0.5)]'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                      }`}
                    >{stagedActionPending === 'publishNow' ? '...' : '⚡ Опублікувати зараз'}</button>
                  </div>
                </div>

                {/* Footer-CTA панелі: основний перехід у білдер чернетки.
                    Той самий патерн що й у "Поточній сторінці" — один блок,
                    одна навігаційна кнопка-pill зі своїм design-emphasis. */}
                <div className={`px-5 py-3 border-t flex items-center justify-end ${
                  dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-amber-500/20 bg-amber-50/50'
                }`}>
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
                  Створи чернетку наступної версії сторінки /news і виставі дату публікації — у визначений час cron автоматично замінить поточну.
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

        {/* ╭─ ПРАВА КОЛОНКА: список новин + дії над новинами ─────────────╮ */}
        <section className="min-w-0">
          {/* Section header: лейбл + лічильник + CTA "Створити новину" в одному рядку. */}
          <div className={`flex items-center gap-3 mb-4 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
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
            const { firstImage: contentImage } = parseContentPreview(item.content);
            const thumbnail = item.imageUrl || contentImage;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border backdrop-blur-sm transition-all ${
                  isExpanded
                    ? dark
                      ? 'bg-white/[0.04] border-amber-400/30 shadow-[0_0_24px_-8px_rgba(251,191,36,0.3)]'
                      : 'bg-white/70 border-amber-500/40 shadow-[0_4px_20px_-8px_rgba(180,83,9,0.2)]'
                    : dark
                      ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                      : 'bg-white/60 border-stone-300/50 hover:bg-white/80 hover:border-stone-300/70'
                }`}
              >
                {/* Header row — always visible, clickable */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <FaChevronDown
                    className={`text-xs flex-shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    } ${dark ? 'text-slate-500' : 'text-stone-400'}`}
                  />

                  {/* Mini thumbnail — 16:9 щоб збігалось з білдером і публічним /news.
                      Раніше було 80×80 квадрат → бічна обрізка створювала розбіжність із публікою. */}
                  <div
                    className={`flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden border ${
                      dark
                        ? 'bg-white/[0.04] border-white/[0.08]'
                        : 'bg-stone-100/70 border-stone-300/60'
                    }`}
                  >
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className={`w-full h-full flex items-center justify-center ${
                          dark ? 'text-slate-600' : 'text-stone-400'
                        }`}
                      >
                        <FaImage size={22} />
                      </div>
                    )}
                  </div>

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

                  {/* Category — popup picker */}
                  <div
                    onClick={e => e.stopPropagation()}
                    className="hidden md:flex flex-shrink-0"
                  >
                    <CategoryPicker
                      current={item.category}
                      theme={theme}
                      onChange={next => changeCategory(item.id, item.category, next)}
                    />
                  </div>

                  {/* Status — popup picker with 3 transitions */}
                  <div
                    className="hidden sm:flex flex-row items-center gap-1.5 flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <StatusPicker
                      newsId={item.id}
                      published={item.published}
                      suspendedAt={item.suspendedAt}
                      resumeAt={item.resumeAt}
                      theme={theme}
                      onChange={result => updateNewsLocal(item.id, result)}
                    />
                    {((item.suspendedAt && new Date(item.suspendedAt) > new Date()) ||
                      (item.resumeAt && new Date(item.resumeAt) > new Date())) && (
                      <ScheduledTimerPill
                        newsId={item.id}
                        published={item.published}
                        suspendedAt={item.suspendedAt}
                        resumeAt={item.resumeAt}
                        theme={theme}
                        onChange={result => updateNewsLocal(item.id, result)}
                      />
                    )}
                  </div>

                  {/* Actions stack */}
                  <div
                    className="flex flex-col gap-1.5 items-stretch w-[140px] flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
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
                    <NewsPublishButton
                      newsId={item.id}
                      published={item.published}
                      suspendedAt={item.suspendedAt}
                      resumeAt={item.resumeAt}
                      theme={theme}
                      onChange={result => updateNewsLocal(item.id, result)}
                    />
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

                {/* Expanded full preview */}
                {isExpanded && (
                  <div className={`border-t ${dark ? 'border-white/[0.05]' : 'border-stone-300/50'}`}>
                    <div className="max-w-3xl mx-auto px-6 py-6">
                      {item.excerpt && (
                        <p
                          className={`text-base font-medium mb-4 leading-relaxed ${
                            dark ? 'text-slate-200' : 'text-stone-800'
                          }`}
                        >
                          {item.excerpt}
                        </p>
                      )}

                      {(() => {
                        const { isJson, blocks } = parseBlocks(item.content);
                        if (isJson && blocks.length > 0) {
                          // Expanded preview = масштабована точна копія публічної сторінки.
                          // Рендериться через спільний модуль з public — drift неможливий.
                          // Білий фон обгортає preview, щоб блоки на прозорому BG читались
                          // незалежно від dark/light режиму адмінки.
                          return (
                            <>
                              <div
                                className="rounded-lg overflow-hidden"
                                style={{ background: '#FFFFFF', padding: '20px' }}
                              >
                                <ScaledNewsPreview blocks={blocks} />
                              </div>
                              <style>{`
                                .news-content { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1C3A2E; line-height: 1.7; font-size: 16px; }
                                .news-content h1 { font-size: 2rem; font-weight: 700; margin: 1.2em 0 0.5em; }
                                .news-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.1em 0 0.5em; }
                                .news-content h3 { font-size: 1.2rem; font-weight: 600; margin: 1em 0 0.4em; }
                                .news-content p { margin: 0.6em 0; }
                                .news-content ul { list-style: disc; padding-left: 1.5em; margin: 0.6em 0; }
                                .news-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.6em 0; }
                                .news-content strong { font-weight: 700; }
                                .news-content em { font-style: italic; }
                                .news-content blockquote { border-left: 4px solid #D4A843; margin: 1em 0; padding: 0.5em 1em; background: #E8F5E0; border-radius: 0 6px 6px 0; }
                                .news-content hr { border: none; border-top: 2px solid #D4A843; margin: 1.5em 0; }
                                .news-content img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
                              `}</style>
                            </>
                          );
                        }
                        const rawContent = item.content?.trim();
                        if (rawContent?.startsWith('<')) {
                          return (
                            <div
                              className={`news-preview-content text-sm ${
                                dark ? 'text-slate-300' : 'text-stone-700'
                              }`}
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawContent) }}
                            />
                          );
                        }
                        return (
                          <p
                            className={`text-sm italic ${
                              dark ? 'text-slate-500' : 'text-stone-500'
                            }`}
                          >
                            Контент порожній
                          </p>
                        );
                      })()}
                    </div>

                    <div
                      className={`flex items-center justify-between px-4 py-3 border-t ${
                        dark
                          ? 'bg-white/[0.02] border-white/[0.05]'
                          : 'bg-stone-50/60 border-stone-300/50'
                      }`}
                    >
                      <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        /news/{item.slug}
                        {item.author?.name && <span> · {item.author.name}</span>}
                      </div>
                      <Link
                        href={`/dashboard/admin/news/${item.id}/edit`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                          dark
                            ? 'bg-white/[0.04] border-white/[0.08] text-amber-200 hover:bg-white/[0.08]'
                            : 'bg-white/70 border-stone-300/60 text-amber-800 hover:bg-white'
                        }`}
                      >
                        <FaEdit size={11} /> Редагувати
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </section>
        {/* ╰─ кінець правої колонки ─────────────────────────────────────╯ */}
      </div>

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
