'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaPlus, FaEye, FaEyeSlash, FaPause, FaGripVertical } from 'react-icons/fa';
import { HiOutlineBookOpen, HiOutlineGift, HiPencil, HiTrash } from 'react-icons/hi2';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  horizontalListSortingStrategy,
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
  /** Номер ряду у Row View / на публічній /courses. null = ще не згруповано, fallback до pack-by-2. */
  rowGroup: number | null;
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
  // Rows — основний view за замовчуванням. Synchronizація order з Rows відбувається через
  // колбек persistOrder, який оновлює local state + пушить на сервер.
  const [viewMode, setViewMode] = useState<'table' | 'rows'>('rows');
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
    persistOrder(next);
  };

  // Єдина точка збереження порядку + групування у ряди. Викликається з Rows view (slots з dnd)
  // і з Table view (flat reorder → дефолтний pack-by-2).
  const persistSlots = async (slots: BundleRowData[][]) => {
    const flat = slots.flat();
    // Локально оновлюємо order з новими rowGroup — щоб Rows + Table одразу бачили стабільне групування.
    const stamped: BundleRowData[] = [];
    slots.forEach((slot, rowGroup) => {
      slot.forEach((b) => stamped.push({ ...b, rowGroup }));
    });
    setOrder(stamped);
    const payload = stamped.map((b) => ({ id: b.id, rowGroup: b.rowGroup }));
    setSaving(true);
    try {
      await fetch('/api/admin/bundles/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: payload }),
      });
    } finally {
      setSaving(false);
    }
    void flat;
  };

  // Table view reorder — flat список. Ряди автогрупуємо за тією самою логікою, що й Rows view
  // використовує при першому завантаженні (displayMode + width ≤ 1460).
  const persistOrder = async (next: BundleRowData[]) => {
    persistSlots(buildInitialSlots(next));
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
        <RowsView bundles={order} dark={dark} onReorder={persistSlots} />
      ) : (
        <DndContext
          id="bundles-table-dnd"
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
        onClick={() => setMode('rows')}
        className={`${base} ${mode === 'rows' ? active : inactive}`}
        title="Візуальний конструктор рядів"
      >
        <FaTh className="text-[11px]" /> Ряди
      </button>
      <button
        type="button"
        onClick={() => setMode('table')}
        className={`${base} ${mode === 'table' ? active : inactive}`}
        title="Класична таблиця"
      >
        <FaTable className="text-[11px]" /> Таблиця
      </button>
    </div>
  );
}

const ROW_WIDTH_LIMIT_NATIVE = 1536;
/** Ширина "сторінки" сайту в native пікселях — те що юзер бачить у браузері. */
const SITE_CANVAS_NATIVE_W = 1536;
const SITE_CANVAS_NATIVE_H = 960;
/** Масштаб мініатюр у builder-і. Pакет N×M native рендериться як N·s × M·s. */
const MINIATURE_SCALE = 0.5;

/** Розбивка бандлів на слоти для Row View / публічної сторінки.
 *
 *  1) Якщо хоча б один бандл має rowGroup (не null) — групуємо строго за rowGroup
 *     у DB порядку. Це source of truth після збереження з dnd-builder-а.
 *  2) Інакше (усі null — свіжі бандли, ще не торкалися builder-а) — fallback pack-by-2
 *     з урахуванням displayMode ('solo' = завжди один у слоті) і сумарної ширини ≤ 1460.
 */
