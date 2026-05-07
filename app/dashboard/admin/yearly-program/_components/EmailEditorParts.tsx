'use client';

import {
  HiOutlineArrowUturnLeft,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
} from 'react-icons/hi2';

// ─────────────────────── SKELETON PRIMITIVES ───────────────────────
// Спільний скелетон-стиль для всіх loading-станів адмінки Річної програми.
// Використовується у трьох контекстах: списки шаблонів, списки одержувачів, деталі підписки.

/// Базовий блок з animate-pulse + delay-ланцюжком — щоб скелетони з'являлися хвилею, а не разом.
export function SkeletonBox({
  dark,
  width,
  height,
  delay = 0,
  className = '',
  rounded = 'rounded',
}: {
  dark: boolean;
  width: string;
  height: string;
  delay?: number;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`${rounded} animate-pulse ${dark ? 'bg-white/[0.06]' : 'bg-stone-200/80'} ${className}`}
      style={{ width, height, animationDelay: `${delay}ms` }}
    />
  );
}

/// Обгортка-картка зі стандартним border/bg для скелетон-вмісту.
export function SkeletonCard({ dark, children, className = '' }: { dark: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white shadow-sm'} ${className}`}>
      {children}
    </div>
  );
}

/// Рядок-плейсхолдер для list-items: коло-аватар зліва + 2 рядки тексту + бейдж справа.
/// Використовується у list-loaders (Listи Платежів/Нагадування, Дослати лист, деталі підписки).
export function SkeletonAvatarRow({ dark, delay = 0 }: { dark: boolean; delay?: number }) {
  return (
    <div className="px-3.5 py-2.5 flex items-center gap-3">
      <SkeletonBox dark={dark} width="32px" height="32px" delay={delay} rounded="rounded-full" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <SkeletonBox dark={dark} width="40%" height="11px" delay={delay + 60} />
        <SkeletonBox dark={dark} width="65%" height="9px" delay={delay + 120} />
      </div>
      <SkeletonBox dark={dark} width="58px" height="14px" delay={delay + 180} rounded="rounded-md" />
      <SkeletonBox dark={dark} width="78px" height="20px" delay={delay + 240} rounded="rounded-md" />
    </div>
  );
}

/// Footer-tick з пульсуючою точкою — фіниш-індикатор у скелетон-блоках.
export function SkeletonFooterTick({ dark, label }: { dark: boolean; label: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-2 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {label}
    </div>
  );
}

/// Пронумерована (або без номера) секція-картка з заголовком, опційною іконкою, hint-ом
/// у правій частині шапки і слотом `headerRight` для actions (наприклад кнопки «Тестовий лист»).
/// Спільна для всіх трьох контекстів редагування листів: Listі Платежів, Listі Нагадування,
/// Welcome-лист у LaunchProgramModal.
export function SectionCard({
  dark,
  num,
  title,
  hint,
  icon,
  headerRight,
  children,
}: {
  dark: boolean;
  num?: number;
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white shadow-sm'}`}>
      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${
        dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200/70 bg-stone-50/60'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {num !== undefined && (
            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
              dark ? 'bg-amber-400/15 border-amber-400/30 text-amber-200' : 'bg-amber-100 border-amber-300/60 text-amber-900'
            }`}>
              {num}
            </div>
          )}
          <h4 className={`text-[13.5px] font-bold flex items-center gap-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            {icon && <span className={`text-[15px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{icon}</span>}
            {title}
          </h4>
        </div>
        {headerRight ? (
          <div className="shrink-0">{headerRight}</div>
        ) : (
          hint && (
            <p className={`text-[10.5px] hidden sm:block text-right max-w-[55%] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              {hint}
            </p>
          )
        )}
      </div>
      <div className="px-4 py-3.5">
        {children}
      </div>
    </section>
  );
}

/// Сканує HTML і повертає множину знайдених у тексті плейсхолдерів `{xxx}` чи `{{xxx}}`.
export function extractUsedPlaceholders(html: string): Set<string> {
  const re = /\{\{?([a-zA-Z][a-zA-Z0-9_-]*)\}\}?/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) set.add(m[1]);
  return set;
}

