'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaPlus, FaEye, FaEyeSlash, FaPause, FaGripVertical } from 'react-icons/fa';
import { HiOutlineBookOpen, HiOutlineGift } from 'react-icons/hi2';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import SuspendButton from './SuspendButton';
import DeleteBundleButton from './DeleteBundleButton';
import BundleModelsButton from './BundleModelsButton';
import BundleCard from '@/app/[locale]/courses/_components/BundleCard';
import { FaTable, FaTh } from 'react-icons/fa';
import {
  matchBundleToModel,
  getBundleModelOrVirtual,
  canPairBundles,
  PAIR_COLOR_META,
  type BundleModel,
  type PairColor,
  type PairTag,
  type PairResult,
} from '@/lib/bundleModels';
// `matchBundleToModel` використовується в isExactMatchModel — не видаляти.

export type BundleType = 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE';

export type BundleCourseData = {
  id: string;
  courseSlug: string;
  title: string;
  isFree: boolean;
};

export type BundleRowData = {
  id: string;
  title: string;
  type: BundleType;
  price: number;
  fullPrice: number;
  difference: number;
  discountPct: number;
  isPublished: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
  displayMode: 'auto' | 'solo';
  pickN?: number;
  courses: BundleCourseData[];
  miniaturePaid?: MiniatureCourse[];
  miniatureFree?: MiniatureCourse[];
};

export type MiniatureCourse = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  price: number;
  icon: string;
  accent: string;
  accentRgb: string;
};

/** Helper: bundle → model (exact або derived virtual). */
export function getBundleModel(b: BundleRowData): BundleModel {
  const paid = b.courses.filter((c) => !c.isFree).length;
  const free = b.courses.filter((c) => c.isFree).length;
  return getBundleModelOrVirtual({
    type: b.type,
    paidCount: paid,
    freeCount: free,
    pickN: b.type === 'CHOICE_FREE' ? b.pickN : undefined,
  });
}

/** Helper: чи це exact (frozen) match, щоб візуально відрізнити. */
export function isExactMatchModel(b: BundleRowData): boolean {
  const paid = b.courses.filter((c) => !c.isFree).length;
  const free = b.courses.filter((c) => c.isFree).length;
  return matchBundleToModel({
    type: b.type,
    paidCount: paid,
    freeCount: free,
    pickN: b.type === 'CHOICE_FREE' ? b.pickN : undefined,
  }) !== null;
}

/** Обчислити "ширину" пакета: скільки курсів у найширшому ряду (2, 3 або 4). */
export function bundleWidth(paid: number, free: number): 2 | 3 | 4 {
  const max = Math.max(paid, free);
  if (max >= 4) return 4;
  if (max === 3) return 3;
  return 2;
}

const TYPE_META: Record<BundleType, { icon: string; label: string; dark: string; light: string }> = {
  DISCOUNT: {
    icon: '📉',
    label: 'Знижка на пакет',
    dark: 'text-violet-200 bg-violet-500/10 border-violet-400/25',
    light: 'text-violet-800 bg-violet-200/40 border-violet-500/30',
  },
  FIXED_FREE: {
    icon: '🎁',
    label: 'Безкоштовний\nСталий',
    dark: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/25',
    light: 'text-emerald-800 bg-emerald-200/40 border-emerald-500/30',
  },
  CHOICE_FREE: {
    icon: '🎲',
    label: 'Безкоштовний\nна Вибір',
    dark: 'text-amber-200 bg-amber-500/10 border-amber-400/25',
    light: 'text-amber-800 bg-amber-200/40 border-amber-500/30',
  },
};