function buildInitialSlots(bundles: BundleRowData[]): BundleRowData[][] {
  const hasPersistedGroups = bundles.some((b) => b.rowGroup !== null && b.rowGroup !== undefined);
  if (hasPersistedGroups) {
    const slots: BundleRowData[][] = [];
    const byGroup = new Map<number, BundleRowData[]>();
    const ungrouped: BundleRowData[] = [];
    for (const b of bundles) {
      if (b.rowGroup === null || b.rowGroup === undefined) {
        ungrouped.push(b);
        continue;
      }
      const arr = byGroup.get(b.rowGroup) ?? [];
      arr.push(b);
      byGroup.set(b.rowGroup, arr);
    }
    // Бандли без rowGroup (щойно створені з API — sortOrder=min−1, тобто зверху
    // по даним) — кожен у своєму слоті, НА ПОЧАТОК списку. Зберігаємо порядок
    // `ungrouped` — він вже відсортований по sortOrder asc (наймолодший перший).
    for (const b of ungrouped) slots.push([b]);
    const sortedKeys = Array.from(byGroup.keys()).sort((a, b) => a - b);
    for (const k of sortedKeys) slots.push(byGroup.get(k)!);
    return slots;
  }
  // Fallback: pack-by-2 за displayMode + шириною.
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
function RowsView({
  bundles,
  dark,
  onReorder,
}: {
  bundles: BundleRowData[];
  dark: boolean;
  onReorder: (slots: BundleRowData[][]) => void;
}) {
  const [slots, setSlots] = useState<BundleRowData[][]>(() => buildInitialSlots(bundles));
  const [dragKind, setDragKind] = useState<'slot' | 'bundle' | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Якщо user мутував slots локально — зберігаємо next тут, щоб після commit
  // useEffect[slots] прочитав і викликав onReorder. Зовнішні зміни bundles НЕ
  // встановлюють цей ref, тож не викликають зайвий onReorder loop.
  const pendingUserNextRef = useRef<BundleRowData[][] | null>(null);

  // Коли bundles prop змінюється ЗОВНІШНЬО (з Table drag / iншої сесії),
  // перебудовуємо slots — але тільки якщо порядок дійсно різний від поточних slots.
  // (Після нашого власного onReorder bundles вже збігається з slots → skip.)
  useEffect(() => {
    const slotsFlatIds = slots.flat().map((b) => b.id).join(',');
    const bundlesIds = bundles.map((b) => b.id).join(',');
    if (slotsFlatIds !== bundlesIds) {
      setSlots(buildInitialSlots(bundles));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundles]);

  // Після локальної мутації slots — пушимо slots у parent (який синхронізує Table + DB + rowGroup).
  useEffect(() => {
    if (pendingUserNextRef.current) {
      const next = pendingUserNextRef.current;
      pendingUserNextRef.current = null;
      onReorder(next);
    }
  }, [slots, onReorder]);

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
        pendingUserNextRef.current = next;
        return next;
      });
    } else if (data?.kind === 'bundle') {
      const bundleId = data.bundleId!;
      const overData = over.data.current as { kind?: string; slotIdx?: number; insertAt?: number; bundleId?: string } | undefined;
      if (overData?.kind === 'bundle' && overData.bundleId && overData.bundleId !== bundleId) {
        // Drop бандла на інший бандл — свап позицій (у тому ж слоті = reorder lr;
        // в іншому слоті = обмін місцями, з перевіркою сумарної ширини пари після свопу).
        const targetId = overData.bundleId;
        setSlots((prev) => {
          const fromSlotIdx = prev.findIndex((s) => s.some((b) => b.id === bundleId));
          const toSlotIdx = prev.findIndex((s) => s.some((b) => b.id === targetId));
          if (fromSlotIdx === -1 || toSlotIdx === -1) return prev;

          if (fromSlotIdx === toSlotIdx) {
            const slot = prev[fromSlotIdx];
            if (slot.length < 2) return prev;
            const next = [...prev];
            next[fromSlotIdx] = [...slot].reverse();
            pendingUserNextRef.current = next;
            return next;
          }

          const fromSlot = prev[fromSlotIdx];
          const toSlot = prev[toSlotIdx];
          const fromPos = fromSlot.findIndex((b) => b.id === bundleId);
          const toPos = toSlot.findIndex((b) => b.id === targetId);
          const bundleA = fromSlot[fromPos];
          const bundleB = toSlot[toPos];

          if (toSlot.length === 2) {
            const other = toSlot[1 - toPos];
            if (getBundleModel(other).widthPx + getBundleModel(bundleA).widthPx > ROW_WIDTH_LIMIT_NATIVE) return prev;
          }
          if (fromSlot.length === 2) {
            const other = fromSlot[1 - fromPos];
            if (getBundleModel(other).widthPx + getBundleModel(bundleB).widthPx > ROW_WIDTH_LIMIT_NATIVE) return prev;
          }

          const next = [...prev];
          const nextFrom = [...fromSlot];
          nextFrom[fromPos] = bundleB;
          next[fromSlotIdx] = nextFrom;
          const nextTo = [...toSlot];
          nextTo[toPos] = bundleA;
          next[toSlotIdx] = nextTo;
          pendingUserNextRef.current = next;
          return next;
        });
      } else if (overData?.kind === 'slot-pair-zone' && overData.slotIdx !== undefined) {
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
          pendingUserNextRef.current = next;
          return next;
        });
      } else if (overData?.kind === 'empty-slot' && overData.insertAt !== undefined) {
        // Drop на empty-slot зону — винести бандл у новий окремий ряд на позицію insertAt
        setSlots((prev) => {
          const fromSlotIdx = prev.findIndex((s) => s.some((b) => b.id === bundleId));
          if (fromSlotIdx === -1) return prev;
          const fromSlot = prev[fromSlotIdx];
          // Якщо бандл вже соло — немає сенсу виносити в новий ряд (він і так сам)
          if (fromSlot.length === 1) return prev;
          const bundle = fromSlot.find((b) => b.id === bundleId)!;
          const insertAt = overData.insertAt!;
          const next = [...prev];
          // Видаляємо бандл зі старого слота (там лишається інший)
          next[fromSlotIdx] = fromSlot.filter((b) => b.id !== bundleId);
          // Вставляємо новий slot з одним бандлом на позицію insertAt.
          // Старий slot не видаляємо (він ще має другого) → insertAt не зсувається.
          next.splice(insertAt, 0, [bundle]);
          pendingUserNextRef.current = next;
          return next;
        });
      }
    }
  };

  return (
    <>
      <div className={`mb-4 rounded-lg border px-4 py-2.5 text-[11px] ${dark ? 'bg-white/[0.03] border-white/[0.08] text-slate-400' : 'bg-white/70 border-stone-300/50 text-stone-600'}`}>
        <span className="font-semibold">Як користуватись:</span> перетягни pill «Ряд N» у шапці щоб змінити порядок; перетягни пакет на solo-сторінку — стане в пару; кинь у зону «Винести в новий ряд» — створить окремий ряд.
      </div>
      <DndContext id="bundles-rows-dnd" sensors={sensors} collisionDetection={closestCenter} autoScroll={false} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext
          items={slots.map((slot, idx) => `slot-${idx}`)}
          strategy={rectSortingStrategy}
        >
          {slots.length === 0 ? (
            <div className={`text-center text-[12px] italic ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Пакетів немає
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              {/* 1-колонка центрована. Між кожним рядом — empty-slot drop zone
                  (видима тільки при drag бандла з пари). */}
              <EmptySlotDropZone
                insertAt={0}
                dark={dark}
                highlighted={dragKind === 'bundle'}
                visible={dragKind === 'bundle'}
              />
              {slots.map((slot, sIdx) => (
                // Ключ НЕЗАЛЕЖНИЙ від порядку бандлів у слоті (сортуємо IDs) —
                // щоб при swap left↔right React не перемонтовував слот, а просто ререндерив з новим slot prop.
                <div key={[...slot].map((b) => b.id).sort().join('|')} className="flex flex-col items-center gap-2 w-full">
                  <SlotRow
                    slot={slot}
                    slotIdx={sIdx}
                    globalIdxOf={globalIdxOf}
                    dark={dark}
                    dragActive={dragKind !== null}
                    dragKind={dragKind}
                    activeId={activeId}
                  />
                  <EmptySlotDropZone
                    insertAt={sIdx + 1}
                    dark={dark}
                    highlighted={dragKind === 'bundle'}
                    visible={dragKind === 'bundle'}
                  />
                </div>
              ))}
            </div>
          )}
        </SortableContext>
        {/* DragOverlay — рендерить клон активного елемента у portal що точно слідує за курсором.
            Без нього scaled-transformed content всередині item погано відображає drag-рух. */}
        <DragOverlay dropAnimation={null}>
          {dragKind === 'bundle' && activeId
            ? (() => {
                const bundleId = activeId.replace(/^bundle-/, '');
                const bundle = bundles.find((b) => b.id === bundleId);
                if (!bundle) return null;
                return (
                  <div style={{ cursor: 'grabbing', pointerEvents: 'none' }}>
                    <BundleMiniature bundle={bundle} number={globalIdxOf(bundle.id)} dark={dark} />
                  </div>
                );
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

/** Один візуальний рядок — містить 1 або 2 пакети.
 *  - Drag-handle зліва перемішує ряди (вертикальний reorder).
 *  - Весь canvas = drop-target для pair coupling (коли там solo).
 *  - Написи (header/розмір) винесені ПОЗА canvas. */
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

  // Gap між пакетами на реальному /courses сайті — gap-4 (16px native).
  const PAIR_GAP_NATIVE = 16;
  const pairGapScaled = Math.round(PAIR_GAP_NATIVE * MINIATURE_SCALE);
  const totalWidthNative = slot.reduce((sum, b) => sum + getBundleModel(b).widthPx, 0) + (slot.length - 1) * PAIR_GAP_NATIVE;
  const totalHeightNative = slot.reduce((mx, b) => Math.max(mx, getBundleModel(b).heightPx), 0);
  const canAcceptPair = slot.length === 1 && dragKind === 'bundle';
  const canvasW = Math.round(SITE_CANVAS_NATIVE_W * MINIATURE_SCALE);

  // Весь canvas — drop-target для pair coupling (коли там solo і dragKind='bundle').
  // Це дозволяє легко попасти з будь-якого ряду, не цілячись у вузьку pair-zone.
  const { setNodeRef: setPairDropRef, isOver: isPairOver } = useDroppable({
    id: `slot-pair-zone-${slotIdx}`,
    data: { kind: 'slot-pair-zone', slotIdx },
    disabled: !canAcceptPair,
  });

  return (
    <div ref={setNodeRef} style={{ ...style, width: canvasW }} className="flex flex-col">
      {/* Header з інтегрованим drag-handle + row#. Width точно = canvasW, fit у grid-cell. */}
      <div className="flex items-center gap-2 mb-2 px-1">
        {/* Drag handle + Ряд N — компактний pill */}
        <button
          type="button"
          title="Перетягніть щоб змінити порядок рядів"
          {...attributes}
          {...listeners}
          className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold cursor-grab active:cursor-grabbing select-none transition-colors ${
            dark
              ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-slate-100'
              : 'bg-stone-900/[0.06] text-stone-700 hover:bg-stone-900/[0.12] hover:text-stone-900'
          }`}
        >
          <FaGripVertical className="text-[12px] opacity-70" />
          <span className="uppercase tracking-wider text-[10px] opacity-80">Ряд</span>
          <span className="tabular-nums">{slotIdx + 1}</span>
        </button>
        {/* Інфо-рядок: ширина сайту · зайнято · solo/пара */}
        <div
          className={`flex-1 flex items-center justify-between text-[12px] ${
            dark ? 'text-slate-400' : 'text-stone-600'
          }`}
        >
          <span className="uppercase tracking-wider">
            Ширина: <b className={dark ? 'text-slate-300' : 'text-stone-700'}>{SITE_CANVAS_NATIVE_W}px</b>
          </span>
          <span>
            Зайнято: <b className={dark ? 'text-slate-300' : 'text-stone-700'}>{totalWidthNative}px</b>
          </span>
        </div>
      </div>
      {/* Canvas — тільки пакети. Drop-target для pair coupling (isPairOver підсвітка). */}
      <div
        ref={setPairDropRef}
        className={`rounded-lg border shadow-inner transition-all ${
          isPairOver
            ? (dark ? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/40' : 'border-emerald-500 bg-emerald-200/30 ring-2 ring-emerald-500/40')
            : dark
              ? 'bg-slate-950/60 border-amber-400/10'
              : 'bg-stone-800/[0.06] border-stone-400/30'
        }`}
        style={{
          width: canvasW,
          padding: '14px 0',
          position: 'relative',
          boxSizing: 'border-box',
          backgroundImage: dark
            ? 'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        {/* Вертикальна підпис — висота сторінки. Абсолют зліва від canvas. */}
        <div
          aria-hidden
          className={`absolute pointer-events-none text-[11px] uppercase tracking-[0.2em] font-semibold tabular-nums ${
            dark ? 'text-slate-400' : 'text-stone-600'
          }`}
          style={{
            left: -18,
            top: 12,
            transform: 'rotate(180deg)',
            writingMode: 'vertical-rl',
            whiteSpace: 'nowrap',
          }}
        >
          Висота: <b className={dark ? 'text-slate-300' : 'text-stone-800'}>{SITE_CANVAS_NATIVE_H}px</b>
        </div>
        {/* Вертикальна підпис — «зайнято» по вертикалі + solo/пара. Справа від canvas, зверху. */}
        <div
          aria-hidden
          className={`absolute pointer-events-none text-[12px] tabular-nums ${
            dark ? 'text-slate-400' : 'text-stone-600'
          }`}
          style={{
            right: -18,
            top: 12,
            transform: 'rotate(180deg)',
            writingMode: 'vertical-rl',
            whiteSpace: 'nowrap',
          }}
        >
          Зайнято: <b className={dark ? 'text-slate-300' : 'text-stone-700'}>{totalHeightNative}px</b>
        </div>
        <div className="flex items-start justify-center" style={{ gap: pairGapScaled }}>
          {/* Вкладений SortableContext з horizontalListSortingStrategy — dnd-kit САМ анімує
              зсув сусідніх карток при драгу (витискання ефект) і highlight-ить позицію drop-у.
              Ключ з унікальними ID слота щоб контекст не «застрягав» при reshuffle слотів. */}
          <SortableContext
            key={slot.map((b) => b.id).sort().join('|')}
            items={slot.map((b) => `bundle-${b.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {slot.map((b, bi) => (
              <DraggableBundle
                key={b.id}
                bundle={b}
                number={globalIdxOf(b.id)}
                dark={dark}
                isActive={activeId === `bundle-${b.id}`}
                slotSize={slot.length}
                slotPos={bi + 1}
              />
            ))}
          </SortableContext>
          {canAcceptPair && (
            <div
              className={`flex items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                isPairOver
                  ? (dark ? 'border-emerald-400 bg-emerald-500/15' : 'border-emerald-500 bg-emerald-200/40')
                  : (dark ? 'border-white/10' : 'border-stone-300/50')
              }`}
              style={{
                width: 220,
                height: getBundleModel(slot[0]).heightPx * MINIATURE_SCALE,
                minHeight: 100,
                pointerEvents: 'none',
              }}
            >
              <span className={`text-[11px] font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                {isPairOver ? '+ Пара' : 'Кинь сюди для пари'}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Size labels — один під кожним пакетом у тій самій flex-позиції */}
      <div
        className="flex items-start justify-center mt-2"
        style={{ gap: pairGapScaled, width: canvasW }}
      >
        {slot.map((b) => {
          const m = getBundleModel(b);
          return (
            <div
              key={b.id}
              className={`text-[15px] tabular-nums font-semibold tracking-wide text-center ${
                dark ? 'text-slate-300' : 'text-stone-700'
              }`}
              style={{ width: Math.round(m.widthPx * MINIATURE_SCALE) }}
            >
              {m.widthPx} × {m.heightPx}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Зона "Винести в новий ряд". Рендериться між кожною парою ряду і зверху списку.
 *  `visible` керує видимістю (показуємо тільки при drag бандла щоб не забивати UI).
 *  Droppable ЗАВЖДИ зареєстрований у dnd-kit — навіть коли visually hidden,
 *  щоб collision detection працював миттєво після старту drag. */
function EmptySlotDropZone({
  insertAt,
  dark,
  highlighted,
  visible,
}: {
  insertAt: number;
  dark: boolean;
  highlighted: boolean;
  visible: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `empty-slot-${insertAt}`,
    data: { kind: 'empty-slot', insertAt },
  });
  const canvasW = Math.round(SITE_CANVAS_NATIVE_W * MINIATURE_SCALE);
  // Завжди тримаємо фіксовану висоту щоб НЕ стрибав layout при старті драгу.
  // `visible=false` → просто невидимий (opacity 0), droppable все одно зареєстрований.
  const state: 'dragActive' | 'hover' = isOver ? 'hover' : 'dragActive';
  const borderCls = {
    dragActive: dark ? 'border-amber-400/50 bg-amber-500/[0.05]' : 'border-amber-500/60 bg-amber-200/25',
    hover:      dark ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/40' : 'border-amber-500 bg-amber-200/50 ring-2 ring-amber-500/40',
  }[state];
  const textCls = {
    dragActive: dark ? 'text-amber-300/90' : 'text-amber-800/90',
    hover:      dark ? 'text-amber-200' : 'text-amber-900',
  }[state];
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center rounded-lg border-2 border-dashed transition-all ${visible ? borderCls : 'border-transparent'}`}
      style={{
        width: canvasW,
        height: 48,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? undefined : 'none',
      }}
      aria-hidden={!visible}
    >
      {visible && (
        <span className={`text-[13px] uppercase tracking-[0.18em] font-semibold ${textCls}`}>
          {state === 'hover' ? '+ Новий ряд тут' : '➕ Винести в новий ряд'}
        </span>
      )}
    </div>
  );
}

/** Бандл як draggable — можна тягнути сам пакет щоб переставити в інший слот. */
function DraggableBundle({
  bundle,
  number,
  dark,
  isActive,
  slotSize,
  slotPos,
}: {
  bundle: BundleRowData;
  number: number;
  dark: boolean;
  isActive: boolean;
  slotSize: number;
  slotPos: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver, isSorting } = useSortable({
    id: `bundle-${bundle.id}`,
    data: { kind: 'bundle', bundleId: bundle.id },
  });
  const SHIFT_TRANSITION = 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)';
  const isSource = isDragging || isActive;
  const model = getBundleModel(bundle);
  const scaledW = Math.round(model.widthPx * MINIATURE_SCALE);
  const scaledH = Math.round(model.heightPx * MINIATURE_SCALE);
  const frameStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 14,
    border: dark ? '2px dashed rgba(212,168,67,0.45)' : '2px dashed rgba(164,122,40,0.5)',
    background: dark ? 'rgba(212,168,67,0.04)' : 'rgba(212,168,67,0.06)',
    pointerEvents: 'none',
    // Рамка-«слот» показується, коли в контексті триває dnd (для всіх бандлів).
    // Коли картка зміщується через transform — під нею відкривається ця рамка,
    // тобто місце, де пакет «був» до зсуву.
    opacity: isSorting ? 1 : 0,
    transition: 'opacity 200ms ease',
  };
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    transform: isSource ? undefined : CSS.Transform.toString(transform),
    transition: SHIFT_TRANSITION,
    cursor: 'grab',
    outline: isOver && !isDragging ? (dark ? '2px solid #34d399' : '2px solid #059669') : 'none',
    outlineOffset: isOver && !isDragging ? 2 : 0,
    borderRadius: 12,
    willChange: 'transform',
    visibility: isSource ? 'hidden' : 'visible',
  };
  return (
    <div style={{ position: 'relative', width: scaledW, height: scaledH }}>
      {/* Рамка-«слот» під карткою. Видно коли йде dnd. */}
      <div aria-hidden style={frameStyle} />
      {/* Сама картка — має transform для shift-анімації, listeners для drag. */}
      <div ref={setNodeRef} style={cardStyle} {...attributes} {...listeners}>
        <BundleMiniature bundle={bundle} number={number} dark={dark} slotSize={slotSize} slotPos={slotPos} />
      </div>
    </div>
  );
}

/** Scaled-рендер реального BundleCard з фіксованою висотою = model.heightPx (як на сайті). */
function BundleMiniature({
  bundle,
  number,
  dark,
  slotSize = 1,
  slotPos = 1,
}: {
  bundle: BundleRowData;
  number: number;
  dark: boolean;
  slotSize?: number;
  slotPos?: number;
}) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/bundles/${bundle.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося видалити');
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Помилка видалення: ${err}`);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const model = getBundleModel(bundle);
  const scaledW = Math.round(model.widthPx * MINIATURE_SCALE);
  const scaledH = Math.round(model.heightPx * MINIATURE_SCALE);
  const paid = bundle.miniaturePaid ?? [];
  const free = bundle.miniatureFree ?? [];
  const isPair = slotSize === 2;

  return (
    <div className="relative group">
      {/* Number badge */}
      <div
        className={`absolute -top-2 -left-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold tabular-nums shadow-md ${
          dark ? 'bg-amber-400/90 text-stone-900' : 'bg-stone-900 text-amber-100'
        }`}
      >
        {number}
      </div>
      {/* Слот-ярлик (solo / pair with position). Top-right, elegant pill. */}
      <div
        className="absolute -top-2 -right-2 z-10 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] shadow-md select-none"
        style={{
          background: isPair
            ? (dark
                ? 'linear-gradient(135deg, rgba(16,78,56,0.95), rgba(5,150,105,0.95))'
                : 'linear-gradient(135deg, #047857, #10b981)')
            : (dark
                ? 'linear-gradient(135deg, rgba(120,84,24,0.95), rgba(212,168,67,0.95))'
                : 'linear-gradient(135deg, #A47A28, #D4A843)'),
          color: dark ? '#0c1a11' : '#fffbeb',
          border: isPair
            ? (dark ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(5,150,105,0.35)')
            : (dark ? '1px solid rgba(242,199,109,0.45)' : '1px solid rgba(164,122,40,0.45)'),
        }}
        title={isPair ? `Пара · позиція ${slotPos} з ${slotSize}` : 'Соло у ряду'}
      >
        {/* Dots indicator — filled = current position */}
        <span className="inline-flex items-center gap-[3px]" aria-hidden>
          {Array.from({ length: slotSize }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i + 1 === slotPos ? 'currentColor' : 'transparent',
                border: i + 1 === slotPos ? 'none' : '1.2px solid currentColor',
                opacity: i + 1 === slotPos ? 1 : 0.55,
              }}
            />
          ))}
        </span>
        <span>{isPair ? 'Пара' : 'Соло'}</span>
      </div>
      {/* Hover overlay з actions (Редагувати + Видалити, стек вертикально).
          Напівпрозорі floating-кнопки з backdrop-blur — фросед-glass ефект. */}
      <div
        className={`absolute inset-0 z-20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto flex flex-col items-end p-2 gap-1.5`}
      >
        <Link
          href={`/dashboard/admin/bundles/${bundle.id}`}
          title="Редагувати"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-amber-400/25 hover:bg-amber-400/50 ring-1 ring-white/30 shadow-md backdrop-blur-sm transition-all drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
        >
          <HiPencil className="text-[14px]" />
        </Link>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteModal(true); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Видалити пакет"
          aria-label="Видалити пакет"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-rose-500/25 hover:bg-rose-500/50 ring-1 ring-white/30 shadow-md backdrop-blur-sm transition-all drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
        >
          <HiTrash className="text-[14px]" />
        </button>
      </div>
      {/* Scaled BundleCard wrapper — amber-рамка + drop shadow. Висота = model.heightPx * scale. */}
      <div
        style={{
          width: scaledW,
          height: scaledH,
          overflow: 'hidden',
          borderRadius: Math.round(24 * MINIATURE_SCALE),
          boxShadow: dark
            ? '0 0 0 1.5px rgba(212,168,67,0.55), 0 6px 18px rgba(0,0,0,0.35)'
            : '0 0 0 1.5px rgba(164,122,40,0.6), 0 6px 16px rgba(28,58,46,0.14)',
        }}
      >
        {/* Overflow compensation (ТІЛЬКИ в білдер-мініатюрі, не на сайті):
         * для «щільних» конфігів (5+ курсів сумарно) autoTuner + scale(0.5) квірк
         * переповнює висоту. Рішення БЕЗ зміни frozen розмірів: рендеримо BundleCard
         * у збільшеному native-просторі (+8%) і компенсуємо scale-ом, щоб візуально
         * мініатюра мала точно ті самі розміри. Результат: курси+CTA візуально на 8%
         * менші всередині — усе рівномірно, без зрізань. */}
        {(() => {
          const needsInflate = paid.length + free.length >= 5;
          const inflate = needsInflate ? 1.08 : 1;
          const nativeW = Math.round(model.widthPx * inflate);
          const nativeH = Math.round(model.heightPx * inflate);
          const innerScale = MINIATURE_SCALE / inflate;
          return (
            <div
              style={{
                width: nativeW,
                height: nativeH,
                transform: `scale(${innerScale})`,
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
                forcedHeight={nativeH}
              />
            </div>
          );
        })()}
      </div>

      {showDeleteModal && typeof document !== "undefined" && createPortal(
        <div
          className={`fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm ${
            dark ? 'bg-black/60' : 'bg-stone-900/30'
          }`}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
              dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
              Видалити пакет?
            </h3>
            <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              Пакет{' '}
              <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                «{bundle.title}»
              </span>{' '}
              буде видалено назавжди. Цю дію не можна відмінити.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
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
                onClick={handleDelete}
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
        </div>,
        document.body,
      )}
    </div>
  );
}