/// Рамка-«вікно поштового клієнта» з шапкою (subject + sender) — щоб iframe виглядав
/// як справжній лист у Inbox-і. Chrome — 2 смужки (browser-bar з темою + sender-bar з
/// адресою відправника), парні до 2-ох смужок toolbar-а у WysiwygEmailEditor (форматування
/// + плейсхолдери). Це гарантує що body листа в прев'ю стартує на тій самій висоті, що
/// і body редактора — менеджер бачить дзеркальний layout.
export function EmailPreviewFrame({
  dark, subject, loading, loadingHeight, fromAddress = 'UIMP <edu@uimp.com.ua>', children,
}: {
  dark: boolean;
  subject: string;
  loading?: boolean;
  loadingHeight?: number;
  /// Адреса відправника, показується у 2-ій смужці chrome. За замовчуванням — uimp@.
  fromAddress?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border overflow-hidden shadow-sm ${dark ? 'border-white/10 bg-zinc-950' : 'border-stone-300 bg-white'}`}>
      {/* Chrome row 1 — browser-style title bar з темою */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${
        dark ? 'border-white/[0.06] bg-zinc-900' : 'border-stone-200 bg-stone-100'
      }`}>
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className={`flex-1 min-w-0 ml-2 text-[11px] font-medium truncate ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
          <span className={`text-[10px] uppercase tracking-wider mr-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Тема:</span>
          {subject || <em className="opacity-50">— тема порожня —</em>}
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded transition-colors ${
          loading
            ? dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800'
            : dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
        }`}>
          {loading
            ? <><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Рендерю</>
            : <><span className="w-1.5 h-1.5 rounded-full bg-current" /> Live</>
          }
        </span>
      </div>
      {/* Chrome row 2 — sender-bar (мiрор для placeholders-смужки editor-а) */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 border-b text-[10.5px] ${
        dark ? 'border-white/[0.06] bg-white/[0.015] text-slate-400' : 'border-stone-200/70 bg-stone-50/40 text-stone-600'
      }`}>
        <span className={`shrink-0 inline-flex items-center text-[10px] uppercase tracking-wider font-semibold mr-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          Від:
        </span>
        <span className="truncate font-medium">{fromAddress}</span>
      </div>
      <div className="relative bg-white">
        {children}
        {loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white"
            style={{ minHeight: loadingHeight ? `${loadingHeight}px` : undefined }}
          >
            <div className="w-full max-w-[500px] px-8 py-6 space-y-3">
              <div className="h-5 w-2/3 rounded bg-stone-200/80 animate-pulse" />
              <div className="h-3 w-full rounded bg-stone-200/60 animate-pulse" style={{ animationDelay: '60ms' }} />
              <div className="h-3 w-11/12 rounded bg-stone-200/60 animate-pulse" style={{ animationDelay: '120ms' }} />
              <div className="h-3 w-9/12 rounded bg-stone-200/60 animate-pulse" style={{ animationDelay: '180ms' }} />
              <div className="pt-3 space-y-2">
                <div className="h-3 w-3/12 rounded bg-stone-200/80 animate-pulse" style={{ animationDelay: '240ms' }} />
                <div className="h-3 w-10/12 rounded bg-stone-200/50 animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="h-3 w-8/12 rounded bg-stone-200/50 animate-pulse" style={{ animationDelay: '360ms' }} />
              </div>
            </div>
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 text-[11px] font-medium text-stone-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Готую прев'ю…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/// Warning-банер при видаленні плейсхолдера у редакторі. Зʼявляється одразу як менеджер
/// прибирає `{xxx}`-поле з тексту. Показує що це поле робило і дає швидкі кнопки:
/// «Повернути» (вставити назад у кінець) і «Залишити так» (підтвердити свідоме видалення).
export function RemovedPlaceholderAlert({
  dark, placeholder, descriptions, format, onRestore, onDismiss,
}: {
  dark: boolean;
  placeholder: string;
  descriptions: Record<string, { what: string; consequence: string }>;
  format?: 'single' | 'double';
  onRestore: () => void;
  onDismiss: () => void;
}) {
  const desc = descriptions[placeholder];
  const label = format === 'double' ? `{{${placeholder}}}` : `{${placeholder}}`;
  return (
    <div
      role="alert"
      className={`mb-3 rounded-xl border-2 px-4 py-3 flex items-start gap-3 shadow-md ${
        dark
          ? 'bg-amber-500/[0.10] border-amber-400/50 text-amber-100'
          : 'bg-amber-50 border-amber-400 text-amber-950'
      }`}
    >
      <HiOutlineExclamationTriangle className="text-[20px] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold mb-1">
          Ви прибрали поле{' '}
          <code className={`font-mono px-1.5 py-0.5 rounded text-[12px] ${
            dark ? 'bg-amber-500/20' : 'bg-amber-200/60'
          }`}>
            {label}
          </code>
        </div>
        {desc ? (
          <>
            <p className={`text-[12px] leading-snug mb-1 ${dark ? 'text-amber-100/90' : 'text-amber-900'}`}>
              <strong>Що робило:</strong> {desc.what}
            </p>
            <p className={`text-[12px] leading-snug ${dark ? 'text-amber-100/90' : 'text-amber-900'}`}>
              <strong>Наслідок:</strong> {desc.consequence}
            </p>
          </>
        ) : (
          <p className={`text-[12px] leading-snug ${dark ? 'text-amber-100/90' : 'text-amber-900'}`}>
            Це поле автоматично підставляло персональне значення для кожного отримувача.
          </p>
        )}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onRestore}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${
              dark
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-100 hover:bg-amber-400/30'
                : 'bg-amber-200 border-amber-500 text-amber-950 hover:bg-amber-300'
            }`}
          >
            <HiOutlineArrowUturnLeft className="text-[13px]" /> Повернути поле
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
              dark
                ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]'
                : 'border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            Залишити так
          </button>
        </div>
      </div>
    </div>
  );
}

