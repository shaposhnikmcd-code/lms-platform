"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash, FaSearch, FaImage, FaChevronDown } from "react-icons/fa";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  category: string;
  published: boolean;
  createdAt: string;
  author?: { name: string | null };
}

const CATEGORY_LABELS: Record<string, string> = {
  NEWS: "Новини",
  ANNOUNCEMENT: "Оголошення",
  ARTICLE: "Стаття",
};

const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  ANNOUNCEMENT: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  ARTICLE: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface ContentBlock {
  id: string;
  type: string;
  data: Record<string, any>;
}

function flattenBlocks(content: string): ContentBlock[] {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: any) => item.blocks ? item.blocks : [item]);
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

function renderBlock(block: ContentBlock) {
  if (!block.data) return null;
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.data.level || '2'}` as 'h1' | 'h2' | 'h3';
      return <Tag key={block.id} className="font-bold text-slate-800" style={{ fontSize: Tag === 'h1' ? '1.5rem' : Tag === 'h2' ? '1.25rem' : '1.1rem', margin: '0.8em 0 0.4em' }}>{block.data.text}</Tag>;
    }
    case 'text':
      return block.data.html
        ? <div key={block.id} className="news-preview-content" dangerouslySetInnerHTML={{ __html: block.data.html }} />
        : block.data.text ? <p key={block.id} className="text-sm text-slate-600 leading-relaxed my-1">{block.data.text}</p> : null;
    case 'hero':
      return block.data.text ? <p key={block.id} className="text-base font-medium text-slate-700 my-2">{block.data.text}</p> : null;
    case 'image':
      return block.data.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={block.id} src={block.data.url} alt={block.data.alt || ''} className="w-full rounded-lg my-3" style={{ maxHeight: '400px', objectFit: 'cover' }} />
      ) : null;
    case 'gallery':
      return block.data.images?.length ? (
        <div key={block.id} className="grid grid-cols-2 gap-2 my-3">
          {block.data.images.map((img: any, i: number) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={typeof img === 'string' ? img : img.url} alt="" className="w-full rounded-lg object-cover" style={{ maxHeight: '200px' }} />
          ))}
        </div>
      ) : null;
    case 'youtube': {
      const embedUrl = getEmbedUrl(block.data.url || '');
      return embedUrl ? (
        <iframe key={block.id} src={embedUrl} className="w-full rounded-lg my-3 border-0" style={{ height: '300px' }} allowFullScreen />
      ) : null;
    }
    case 'video': {
      const embedUrl = getEmbedUrl(block.data.url || '');
      return embedUrl ? (
        <iframe key={block.id} src={embedUrl} className="w-full rounded-lg my-3 border-0" style={{ height: '300px' }} allowFullScreen />
      ) : null;
    }
    case 'quote':
      return (
        <blockquote key={block.id} className="border-l-4 border-amber-400 bg-emerald-50 rounded-r-md pl-4 py-2 my-3 text-sm text-slate-700 italic">
          {block.data.text}
        </blockquote>
      );
    case 'divider':
      return <hr key={block.id} className="border-t-2 border-amber-300 my-4" />;
    case 'list':
      return block.data.items?.length ? (
        <ul key={block.id} className="list-disc pl-5 my-2 text-sm text-slate-600 space-y-1">
          {block.data.items.map((li: string, i: number) => <li key={i}>{stripHtml(li)}</li>)}
        </ul>
      ) : null;
    case 'cta':
      return (
        <div key={block.id} className="my-3 p-4 bg-indigo-50 rounded-lg text-center">
          <p className="text-sm font-medium text-indigo-700">{block.data.text || block.data.label || 'CTA'}</p>
        </div>
      );
    default:
      return null;
  }
}

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/news");
        if (!r.ok) throw new Error("Не вдалося завантажити новини");
        const d = await r.json();
        setNews(Array.isArray(d) ? d : []);
      } catch (err) {
        setToast({ message: err instanceof Error ? err.message : 'Помилка завантаження', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const togglePublish = async (e: React.MouseEvent, id: string, published: boolean) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося змінити статус', type: 'error' });
        return;
      }
      setNews(news.map((n) => n.id === id ? { ...n, published: !published } : n));
    } catch {
      setToast({ message: 'Помилка запиту', type: 'error' });
    }
  };

  const deleteNews = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Видалити цю новину?")) return;
    try {
      const res = await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося видалити', type: 'error' });
        return;
      }
      setNews(news.filter((n) => n.id !== id));
      if (expandedId === id) setExpandedId(null);
      setToast({ message: 'Новину видалено', type: 'success' });
    } catch {
      setToast({ message: 'Помилка запиту', type: 'error' });
    }
  };

  const filtered = news.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || (item.excerpt || '').toLowerCase().includes(q);
    const matchCategory = filterCategory === "ALL" || item.category === filterCategory;
    const matchStatus = filterStatus === "ALL" || (filterStatus === "PUBLISHED" ? item.published : !item.published);
    return matchSearch && matchCategory && matchStatus;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {toast.message}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Новини</h1>
          <p className="text-sm text-slate-500 mt-1">Всього: {news.length} · Опубліковано: {news.filter(n => n.published).length}</p>
        </div>
        <Link href="/dashboard/admin/news/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 shadow-sm shadow-indigo-500/20 transition-colors">
          <FaPlus /> Створити новину
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            type="text"
            placeholder="Пошук за заголовком..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/70 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200/70 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="ALL">Всі категорії</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200/70 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="ALL">Всі статуси</option>
          <option value="PUBLISHED">Опубліковано</option>
          <option value="DRAFT">Чернетки</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-slate-500 mb-5">{news.length === 0 ? "Новин ще немає" : "Нічого не знайдено"}</p>
          {news.length === 0 && (
            <Link href="/dashboard/admin/news/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors">
              <FaPlus /> Створити першу новину
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const date = new Date(item.createdAt);
            const dateStr = date.toLocaleDateString("uk-UA");
            const timeStr = date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
            const { firstImage: contentImage } = parseContentPreview(item.content);
            const thumbnail = item.imageUrl || contentImage;
            const isExpanded = expandedId === item.id;

            return (
              <div key={item.id} className={`bg-white rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all ${isExpanded ? 'border-indigo-200 shadow-md' : 'border-slate-200/70 hover:shadow-md'}`}>
                {/* Header row — always visible, clickable */}
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <FaChevronDown className={`text-slate-400 text-xs flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />

                  {/* Mini thumbnail */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-slate-100">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <FaImage size={14} />
                      </div>
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-600'}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {item.published ? (
                        <span className="text-[10px] font-medium text-emerald-600">Опубліковано</span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Чернетка</span>
                      )}
                      <span className="text-[10px] text-slate-400">{dateStr} {timeStr}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => togglePublish(e, item.id, item.published)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={item.published ? "Зняти з публікації" : "Опублікувати"}
                    >
                      {item.published ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                    </button>
                    <Link href={`/dashboard/admin/news/${item.id}/edit`} onClick={(e) => e.stopPropagation()}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                      <FaEdit size={13} />
                    </Link>
                    <button
                      onClick={(e) => deleteNews(e, item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <FaTrash size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded full preview */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <div className="max-w-3xl mx-auto px-6 py-6">
                      {item.excerpt && (
                        <p className="text-base font-medium text-slate-700 mb-4 leading-relaxed">{item.excerpt}</p>
                      )}

                      {(() => {
                        const blocks = flattenBlocks(item.content);
                        if (blocks.length > 0) {
                          return (
                            <>
                              <div className="news-preview-content">
                                {blocks.map(renderBlock)}
                              </div>
                              <style>{`
                                .news-preview-content { font-size: 14px; color: #334155; line-height: 1.7; }
                                .news-preview-content p { margin: 0.5em 0; }
                                .news-preview-content ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
                                .news-preview-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
                                .news-preview-content strong { font-weight: 700; }
                                .news-preview-content em { font-style: italic; }
                                .news-preview-content img { max-width: 100%; border-radius: 8px; margin: 0.75em 0; }
                              `}</style>
                            </>
                          );
                        }
                        const rawContent = item.content?.trim();
                        if (rawContent?.startsWith('<')) {
                          return <div className="news-preview-content text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: rawContent }} />;
                        }
                        return <p className="text-sm text-slate-500 italic">Контент порожній</p>;
                      })()}
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-t border-slate-100">
                      <div className="text-xs text-slate-400">
                        /news/{item.slug}
                        {item.author?.name && <span> · {item.author.name}</span>}
                      </div>
                      <Link href={`/dashboard/admin/news/${item.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
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
    </div>
  );
}
