'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaLayerGroup, FaTimes } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';

type PairColor = 'blue' | 'red' | 'green' | 'violet' | 'black';

type Model = {
  id: string;
  name: string;
  type: string;
  paid: string;
  free: string;
  priceLocation: string;
  width: string;
  rows: number;
  height: string;
  note: string;
  /** Групи сусідства — пакети з СПІЛЬНИМ кольором можуть стояти в одному рядку. */
  pairColors: PairColor[];
};

// Пули сусідства (пакети одного пулу можна поставити в пару в один ряд на /courses):
//   • 🔵 blue   — H=580: M1, M4 (625+625 ✓, 625+730 ✓)
//   • 🔴 red    — H=740, W=625: M6a, M6b (625+625 ✓)
//   • 🟢 green  — H=920, W=625 self-pair: M7a, M7b, M10a, M10b (625+625 ✓)
//   • 🟣 violet — H=920, W=625+730 cross-pair: M7a/b, M10a/b ⇄ M5, M9 (625+730 ✓)
//   • ⚫ black  — solo (не паруються): M11 (1200px — не вмістить сусіда)
const PAIR_COLOR_META: Record<PairColor, { label: string; dark: string; light: string; dot: string }> = {
  blue:   { label: 'H=580 · 625/730', dark: 'bg-sky-500/25 border-sky-400/60',       light: 'bg-sky-500/30 border-sky-600/60',       dot: '#38bdf8' },
  red:    { label: 'H=740 · 625',     dark: 'bg-rose-500/25 border-rose-400/60',     light: 'bg-rose-500/30 border-rose-600/60',     dot: '#fb7185' },
  green:  { label: 'H=920 · 625+625', dark: 'bg-emerald-500/25 border-emerald-400/60', light: 'bg-emerald-500/30 border-emerald-600/60', dot: '#34d399' },
  violet: { label: 'H=920 · 625+730', dark: 'bg-violet-500/25 border-violet-400/60', light: 'bg-violet-500/30 border-violet-600/60', dot: '#a78bfa' },
  black:  { label: 'Соло (без пари)', dark: 'bg-slate-500/30 border-slate-400/50',   light: 'bg-stone-700/25 border-stone-700/60',   dot: '#1c1917' },
};

const TYPE_DISCOUNT = '📉 Знижка на пакет';
const TYPE_FIXED = '🎁 Безкоштовний Сталий';
const TYPE_CHOICE = '🎲 Безкоштовний на Вибір';

const PRICE_SEPARATE = 'окремо';
const PRICE_INLINE = 'разом з безплатними';