/// Довідник: показує менеджеру кожне поле + опис + приклад значення.
export function PlaceholderLegend({
  dark, placeholders, sampleData, descriptions, format = 'single',
}: {
  dark: boolean;
  placeholders: string[];
  sampleData: Record<string, string>;
  descriptions: Record<string, { what: string; consequence: string }>;
  format?: 'single' | 'double';
}) {
  const humanize = (raw: string): string => {
    if (!raw) return '— порожнє (поле опційне)';
    if (!/<[^>]+>/.test(raw)) return raw;
    if (typeof window !== 'undefined') {
      const el = document.createElement('div');
      el.innerHTML = raw;
      const text = (el.textContent || '').trim();
      return text || '— HTML-блок —';
    }
    return raw.replace(/<[^>]+>/g, '').trim() || '— HTML-блок —';
  };
  const labelFor = (p: string) => format === 'double' ? `{{${p}}}` : `{${p}}`;

  return (
    <div className={`rounded-lg border overflow-hidden ${
      dark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-amber-200/60 bg-amber-50/40'
    }`}>
      <div className={`px-3 py-1.5 border-b text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
        dark ? 'border-white/[0.06] text-amber-300/80' : 'border-amber-200/60 text-amber-800'
      }`}>
        <HiOutlineSparkles className="text-[12px]" />
        Поля у цьому листі — що замінить кожне з них
      </div>
      <div className="px-3 py-2.5">
        <table className="w-full text-[11.5px]">
          <tbody>
            {placeholders.map((p, i) => {
              const desc = descriptions[p];
              return (
                <tr key={p} className={i > 0 ? (dark ? 'border-t border-white/[0.04]' : 'border-t border-amber-200/30') : ''}>
                  <td className="py-2 pr-3 align-top w-[26%]">
                    <span
                      className="inline-block font-mono font-semibold text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                      style={{
                        background: dark ? 'rgba(212,168,67,0.20)' : 'rgba(212,168,67,0.18)',
                        color: dark ? '#fde68a' : '#92400e',
                        borderColor: dark ? 'rgba(212,168,67,0.50)' : 'rgba(212,168,67,0.40)',
                      }}
                    >
                      {labelFor(p)}
                    </span>
                  </td>
                  <td className={`py-2 align-top text-[11.5px] ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                    {desc && (
                      <p className={`leading-snug mb-1 ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                        {desc.what}
                      </p>
                    )}
                    <span className={`inline-flex items-baseline gap-1.5`}>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Приклад:</span>
                      <span className="italic">«{humanize(sampleData[p] ?? '')}»</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={`mt-2 pt-2 border-t text-[10.5px] ${
          dark ? 'border-white/[0.04] text-slate-500' : 'border-amber-200/30 text-stone-600'
        }`}>
          ℹ️ У редакторі поля підсвічені <span
            className="inline-block font-mono font-semibold text-[10.5px] px-1 py-0 rounded border align-baseline"
            style={{
              background: 'rgba(212,168,67,0.18)',
              color: dark ? '#fde68a' : '#92400e',
              borderColor: 'rgba(212,168,67,0.40)',
            }}
          >{format === 'double' ? '{{поле}}' : '{поле}'}</span>. Реальне значення підставиться при відправці.
        </div>
      </div>
    </div>
  );
}