export default function BundlesView({
  bundles,
}: {
  bundles: BundleRowData[];
}) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';
  const [order, setOrder] = useState(bundles);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'rows'>('table');
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [markers, setMarkers] = useState<Array<{ id: string; top: number; height: number }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rowTransforms, setRowTransforms] = useState<Record<string, string>>({});
  const rafRef = useRef<number | null>(null);

  // Вимірюємо позицію кожного рядка таблиці — щоб зовнішня смуга з маркерами справа від таблиці
  // точно вирівнювалась до кожного рядка.
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const update = () => {
      const rows = Array.from(table.querySelectorAll('tbody tr[data-bundle-id]'));
      setMarkers(
        rows.map((row) => {
          const el = row as HTMLElement;
          return {
            id: el.dataset.bundleId || '',
            top: el.offsetTop,
            height: el.offsetHeight,
          };
        }),
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(table);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [order]);

  // Синхронізуємо локальний порядок з server props, коли оновлюється список пакетів
  useEffect(() => { setOrder(bundles); }, [bundles]);

  // Поки триває drag — читаємо style.transform кожного рядка і синхронізуємо маркери.
  // Це дозволяє маркерам рухатись разом з рядками (і для активного drag, і для цільових що посуваються).
  useEffect(() => {
    if (!activeId) return;
    const tick = () => {
      const table = tableRef.current;
      if (table) {
        const rows = table.querySelectorAll('tbody tr[data-bundle-id]');
        const next: Record<string, string> = {};
        rows.forEach((row) => {
          const el = row as HTMLElement;
          const id = el.dataset.bundleId || '';
          if (id) next[id] = el.style.transform || '';
        });
        setRowTransforms(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setRowTransforms({});
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex(b => b.id === active.id);
    const newIndex = order.findIndex(b => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    setSaving(true);
    try {
      await fetch('/api/admin/bundles/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map(b => b.id) }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Пакети"
      title="Пакети курсів"
      subtitle="Керуй пакетами: типи, ціни, публікація, призупинення."
      maxWidth="max-w-[1360px]"
      rightInset={140}
      rightSlotAfter={<BundleModelsButton theme={theme} />}
      rightSlot={
        <div className="flex items-center gap-2">
          <ViewModeSwitch mode={viewMode} setMode={setViewMode} dark={dark} />
          <Link
            href="/dashboard/admin/bundles/new"
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
            <span className="relative">Створити пакет</span>
          </Link>
        </div>
      }
    >
      {order.length === 0 ? (
        <AdminPanel theme={theme} className="py-16 text-center">
          <HiOutlineBookOpen
            className={`text-5xl mx-auto mb-4 ${dark ? 'text-slate-600' : 'text-stone-400'}`}
          />
          <p className={`mb-5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Пакетів ще немає</p>
          <Link
            href="/dashboard/admin/bundles/new"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              dark
                ? 'bg-amber-400/90 text-stone-900 shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)] hover:bg-amber-300'
                : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
            }`}
          >
            <FaPlus /> Створити перший пакет
          </Link>
        </AdminPanel>
      ) : viewMode === 'rows' ? (
        <RowsView bundles={order} dark={dark} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <PairingLegend dark={dark} />
        <div className="flex items-start gap-3">
        <AdminPanel theme={theme} padding="p-0" className="overflow-hidden flex-1 min-w-0">
          <div
            className={activeId ? 'overflow-hidden' : 'overflow-x-auto'}
            style={activeId ? { overflowY: 'hidden' } : undefined}
          >
            <table ref={tableRef} className="w-full">
              <thead
                className={`border-b ${
                  dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-stone-50/60 border-stone-300/50'
                }`}
              >
                <tr>
                  <Th theme={theme} minWidth={52} align="center">↕</Th>
                  <Th theme={theme} minWidth={220}>Пакет</Th>
                  <Th theme={theme} minWidth={120} align="center">Тип</Th>
                  <Th theme={theme} minWidth={140}>Курси</Th>
                  <Th theme={theme} align="center">Ціна</Th>
                  <Th theme={theme} align="center">Повна</Th>
                  <Th theme={theme} align="center">% знижки</Th>
                  <Th theme={theme} align="center">Різниця</Th>
                  <Th theme={theme} align="center">Статус</Th>
                  <Th theme={theme} align="center">Дії</Th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
                <SortableContext items={order.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {order.map((b, i) => (
                    <BundleRow key={b.id} bundle={b} index={i + 1} theme={theme} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </div>
        </AdminPanel>

        {/* Зовнішня смуга: кольори сусідства + номери пакетів-кандидатів у парі */}
        <div className="relative shrink-0" style={{ minWidth: 110, alignSelf: 'stretch' }}>
          {markers.map((m) => {
            const bundle = order.find((b) => b.id === m.id);
            if (!bundle) return null;
            const model = getBundleModel(bundle);
            const isActive = activeId === m.id;
            const liveTransform = rowTransforms[m.id];
            const style: React.CSSProperties = {
              position: 'absolute',
              top: m.top,
              left: 0,
              right: 0,
              height: m.height,
              transform: liveTransform || undefined,
              transition: activeId ? 'none' : 'transform 200ms ease',
              ...(isActive ? { opacity: 0.4, zIndex: 30 } : {}),
            };

            // Для кожного іншого бандла: чи може стати в пару по ШИРИНІ?
            // - perfect = canPair=true + однакова висота
            // - mismatch = canPair=true + різна висота (сходинка)
            // - не пара = ширина не вміщується → не показуємо
            const myParams = {
              type: bundle.type,
              paidCount: bundle.courses.filter((c) => !c.isFree).length,
              freeCount: bundle.courses.filter((c) => c.isFree).length,
              pickN: bundle.type === 'CHOICE_FREE' ? bundle.pickN : undefined,
            };
            const perfectNums: number[] = [];
            const mismatchNums: number[] = [];
            order.forEach((other, idx) => {
              if (other.id === bundle.id) return;
              const otherParams = {
                type: other.type,
                paidCount: other.courses.filter((c) => !c.isFree).length,
                freeCount: other.courses.filter((c) => c.isFree).length,
                pickN: other.type === 'CHOICE_FREE' ? other.pickN : undefined,
              };
              const pr = canPairBundles(myParams, otherParams);
              if (!pr.canPair) return;
              if (pr.quality === 'solid') perfectNums.push(idx + 1);
              else mismatchNums.push(idx + 1);
            });
            const isSolo = model.pairColors.every((p) => p.color === 'black');

            return (
              <div key={m.id}>
                <div style={style} className="flex items-center justify-center px-1">
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    {isSolo ? (
                      <span
                        title="Соло — ширина 1200px+, жоден інший пакет не вміщається поруч."
                        className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${dark ? 'text-slate-400' : 'text-stone-500'}`}
                      >
                        Соло
                      </span>
                    ) : (
                      <>
                        <div className="w-full flex flex-col gap-1 text-[10px] leading-tight">
                          <PairTextRow
                            label="Perfect"
                            nums={perfectNums}
                            dark={dark}
                            tone="good"
                          />
                          <PairTextRow
                            label="Height mismatch"
                            nums={mismatchNums}
                            dark={dark}
                            tone="warn"
                          />
                        </div>
                        <SingleDoubleToggle
                          bundleId={bundle.id}
                          initialMode={bundle.displayMode}
                          theme={theme}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </DndContext>
      )}
    </AdminShell>
  );
}

function BundleRow({ bundle, index, theme }: { bundle: BundleRowData; index: number; theme: Theme }) {
  const dark = theme === 'dark';
  const typeMeta = TYPE_META[bundle.type];
  const suspended = bundle.isSuspended;

  const titleParts = formatTitle(bundle.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bundle.id });
  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? (dark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.08)') : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      data-bundle-id={bundle.id}
      style={rowStyle}
      className={`transition-colors ${dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/80'}`}
    >
      {/* Drag handle */}
      <td className="px-2 py-3 align-middle text-center">
        <button
          type="button"
          title="Перетягніть щоб змінити порядок"
          aria-label="Перетягнути для зміни порядку"
          {...attributes}
          {...listeners}
          className={`group inline-flex items-center justify-center w-8 h-9 rounded-md cursor-grab active:cursor-grabbing touch-none transition-all ${
            dark
              ? 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100/80'
          }`}
        >
          <FaGripVertical className="text-[14px]" />
        </button>
      </td>

      {/* # + title */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={`inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-[12px] font-bold tabular-nums border ${
              suspended
                ? dark
                  ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                  : 'bg-amber-200/60 text-amber-900 border-amber-500/40'
                : dark
                  ? 'bg-white/[0.06] text-amber-200 border-white/[0.08]'
                  : 'bg-stone-100/80 text-stone-800 border-stone-300/60'
            }`}
          >
            {index}
          </span>
          <p
            className={`text-[13px] font-medium leading-tight ${
              suspended
                ? dark ? 'text-slate-500' : 'text-stone-500'
                : dark ? 'text-slate-100' : 'text-stone-900'
            }`}
          >
            {titleParts.map((part, i) => (
              <span key={i}>{i > 0 && <br />}{part}</span>
            ))}
          </p>
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-3 align-middle text-center">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg border leading-tight ${
            dark ? typeMeta.dark : typeMeta.light
          }`}
        >
          <span className="text-[13px] leading-none flex-shrink-0">{typeMeta.icon}</span>
          <span className="whitespace-pre-line text-left">{typeMeta.label}</span>
        </span>
      </td>


      {/* Courses */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-1">
          {bundle.courses.map(bc => (
            <span
              key={bc.id}
              title={bc.isFree ? 'Безкоштовно в пакеті' : 'Платний курс у пакеті'}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full w-fit border ${
                bc.isFree
                  ? dark
                    ? 'text-emerald-200 bg-emerald-500/10 border-emerald-400/25 pl-1'
                    : 'text-emerald-800 bg-emerald-200/40 border-emerald-500/30 pl-1'
                  : dark
                    ? 'text-slate-200 bg-white/[0.04] border-white/[0.08]'
                    : 'text-stone-700 bg-stone-100/70 border-stone-300/50'
              }`}
            >
              {bc.isFree && (
                <span
                  className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full flex-shrink-0 ${
                    dark
                      ? 'bg-emerald-400/90 text-stone-900 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                      : 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(5,150,105,0.3)]'
                  }`}
                >
                  <HiOutlineGift className="text-[10px]" strokeWidth={2.5} />
                </span>
              )}
              {bc.title}
            </span>
          ))}
        </div>
      </td>

      {/* Bundle price */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            dark
              ? 'text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.25)]'
              : 'text-amber-800 drop-shadow-[0_0_8px_rgba(180,83,9,0.2)]'
          }`}
        >
          {bundle.price.toLocaleString()} ₴
        </span>
      </td>

      {/* Full price */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        <span className={`text-[13px] tabular-nums ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {bundle.fullPrice.toLocaleString()} ₴
        </span>
      </td>

      {/* Discount pct */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        {bundle.discountPct > 0 ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              dark
                ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25'
                : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30'
            }`}
          >
            −{bundle.discountPct}%
          </span>
        ) : (
          <span className={`text-[12px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>0%</span>
        )}
      </td>

      {/* Difference */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        {bundle.difference > 0 ? (
          <span
            className={`text-[12px] font-medium tabular-nums ${
              dark ? 'text-emerald-300' : 'text-emerald-700'
            }`}
          >
            −{bundle.difference.toLocaleString()} ₴
          </span>
        ) : (
          <span className={`text-[12px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>0 ₴</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3 align-middle text-center">
        {suspended ? (
          <div className="flex flex-col items-center gap-1">
            <StatusPill theme={theme} tone="warning" icon={<FaPause className="text-[9px]" />}>
              Призупинено
            </StatusPill>
            {bundle.resumeAt && (
              <p className={`text-[10px] ${dark ? 'text-amber-300/70' : 'text-amber-700'}`}>
                Повернеться {new Date(bundle.resumeAt).toLocaleDateString('uk-UA')}
              </p>
            )}
          </div>
        ) : bundle.isPublished ? (
          <StatusPill theme={theme} tone="success" icon={<FaEye className="text-[9px]" />}>
            Опубліковано
          </StatusPill>
        ) : (
          <StatusPill theme={theme} tone="neutral" icon={<FaEyeSlash className="text-[9px]" />}>
            Чернетка
          </StatusPill>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-1.5 items-stretch min-w-[120px]">
          <Link
            href={`/dashboard/admin/bundles/${bundle.id}`}
            className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
              dark
                ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_14px_-4px_rgba(251,191,36,0.5)]'
                : 'bg-stone-900 text-amber-100 hover:bg-stone-800 shadow-sm'
            }`}
          >
            Редагувати
          </Link>
          <SuspendButton
            theme={theme}
            bundleId={bundle.id}
            suspendedAt={bundle.suspendedAt}
            resumeAt={bundle.resumeAt}
          />
          <DeleteBundleButton theme={theme} bundleId={bundle.id} bundleTitle={bundle.title} />
        </div>
      </td>
    </tr>
  );
}

function Th({
  theme,
  children,
  minWidth,
  align = 'left',
}: {
  theme: Theme;
  children: React.ReactNode;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  return (
    <th
      className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-3 py-3 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
      style={minWidth ? { minWidth } : undefined}
    >
      {children}
    </th>
  );
}

function StatusPill({
  theme,
  tone,
  icon,
  children,
}: {
  theme: Theme;
  tone: 'success' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  const cls = {
    success: dark
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25'
      : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30',
    warning: dark
      ? 'bg-amber-500/10 text-amber-200 border-amber-400/25'
      : 'bg-amber-200/40 text-amber-900 border-amber-500/40',
    neutral: dark
      ? 'bg-white/[0.04] text-slate-300 border-white/[0.08]'
      : 'bg-stone-100/80 text-stone-700 border-stone-300/60',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border w-fit mx-auto ${cls}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Single/Double toggle: Single = solo (повна ширина), Double = auto (пара з іншими). */
function SingleDoubleToggle({ bundleId, initialMode, theme }: {
  bundleId: string;
  initialMode: 'auto' | 'solo';
  theme: Theme;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'auto' | 'solo'>(initialMode);
  const [saving, setSaving] = useState(false);
  const dark = theme === 'dark';
  const isDouble = mode === 'auto';

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const set = async (next: 'auto' | 'solo') => {
    if (saving || next === mode) return;
    const prev = mode;
    setMode(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bundles/${bundleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayMode: next }),
        credentials: 'include',
      });
      if (!res.ok) setMode(prev);
      else router.refresh();
    } catch {
      setMode(prev);
    } finally {
      setSaving(false);
    }
  };

  const baseBtn = `flex-1 px-2 py-1 text-[9px] uppercase tracking-wider font-semibold rounded transition-colors disabled:opacity-50`;
  const activeCls = dark ? 'bg-amber-400/25 text-amber-200 border border-amber-400/40' : 'bg-amber-400/40 text-amber-900 border border-amber-500/50';
  const inactiveCls = dark ? 'bg-white/[0.04] text-slate-500 border border-white/[0.06] hover:text-slate-300' : 'bg-stone-900/[0.04] text-stone-500 border border-stone-300/40 hover:text-stone-700';

  return (
    <div className="w-full inline-flex gap-0.5" title="Single = один в ряду. Double = пара з іншим пакетом тієї ж ширини.">
      <button
        type="button"
        onClick={() => set('solo')}
        disabled={saving}
        className={`${baseBtn} ${!isDouble ? activeCls : inactiveCls}`}
      >
        Single
      </button>
      <button
        type="button"
        onClick={() => set('auto')}
        disabled={saving}
        className={`${baseBtn} ${isDouble ? activeCls : inactiveCls}`}
      >
        Double
      </button>
    </div>
  );
}

/** @deprecated замінено на SingleDoubleToggle */
function _UnusedDisplayModeToggle({
  bundleId,
  initialMode,
  theme,
}: {
  bundleId: string;
  initialMode: 'auto' | 'solo';
  theme: Theme;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'auto' | 'solo'>(initialMode);
  const [saving, setSaving] = useState(false);
  const dark = theme === 'dark';
  const grouping = mode === 'auto';

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const toggle = async () => {
    if (saving) return;
    const prev = mode;
    const next: 'auto' | 'solo' = grouping ? 'solo' : 'auto';
    setMode(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bundles/${bundleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayMode: next }),
        credentials: 'include',
      });
      if (!res.ok) {
        setMode(prev);
        return;
      }
      router.refresh();
    } catch {
      setMode(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={grouping}
      aria-label="Групувати з пакетами тієї ж ширини"
      title={grouping ? 'Групується з пакетами тієї ж ширини' : 'Один в ряду (повна ширина)'}
      onClick={toggle}
      disabled={saving}
      className={`relative inline-flex h-5 w-10 shrink-0 rounded-full transition-colors ${
        grouping
          ? dark
            ? 'bg-amber-400/80'
            : 'bg-amber-500'
          : dark
          ? 'bg-white/[0.08]'
          : 'bg-stone-300'
      } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          grouping ? 'translate-x-5 ml-0.5' : 'translate-x-0 ml-0.5'
        }`}
      />
    </button>
  );
}

function formatTitle(title: string): string[] {
  const tokens = title.split(/(\s*(?:,|\s+та\s+|\s+або\s+)\s*)/);
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const word = (tokens[i] ?? '').trim();
    if (!word) continue;
    const sep = (tokens[i + 1] ?? '').trim();
    parts.push(sep === ',' ? `${word},` : sep ? `${word} ${sep}` : word);
  }
  return parts;
}

/** @deprecated замінено на PairRow (показує номери пакетів з тим же кольором) */
function _UnusedModelBadge({ model, isVirtual = false, dark }: { model: BundleModel; isVirtual?: boolean; dark: boolean }) {
  const pairs = model.pairColors.filter((p) => p.color !== 'black');
  const isSolo = model.pairColors.every((p) => p.color === 'black');
  const label = isVirtual ? `~${model.paid}+${model.free}` : `M${model.id}`;
  const title = isVirtual
    ? `Не в frozen списку Моделей. Обчислено: ${model.widthPx}×${model.heightPx}. ${model.note}`
    : `${model.name} · ${model.widthPx}×${model.heightPx}`;
  return (
    <div
      title={title}
      className={`w-full rounded-lg border px-2 py-1.5 flex flex-col gap-1 ${
        isVirtual
          ? (dark ? 'bg-amber-500/[0.06] border-amber-400/30 border-dashed' : 'bg-amber-50/70 border-amber-400/50 border-dashed')
          : (dark ? 'bg-white/[0.035] border-white/[0.08]' : 'bg-white/80 border-stone-300/50')
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[11px] font-semibold ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
          {label}
        </span>
        <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {model.widthPx}×{model.heightPx}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {isSolo ? (
          <PairDot tag={{ color: 'black' }} dark={dark} />
        ) : (
          pairs.map((p) => <PairDot key={p.color} tag={p} dark={dark} />)
        )}
      </div>
    </div>
  );
}

/** Рядок "Perfect: 2, 5, 6" або "Height mismatch: 3, 7". */
function PairTextRow({ label, nums, dark, tone }: { label: string; nums: number[]; dark: boolean; tone: 'good' | 'warn' }) {
  const labelColor = tone === 'good'
    ? (dark ? 'text-emerald-400' : 'text-emerald-700')
    : (dark ? 'text-amber-400' : 'text-amber-700');
  const valueColor = dark ? 'text-slate-200' : 'text-stone-800';
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-[9px] uppercase tracking-wider font-semibold ${labelColor}`}>{label}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${valueColor}`}>
        {nums.length ? nums.join(', ') : '—'}
      </span>
    </div>
  );
}

/** @deprecated використано PairTextRow */
function PairRow({ color, solid, striped, dark }: { color: PairColor; solid: number[]; striped: number[]; dark: boolean }) {
  const meta = PAIR_COLOR_META[color];
  const title = `${meta.label}\nЧисті пари (однакова висота): ${solid.length ? solid.join(', ') : 'немає'}\nЗі сходинкою (різна висота): ${striped.length ? striped.join(', ') : 'немає'}`;
  return (
    <div
      title={title}
      className="flex items-center gap-1.5 px-1 py-0.5 flex-wrap"
    >
      <PairDot tag={{ color }} dark={dark} />
      <span className={`text-[11px] font-semibold tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
        {solid.length ? solid.join(', ') : '—'}
      </span>
      {striped.length > 0 && (
        <span
          className={`text-[9px] italic tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}
          title="Пари зі сходинкою (різна висота)"
        >
          [{striped.join(',')}]
        </span>
      )}
    </div>
  );
}

function PairDot({ tag, dark }: { tag: PairTag; dark: boolean }) {
  const meta = PAIR_COLOR_META[tag.color];
  const cls = dark ? meta.dark : meta.light;
  const title = `${meta.label}${tag.striped ? ' (різна висота — штрихована)' : ''}`;
  const style: React.CSSProperties = tag.striped
    ? {
        backgroundImage: `repeating-linear-gradient(45deg, ${meta.dot}99 0, ${meta.dot}99 2px, transparent 2px, transparent 5px)`,
      }
    : {};
  return (
    <span
      title={title}
      className={`inline-block w-4 h-4 rounded-sm border ${cls}`}
      style={style}
    />
  );
}

/** Легенда — пояснення для правої колонки. */
function PairingLegend({ dark }: { dark: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] ${dark ? 'bg-white/[0.03] border-white/[0.08] text-slate-400' : 'bg-white/70 border-stone-300/50 text-stone-600'}`}>
      <span className={`uppercase tracking-[0.18em] font-semibold ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
        У правій колонці:
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`text-[9px] uppercase tracking-wider font-semibold ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>Perfect</span>
        <span>— вміщується в ряд + висота збігається</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`text-[9px] uppercase tracking-wider font-semibold ${dark ? 'text-amber-400' : 'text-amber-700'}`}>Height mismatch</span>
        <span>— вміщується по ширині, але висота різна (сходинка)</span>
      </span>
      <span className="inline-flex items-center gap-1.5 ml-auto">
        <span className="font-semibold">Single</span><span>— один в ряду · </span>
        <span className="font-semibold">Double</span><span>— у парі</span>
      </span>
    </div>
  );
}

/** Коннектор між двома сусідніми рядками: лінія + підпис. */
function PairConnector({ result, dark, top, height }: { result: PairResult; dark: boolean; top: number; height: number }) {
  if (!result.canPair) {
    // Немає пари — не малюємо лінію (кожен буде в окремому ряду)
    return null;
  }
  const lineColor = result.quality === 'solid'
    ? (dark ? '#34d399' : '#10b981')
    : (dark ? '#fbbf24' : '#d97706');
  const lineStyle = result.quality === 'solid' ? 'solid' : 'dashed';
  const label = result.quality === 'solid' ? 'В ОДИН РЯД' : 'В ОДИН РЯД (різна висота)';
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height: Math.max(0, height),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div
          style={{
            width: 2,
            height: Math.max(0, height - 18),
            borderLeft: `2px ${lineStyle} ${lineColor}`,
          }}
        />
        <span
          className={`text-[8px] uppercase font-bold tracking-wider ${dark ? '' : ''}`}
          style={{ color: lineColor, letterSpacing: '0.12em' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** Toggle між Table view і Rows view (конструктор). */
function ViewModeSwitch({ mode, setMode, dark }: { mode: 'table' | 'rows'; setMode: (m: 'table' | 'rows') => void; dark: boolean }) {
  const base = `inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-full transition-all`;
  const active = dark ? 'bg-amber-400/90 text-stone-900' : 'bg-stone-900 text-amber-100';
  const inactive = dark ? 'bg-white/[0.04] text-slate-400 hover:text-slate-200' : 'bg-stone-900/[0.04] text-stone-600 hover:text-stone-900';
  return (
    <div className="inline-flex gap-1 p-1 rounded-full" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
      <button
        type="button"
        onClick={() => setMode('table')}
        className={`${base} ${mode === 'table' ? active : inactive}`}
        title="Класична таблиця"
      >
        <FaTable className="text-[11px]" /> Таблиця
      </button>
      <button
        type="button"
        onClick={() => setMode('rows')}
        className={`${base} ${mode === 'rows' ? active : inactive}`}
        title="Візуальний конструктор рядів"
      >
        <FaTh className="text-[11px]" /> Ряди
      </button>
    </div>
  );
}

const ROW_WIDTH_LIMIT_NATIVE = 1460;
/** Ширина "сторінки" сайту в native пікселях — те що юзер бачить у браузері. */
const SITE_CANVAS_NATIVE_W = 1460;

/** Початкова розбивка бандлів на слоти: pack-by-2 в DB порядку з урахуванням
 *  displayMode ('solo' = завжди один у слоті) і перевіркою сумарної ширини ≤ 1460. */
function buildInitialSlots(bundles: BundleRowData[]): BundleRowData[][] {
  const slots: BundleRowData[][] = [];
  let i = 0;
  while (i < bundles.length) {
    const a = bundles[i];
    if (a.displayMode === 'solo') {
      slots.push([a]);
      i++;
      continue;
    }
    const b = bundles[i + 1];
    if (!b || b.displayMode === 'solo') {
      slots.push([a]);
      i++;
      continue;
    }
    const mA = getBundleModel(a);
    const mB = getBundleModel(b);
    if (mA.widthPx + mB.widthPx <= ROW_WIDTH_LIMIT_NATIVE) {
      slots.push([a, b]);
      i += 2;
    } else {
      slots.push([a]);
      i++;
    }
  }
  return slots;
}

/** Row View v2 — кожен пакет у своєму рядку, пропорційно. Drag-and-drop для пар.
 *
 * Slots: масив [[b1], [b2], [b3, b4], ...] — кожен sub-array = візуальний ряд.
 * Початково кожен пакет у своєму слоті. Юзер:
 *   - Drag handle зліва → тягне цілий слот вертикально для reorder
 *   - Drag на сам пакет → тягне той пакет, може дропнути на інший слот для пари
 *     (якщо ширини вміщаються в 1460px)
 *   - Якщо в слоті вже 2 пакети і перетягують один з них → роз'єднання
 */
function RowsView({ bundles, dark }: { bundles: BundleRowData[]; dark: boolean }) {
  const [slots, setSlots] = useState<BundleRowData[][]>(() => buildInitialSlots(bundles));
  const [dragKind, setDragKind] = useState<'slot' | 'bundle' | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setSlots(buildInitialSlots(bundles));
  }, [bundles]);

  const globalIdxOf = (id: string) => bundles.findIndex((b) => b.id === id) + 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { kind?: 'slot' | 'bundle' } | undefined;
    setDragKind(data?.kind ?? null);
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setDragKind(null);
    setActiveId(null);
    if (!over) return;
    const data = active.data.current as { kind?: 'slot' | 'bundle'; slotIdx?: number; bundleId?: string } | undefined;

    if (data?.kind === 'slot') {
      // Reorder слотів
      const fromIdx = data.slotIdx!;
      const overData = over.data.current as { kind?: string; slotIdx?: number } | undefined;
      if (!overData?.slotIdx && overData?.slotIdx !== 0) return;
      const toIdx = overData.slotIdx!;
      if (fromIdx === toIdx) return;
      setSlots((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    } else if (data?.kind === 'bundle') {
      const bundleId = data.bundleId!;
      const overData = over.data.current as { kind?: string; slotIdx?: number; bundleId?: string } | undefined;
      if (overData?.kind === 'slot-pair-zone' && overData.slotIdx !== undefined) {
        // Drop на pair-зону іншого слота
        setSlots((prev) => {
          const fromSlotIdx = prev.findIndex((s) => s.some((b) => b.id === bundleId));
          if (fromSlotIdx === -1 || fromSlotIdx === overData.slotIdx) return prev;
          const bundle = prev[fromSlotIdx].find((b) => b.id === bundleId)!;
          const targetSlot = prev[overData.slotIdx!];
          if (targetSlot.length >= 2) return prev; // вже пара
          // Перевірити сумісність по ширині
          const mA = getBundleModel(targetSlot[0]);
          const mB = getBundleModel(bundle);
          if (mA.widthPx + mB.widthPx > ROW_WIDTH_LIMIT_NATIVE) return prev;
          const next = [...prev];
          next[overData.slotIdx!] = [...targetSlot, bundle];
          // Видаляємо зі старого слота — якщо він був solo, видаляємо слот; інакше лишаємо iншого бандла
          if (next[fromSlotIdx].length === 1) {
            next.splice(fromSlotIdx, 1);
          } else {
            next[fromSlotIdx] = next[fromSlotIdx].filter((b) => b.id !== bundleId);
          }
          return next;
        });
      }
    }
  };

  return (
    <>
      <div className={`mb-4 rounded-lg border px-4 py-2.5 text-[11px] ${dark ? 'bg-white/[0.03] border-white/[0.08] text-slate-400' : 'bg-white/70 border-stone-300/50 text-stone-600'}`}>
        <span className="font-semibold">Як користуватись:</span> перетягни ручку зліва щоб змінити порядок рядів; перетягни сам пакет на правий край іншого ряду щоб поставити в пару (якщо ширини вміщаються).
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext
          items={slots.map((slot, idx) => `slot-${idx}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-5 py-2">
            {slots.map((slot, sIdx) => (
              <SlotRow
                key={slot.map((b) => b.id).join('-')}
                slot={slot}
                slotIdx={sIdx}
                globalIdxOf={globalIdxOf}
                dark={dark}
                dragActive={dragKind !== null}
                dragKind={dragKind}
                activeId={activeId}
              />
            ))}
            {slots.length === 0 && (
              <div className={`text-center text-[12px] italic ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Пакетів немає
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

/** Один візуальний рядок — містить 1 або 2 пакети. Drag-handle щоб переносити весь слот;
 *  drop-zone справа для прийняття бандла з іншого слота (пара). */
function SlotRow({
  slot,
  slotIdx,
  globalIdxOf,
  dark,
  dragActive,
  dragKind,
  activeId,
}: {
  slot: BundleRowData[];
  slotIdx: number;
  globalIdxOf: (id: string) => number;
  dark: boolean;
  dragActive: boolean;
  dragKind: 'slot' | 'bundle' | null;
  activeId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `slot-${slotIdx}`,
    data: { kind: 'slot', slotIdx },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const totalWidthNative = slot.reduce((sum, b) => sum + getBundleModel(b).widthPx, 0) + (slot.length - 1) * 40;
  const canAcceptPair = slot.length === 1 && dragKind === 'bundle';
  const canvasW = Math.round(SITE_CANVAS_NATIVE_W * MINIATURE_SCALE);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-stretch justify-center gap-3"
    >
      {/* Drag handle + label — абсолютно позиційовані зліва щоб не ламати центрування */}
      <div className="absolute left-0 top-0 bottom-0 flex items-stretch gap-2">
        <button
          type="button"
          title="Перетягніть щоб змінити порядок рядів"
          {...attributes}
          {...listeners}
          className={`shrink-0 w-7 rounded-md flex items-center justify-center cursor-grab active:cursor-grabbing select-none ${
            dark ? 'bg-white/[0.04] text-slate-500 hover:text-slate-300' : 'bg-stone-900/[0.04] text-stone-400 hover:text-stone-700'
          }`}
        >
          <FaGripVertical className="text-[14px]" />
        </button>
        <div className={`shrink-0 w-12 flex flex-col items-center justify-center ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          <div className="text-[9px] uppercase tracking-[0.16em] font-semibold">Ряд</div>
          <div className={`text-[18px] font-bold tabular-nums ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{slotIdx + 1}</div>
        </div>
      </div>
      {/* Site canvas — імітація реальної ширини сторінки, центрована */}
      <div
        className={`rounded-lg border ${
          dark ? 'bg-stone-900/40 border-white/[0.04]' : 'bg-white/40 border-stone-300/40'
        }`}
        style={{ width: canvasW, padding: '12px 0', position: 'relative' }}
      >
        {/* Рулетка зверху показує real page width */}
        <div
          aria-hidden
          className={`absolute top-0 left-0 right-0 h-[3px] ${dark ? 'bg-amber-400/20' : 'bg-amber-500/30'}`}
        />
        <div
          className={`absolute top-[4px] left-1 text-[8px] uppercase tracking-wider ${dark ? 'text-amber-400/60' : 'text-amber-700/70'}`}
        >
          {SITE_CANVAS_NATIVE_W}px (ширина сайту)
        </div>
        <div className="flex items-start justify-center gap-10 pt-3">
          {slot.map((b) => (
            <DraggableBundle
              key={b.id}
              bundle={b}
              number={globalIdxOf(b.id)}
              dark={dark}
              isActive={activeId === `bundle-${b.id}`}
            />
          ))}
          {canAcceptPair && (
            <PairDropZone
              slotIdx={slotIdx}
              existingBundle={slot[0]}
              dark={dark}
              activeId={activeId}
            />
          )}
        </div>
        {/* Width footer */}
        <div
          className={`mt-2 pt-1.5 border-t flex justify-between text-[9px] ${
            dark ? 'border-white/[0.04] text-slate-500' : 'border-stone-300/40 text-stone-500'
          }`}
          style={{ paddingLeft: 6, paddingRight: 6 }}
        >
          <span>
            Зайнято: <b className={dark ? 'text-slate-300' : 'text-stone-700'}>{totalWidthNative}px</b> / {SITE_CANVAS_NATIVE_W}px
          </span>
          <span>
            {slot.length === 2 ? 'пара' : 'соло'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Бандл як draggable — можна тягнути сам пакет щоб переставити в інший слот. */
function DraggableBundle({
  bundle,
  number,
  dark,
  isActive,
}: {
  bundle: BundleRowData;
  number: number;
  dark: boolean;
  isActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: `bundle-${bundle.id}`,
    data: { kind: 'bundle', bundleId: bundle.id },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging || isActive ? 0.4 : 1,
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BundleMiniature bundle={bundle} number={number} dark={dark} />
    </div>
  );
}

/** Drop-zone справа від solo-слота — сюди можна кинути інший бандл щоб створити пару. */
function PairDropZone({
  slotIdx,
  existingBundle,
  dark,
  activeId,
}: {
  slotIdx: number;
  existingBundle: BundleRowData;
  dark: boolean;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `pair-zone-${slotIdx}`,
    data: { kind: 'slot-pair-zone', slotIdx },
  });
  // Evaluate width fit when bundle is being dragged
  const existingModel = getBundleModel(existingBundle);
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
        isOver
          ? (dark ? 'border-emerald-400 bg-emerald-500/10' : 'border-emerald-500 bg-emerald-200/30')
          : (dark ? 'border-white/10 hover:border-white/20' : 'border-stone-300/50 hover:border-stone-400/60')
      }`}
      style={{
        width: 220,
        height: existingModel.heightPx * MINIATURE_SCALE,
        minHeight: 100,
      }}
    >
      <span className={`text-[11px] font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {isOver ? '+ Пара' : 'Кинь сюди для пари'}
      </span>
    </div>
  );
}

const MINIATURE_SCALE = 0.35;

function BundleMiniature({ bundle, number, dark }: { bundle: BundleRowData; number: number; dark: boolean }) {
  const model = getBundleModel(bundle);
  const scaledW = Math.round(model.widthPx * MINIATURE_SCALE);
  const scaledH = Math.round(model.heightPx * MINIATURE_SCALE);
  const paid = bundle.miniaturePaid ?? [];
  const free = bundle.miniatureFree ?? [];
  return (
    <div className="relative group">
      <div
        className={`absolute -top-2 -left-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold tabular-nums shadow-md ${
          dark ? 'bg-amber-400/90 text-stone-900' : 'bg-stone-900 text-amber-100'
        }`}
      >
        {number}
      </div>
      {/* Hover overlay з actions */}
      <div
        className={`absolute inset-0 z-20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto flex items-start justify-end p-2 gap-1`}
        style={{ backgroundColor: 'rgba(0,0,0,0)' }}
      >
        <Link
          href={`/dashboard/admin/bundles/${bundle.id}`}
          title="Редагувати"
          className={`w-8 h-8 rounded-md flex items-center justify-center text-[12px] font-semibold shadow-md ${
            dark ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300' : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
          }`}
        >
          ✎
        </Link>
      </div>
      {/* Scaled BundleCard */}
      <div
        style={{
          width: scaledW,
          height: scaledH,
          overflow: 'hidden',
          borderRadius: Math.round(24 * MINIATURE_SCALE),
        }}
      >
        <div
          style={{
            width: model.widthPx,
            height: model.heightPx,
            transform: `scale(${MINIATURE_SCALE})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        >
          <BundleCard
            title={bundle.title}
            price={bundle.price}
            slug={bundle.id}
            courses={paid}
            freeCourses={free}
            bundleType={bundle.type}
            freeCount={bundle.pickN ?? 0}
            currency="грн"
            priceLabel="ЦІНА ПАКЕТУ"
            bundleLabel="ПАКЕТ"
            saveLabel="Економія"
            buyLabel="Купити пакет"
            benefits={[
              { icon: '📼', title: 'Навчання в записі' },
              { icon: '💛', title: 'Підтримка кураторів' },
              { icon: '📜', title: 'Сертифікат UIMP' },
            ]}
            layout="full"
            miniature
          />
        </div>
      </div>
    </div>
  );
}