const MODELS: Model[] = [
  {
    id: '1',
    name: 'DISCOUNT 2 платних',
    type: TYPE_DISCOUNT,
    paid: '2',
    free: '0',
    priceLocation: PRICE_SEPARATE,
    width: '625px',
    rows: 2,
    height: '580px',
    note: 'Однаковий розмір чи соло, чи в 2-per-row групі. Amber savings pill "💰 Економія"',
    pairColors: ['blue'],
  },
  {
    id: '4',
    name: '3 платних в ряду',
    type: TYPE_DISCOUNT,
    paid: '3',
    free: '0',
    priceLocation: PRICE_SEPARATE,
    width: '730px',
    rows: 2,
    height: '580px',
    note: 'grid-cols-3 внутрішня сітка',
    pairColors: ['blue'],
  },
  {
    id: '5',
    name: '4 платних (2×2)',
    type: TYPE_DISCOUNT,
    paid: '4',
    free: '0',
    priceLocation: PRICE_SEPARATE,
    width: '730px',
    rows: 2,
    height: '920px',
    note: '2 × 2 внутрішня сітка. Висота форсована до 920px — авто-тюнер вміщує контент',
    pairColors: ['violet'],
  },
  {
    id: '6a',
    name: '1 платний + 1 безкоштовний (inline CTA)',
    type: TYPE_FIXED,
    paid: '1',
    free: '1',
    priceLocation: PRICE_INLINE,
    width: '625px',
    rows: 2,
    height: '740px',
    note: '🎯 badge, ціна в CTA-card поряд з безплатним. Висота форсована до 740px',
    pairColors: ['red'],
  },
  {
    id: '6b',
    name: '2 платних + 1 безкоштовний (inline CTA)',
    type: TYPE_FIXED,
    paid: '2',
    free: '1',
    priceLocation: PRICE_INLINE,
    width: '625px',
    rows: 2,
    height: '740px',
    note: '🎯 badge, ціна в CTA-card поряд з безплатним. Висота форсована до 740px',
    pairColors: ['red'],
  },
  {
    id: '7a',
    name: '1 платний + 2 безкоштовних (gift-row)',
    type: TYPE_FIXED,
    paid: '1',
    free: '2',
    priceLocation: PRICE_SEPARATE,
    width: '625px',
    rows: 3,
    height: '920px',
    note: 'gift-row 2-col + нижній Price+CTA. Висота форсована до 920px',
    pairColors: ['green', 'violet'],
  },
  {
    id: '7b',
    name: '2 платних + 2 безкоштовних (gift-row)',
    type: TYPE_FIXED,
    paid: '2',
    free: '2',
    priceLocation: PRICE_SEPARATE,
    width: '625px',
    rows: 3,
    height: '920px',
    note: 'gift-row + isPairLayout (equalPair). Висота форсована до 920px',
    pairColors: ['green', 'violet'],
  },
  {
    id: '9',
    name: '1 платний + пул 3',
    type: TYPE_CHOICE,
    paid: '1',
    free: '3 (пул, клієнт обирає 1)',
    priceLocation: PRICE_SEPARATE,
    width: '730px',
    rows: 3,
    height: '920px',
    note: 'Paid стандартизовано до 345px. Висота форсована до 920px',
    pairColors: ['violet'],
  },
  {
    id: '10a',
    name: '1 платний + пул 2',
    type: TYPE_CHOICE,
    paid: '1',
    free: '2 (пул)',
    priceLocation: PRICE_SEPARATE,
    width: '625px',
    rows: 3,
    height: '920px',
    note: 'toggle-вибір, dim / wax-seal / shimmer. Висота форсована до 920px',
    pairColors: ['green', 'violet'],
  },
  {
    id: '10b',
    name: '2 платних + пул 2',
    type: TYPE_CHOICE,
    paid: '2',
    free: '2 (пул)',
    priceLocation: PRICE_SEPARATE,
    width: '625px',
    rows: 3,
    height: '920px',
    note: 'toggle-вибір + isPairLayout (equalPair). Висота форсована до 920px',
    pairColors: ['green', 'violet'],
  },
  {
    id: '11',
    name: '2 платних + пул 4',
    type: TYPE_CHOICE,
    paid: '2',
    free: '4 (пул)',
    priceLocation: PRICE_SEPARATE,
    width: '1200px',
    rows: 3,
    height: '920px',
    note: 'slim free cards, 4 в ряду. Висота форсована до 920px',
    pairColors: ['black'],
  },
];

const NOTES_STORAGE_KEY = 'bundle-model-notes';

