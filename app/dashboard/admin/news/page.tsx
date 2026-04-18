'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaImage,
  FaChevronDown,
} from 'react-icons/fa';
import { useAdminTheme, type Theme } from '../_components/adminTheme';
import { AdminShell, AdminPanel } from '../_components/AdminShell';
import NewsPublishButton from './_components/NewsPublishButton';
import CategoryPicker from './_components/CategoryPicker';
import StatusPicker from './_components/StatusPicker';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

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

function getEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function renderBlock(block: ContentBlock, theme: Theme) {
  const dark = theme === 'dark';
  if (!block.data) return null;
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.data.level || '2'}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag
          key={block.id}
          className={`font-bold ${dark ? 'text-slate-100' : 'text-stone-900'}`}
          style={{
            fontSize: Tag === 'h1' ? '1.5rem' : Tag === 'h2' ? '1.25rem' : '1.1rem',
            margin: '0.8em 0 0.4em',
          }}
        >
          {block.data.text}
        </Tag>
      );
    }
    case 'text':
      return block.data.html ? (
        <div
          key={block.id}
          className="news-preview-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.data.html) }}
        />
      ) : block.data.text ? (
        <p
          key={block.id}
          className={`text-sm leading-relaxed my-1 ${dark ? 'text-slate-300' : 'text-stone-700'}`}
        >
          {block.data.text}
        </p>
      ) : null;
    case 'hero':
      return block.data.text ? (
        <p
          key={block.id}
          className={`text-base font-medium my-2 ${dark ? 'text-slate-200' : 'text-stone-800'}`}
        >
          {block.data.text}
        </p>
      ) : null;
    case 'image':
      return block.data.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={block.id}
          src={block.data.url}
          alt={block.data.alt || ''}
          className="w-full rounded-lg my-3"
          style={{ maxHeight: '400px', objectFit: 'cover' }}
        />
      ) : null;
    case 'gallery':
      return block.data.images?.length ? (
        <div key={block.id} className="grid grid-cols-2 gap-2 my-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {block.data.images.map((img: any, i: number) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={typeof img === 'string' ? img : img.url}
              alt=""
              className="w-full rounded-lg object-cover"
              style={{ maxHeight: '200px' }}
            />
          ))}
        </div>
      ) : null;
    case 'youtube': {
      const embedUrl = getEmbedUrl(block.data.url || '');
      return embedUrl ? (
        <iframe
          key={block.id}
          src={embedUrl}
          className="w-full rounded-lg my-3 border-0"
          style={{ height: '300px' }}
          allowFullScreen
        />
      ) : null;
    }
    case 'video': {
      const embedUrl = getEmbedUrl(block.data.url || '');
      return embedUrl ? (
        <iframe
          key={block.id}
          src={embedUrl}
          className="w-full rounded-lg my-3 border-0"
          style={{ height: '300px' }}
          allowFullScreen
        />
      ) : null;
    }
    case 'quote':
      return (
        <blockquote
          key={block.id}
          className={`border-l-4 rounded-r-md pl-4 py-2 my-3 text-sm italic ${
            dark
              ? 'border-amber-400/60 bg-emerald-500/5 text-slate-300'
              : 'border-amber-500 bg-emerald-100/40 text-stone-700'
          }`}
        >
          {block.data.text}
        </blockquote>
      );
    case 'divider':
      return (
        <hr
          key={block.id}
          className={`my-4 border-t-2 ${dark ? 'border-amber-400/30' : 'border-amber-400/60'}`}
        />
      );
    case 'list':
      return block.data.items?.length ? (
        <ul
          key={block.id}
          className={`list-disc pl-5 my-2 text-sm space-y-1 ${
            dark ? 'text-slate-300' : 'text-stone-700'
          }`}
        >
          {block.data.items.map((li: string, i: number) => (
            <li key={i}>{stripHtml(li)}</li>
          ))}
        </ul>
      ) : null;
    case 'cta':
      return (
        <div
          key={block.id}
          className={`my-3 p-4 rounded-lg text-center border ${
            dark
              ? 'bg-amber-500/10 border-amber-400/25 text-amber-200'
              : 'bg-amber-200/30 border-amber-500/30 text-amber-900'
          }`}
        >
          <p className="text-sm font-medium">
            {block.data.text || block.data.label || 'CTA'}
          </p>
        </div>
      );
    default:
      return null;
  }
}

export default function AdminNewsPage() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      maxWidth="max-w-4xl"
      rightSlot={
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
      }
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

                  {/* Mini thumbnail */}
                  <div
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border ${
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
                    className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0"
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
                    {!!item.suspendedAt &&
                      item.resumeAt &&
                      new Date(item.resumeAt) > new Date() && (
                        <p
                          className={`text-[10px] ${dark ? 'text-amber-300/70' : 'text-amber-700'}`}
                        >
                          З {new Date(item.resumeAt).toLocaleDateString('uk-UA')}
                        </p>
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
                        const blocks = flattenBlocks(item.content);
                        if (blocks.length > 0) {
                          return (
                            <>
                              <div className="news-preview-content">
                                {blocks.map(b => renderBlock(b, theme))}
                              </div>
                              <style>{`
                                .news-preview-content { font-size: 14px; line-height: 1.7; color: ${dark ? '#cbd5e1' : '#44403c'}; }
                                .news-preview-content p { margin: 0.5em 0; }
                                .news-preview-content ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
                                .news-preview-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
                                .news-preview-content strong { font-weight: 700; color: ${dark ? '#f1f5f9' : '#1c1917'}; }
                                .news-preview-content em { font-style: italic; }
                                .news-preview-content img { max-width: 100%; border-radius: 8px; margin: 0.75em 0; }
                                .news-preview-content a { color: ${dark ? '#fbbf24' : '#b45309'}; text-decoration: underline; }
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