export default function BundleModelsButton({ theme = 'light' }: { theme?: Theme }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});
  const dark = theme === 'dark';

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
      if (raw) setNoteOverrides(JSON.parse(raw) as Record<string, string>);
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const saveNote = (id: string, note: string) => {
    setNoteOverrides(prev => {
      const next = { ...prev, [id]: note };
      try {
        window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };

  const resetNote = (id: string) => {
    setNoteOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      try {
        window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className={`absolute inset-0 backdrop-blur-sm ${dark ? 'bg-black/60' : 'bg-stone-900/30'}`}
              onClick={() => setOpen(false)}
            />
            <div
              className={`relative rounded-2xl shadow-2xl w-full max-w-[1100px] max-h-[88vh] flex flex-col border ${
                dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div
                className={`flex items-start justify-between px-6 pt-6 pb-4 border-b ${
                  dark ? 'border-white/[0.06]' : 'border-stone-300/50'
                }`}
              >
                <div>
                  <h2 className={`text-xl font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                    Моделі пакетів
                  </h2>
                  <p className={`text-[11px] mt-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Заморожені верстки. Розміри виміряні @viewport 1920×1080. Джерело:{' '}
                    <code
                      className={`px-1 py-0.5 rounded text-[10px] ${
                        dark ? 'bg-white/[0.06] text-slate-300' : 'bg-stone-200/70 text-stone-700'
                      }`}
                    >
                      CLAUDE.md
                    </code>
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className={`ml-3 transition-colors ${
                    dark ? 'text-slate-500 hover:text-slate-200' : 'text-stone-400 hover:text-stone-700'
                  }`}
                  aria-label="Закрити"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                {/* Легенда кольорів сусідства */}
                <div
                  className={`mb-4 rounded-xl px-4 py-3 border ${
                    dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/60 border-stone-300/50'
                  }`}
                >
                  <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-2 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Кольори сусідства
                  </div>
                  <p className={`text-[11px] mb-2.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                    Пакети зі <span className="font-semibold">спільним кольором</span> можуть стояти в одному рядку на сторінці курсів.
                    Пакет з одним кольором пара шукає лише в цьому пулі. <span className="inline-block w-3 h-3 rounded-sm align-middle border" style={{ background: '#1c1917', borderColor: '#44403c' }} /> — соло, пару не можна.
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {(Object.keys(PAIR_COLOR_META) as PairColor[]).map(c => {
                      const meta = PAIR_COLOR_META[c];
                      return (
                        <div key={c} className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-block w-4 h-4 rounded-md border ${dark ? meta.dark : meta.light}`}
                          />
                          <span className={`text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  className={`rounded-xl border ${
                    dark ? 'border-white/[0.08]' : 'border-stone-300/60'
                  }`}
                >
                  <table className="w-full text-[12px] border-separate border-spacing-0">
                    <thead
                      className={`[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b ${
                        dark
                          ? '[&_th]:bg-[#14161d] [&_th]:border-white/[0.08] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl'
                          : '[&_th]:bg-[#fbf7ec] [&_th]:border-stone-300/50 [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl'
                      }`}
                    >
                      <tr>
                        <Th dark={dark}>Тип</Th>
                        <Th dark={dark}>Модель</Th>
                        <Th dark={dark} align="center">Строчок</Th>
                        <Th dark={dark} align="center">Ширина</Th>
                        <Th dark={dark} align="center">Висота</Th>
                        <Th dark={dark}>Примітка</Th>
                      </tr>
                    </thead>
                    <tbody className={dark ? 'divide-y divide-white/[0.05]' : 'divide-y divide-stone-200/70'}>
                      {[...MODELS].sort((a, b) => a.rows - b.rows).map(m => (
                        <tr
                          key={m.id}
                          className={dark ? 'hover:bg-white/[0.03]' : 'hover:bg-stone-100/60'}
                        >
                          <Td dark={dark}>
                            <div className={`text-[12px] font-medium space-y-0.5 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                              {m.type.split('\n').map((line, i) => (
                                <div key={i} className="whitespace-nowrap">{line}</div>
                              ))}
                            </div>
                          </Td>
                          <Td dark={dark}>
                            <div className={`font-medium mb-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                              {m.name}
                            </div>
                            <ul className={`space-y-0.5 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                              <li>
                                <span className={dark ? 'text-slate-500' : 'text-stone-500'}>Платних —</span>{' '}
                                <span className={`font-medium tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{m.paid}</span>
                              </li>
                              <li>
                                <span className={dark ? 'text-slate-500' : 'text-stone-500'}>Безплатних —</span>{' '}
                                <span className={`font-medium tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{m.free}</span>
                              </li>
                              <li>
                                <span className={dark ? 'text-slate-500' : 'text-stone-500'}>Ціна —</span>{' '}
                                <span className={`font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{m.priceLocation}</span>
                              </li>
                            </ul>
                          </Td>
                          <Td dark={dark} align="center">
                            <div className="inline-flex items-center gap-1 flex-wrap justify-center">
                              {m.pairColors.map(c => {
                                const meta = PAIR_COLOR_META[c];
                                return (
                                  <span
                                    key={c}
                                    title={meta.label}
                                    className={`inline-block w-5 h-5 rounded-md border ${dark ? meta.dark : meta.light}`}
                                    style={{ boxShadow: `0 0 0 1px ${meta.dot}22` }}
                                  />
                                );
                              })}
                            </div>
                          </Td>
                          <Td dark={dark} align="center">
                            <div className={`tabular-nums font-medium space-y-0.5 ${dark ? 'text-amber-200' : 'text-amber-800'}`}>
                              {m.width.split('\n').map((line, i) => (
                                <div key={i}>{line}</div>
                              ))}
                            </div>
                          </Td>
                          <Td dark={dark} align="center">
                            <span className={`tabular-nums ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                              {m.height}
                            </span>
                          </Td>
                          <Td dark={dark}>
                            <EditableNote
                              id={m.id}
                              defaultValue={m.note}
                              override={noteOverrides[m.id]}
                              onSave={v => saveNote(m.id, v)}
                              onReset={() => resetNote(m.id)}
                              dark={dark}
                            />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className={`mt-4 rounded-xl p-3 border text-[11px] leading-relaxed space-y-2 ${
                    dark
                      ? 'bg-amber-500/[0.06] border-amber-500/15 text-amber-200/90'
                      : 'bg-amber-200/25 border-amber-500/30 text-amber-950'
                  }`}
                >
                  <div><span className="font-semibold">Строчок:</span> 2 = платні + (free інлайн з ціною) або платні + ціна. 3 = платні, безкоштовні, ціна — окремими рядами. Висота платних карток уніфікована на 345px.</div>
                  <div><span className="font-semibold">У 2-per-row групі:</span> кожен пакет зберігає свою натуральну ширину (625/730/1200) — розмір не змінюється при групуванні.</div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative inline-flex items-center gap-2 pl-3.5 pr-2 py-2 rounded-full border text-[12px] font-medium transition-all duration-300 overflow-hidden ${
          dark
            ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/[0.12] text-slate-200 hover:border-amber-300/30 hover:shadow-[0_0_20px_-4px_rgba(251,191,36,0.25)]'
            : 'bg-gradient-to-br from-white/90 to-stone-50/70 border-stone-300/70 text-stone-800 hover:border-amber-500/40 hover:shadow-[0_0_20px_-4px_rgba(180,83,9,0.2)]'
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
            dark
              ? 'bg-gradient-to-r from-transparent via-amber-200/20 to-transparent'
              : 'bg-gradient-to-r from-transparent via-amber-600/15 to-transparent'
          }`}
        />
        <FaLayerGroup
          className={`relative text-[12px] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${
            dark ? 'text-amber-200' : 'text-amber-700'
          }`}
        />
        <span className="relative tracking-wide">Моделі</span>
        <span
          className={`relative inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold rounded-md tabular-nums ${
            dark
              ? 'bg-amber-400/90 text-stone-900 shadow-[0_0_10px_-2px_rgba(251,191,36,0.5)]'
              : 'bg-stone-900 text-amber-100 shadow-sm'
          }`}
        >
          {MODELS.length}
        </span>
      </button>
      {modal}
    </>
  );
}

function Th({
  dark,
  children,
  align = 'left',
}: {
  dark: boolean;
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <th
      className={`text-[10px] uppercase tracking-[0.16em] font-semibold px-3 py-2.5 ${
        align === 'center' ? 'text-center' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
    >
      {children}
    </th>
  );
}

function Td({
  dark,
  children,
  align = 'left',
}: {
  dark: boolean;
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <td
      className={`px-3 py-2.5 align-middle ${
        align === 'center' ? 'text-center' : 'text-left'
      } ${dark ? 'text-slate-200' : 'text-stone-800'}`}
    >
      {children}
    </td>
  );
}

function EditableNote({
  id,
  defaultValue,
  override,
  onSave,
  onReset,
  dark,
}: {
  id: string;
  defaultValue: string;
  override: string | undefined;
  onSave: (value: string) => void;
  onReset: () => void;
  dark: boolean;
}) {
  const value = override ?? defaultValue;
  const isOverridden = override !== undefined && override !== defaultValue;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit();
          }
        }}
        rows={Math.min(6, Math.max(2, draft.split('\n').length + 1))}
        className={`w-full text-[11px] leading-relaxed rounded px-2 py-1.5 focus:outline-none focus:ring-2 resize-y ${
          dark
            ? 'bg-white/[0.05] border border-amber-400/40 text-slate-200 focus:ring-amber-400/40'
            : 'bg-white/80 border border-amber-500/40 text-stone-800 focus:ring-amber-500/30'
        }`}
      />
    );
  }

  return (
    <div className="group/note flex items-start gap-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Клік щоб відредагувати"
        className={`flex-1 text-left text-[11px] rounded px-1.5 py-1 -my-1 transition-colors cursor-text ${
          dark
            ? 'text-slate-400 hover:bg-white/[0.04]'
            : 'text-stone-600 hover:bg-stone-100/70'
        }`}
      >
        {value || (
          <span className={`italic ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
            клік щоб додати примітку
          </span>
        )}
      </button>
      {isOverridden && (
        <button
          type="button"
          onClick={onReset}
          title="Скинути до дефолту"
          className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-[9px] opacity-0 group-hover/note:opacity-100 transition-opacity ${
            dark
              ? 'text-slate-500 hover:text-amber-300 hover:bg-white/[0.06]'
              : 'text-stone-400 hover:text-amber-700 hover:bg-stone-200/60'
          }`}
        >
          ↺
          <span className="sr-only">Скинути примітку {id}</span>
        </button>
      )}
    </div>
  );
}
