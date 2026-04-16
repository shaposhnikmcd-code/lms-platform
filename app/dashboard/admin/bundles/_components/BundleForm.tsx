"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { COURSES_CATALOG } from "@/lib/coursesCatalog";
import {
  HiOutlineInformationCircle,
  HiOutlineBookOpen,
  HiOutlineGift,
  HiOutlineEye,
  HiOutlineCheckCircle,
  HiOutlineSparkles,
  HiOutlineReceiptPercent,
} from "react-icons/hi2";

export type BundleType = "DISCOUNT" | "FIXED_FREE" | "CHOICE_FREE";

export interface AvailableCourse {
  slug: string;
  title: string;
  price: number;
}

export interface BundleCourseData {
  courseSlug: string;
  isFree: boolean;
}

export interface BundleFormInitial {
  title: string;
  slug: string;
  price: string;
  published: boolean;
  type: BundleType;
  paidCount: number;
  freeCount: number;
  courses: BundleCourseData[];
}

interface Props {
  mode: "create" | "edit";
  initial?: Partial<BundleFormInitial>;
  availableCourses: AvailableCourse[];
  coursesLoading: boolean;
  type: BundleType;
  onTypeChange: (t: BundleType) => void;
  onSubmit: (payload: {
    title: string;
    slug: string;
    price: number;
    published: boolean;
    type: BundleType;
    paidCount: number;
    freeCount: number;
    courses: BundleCourseData[];
  }) => Promise<void>;
  saving: boolean;
  extraActions?: React.ReactNode;
  submitLabel?: string;
  /** Ключ для автозбереження чернетки в localStorage. Якщо не заданий — автозбереження вимкнене. */
  draftKey?: string;
}

export const TYPE_LABELS: Record<BundleType, string> = {
  DISCOUNT: "Знижка на пакет",
  FIXED_FREE: "Безкоштовний Сталий",
  CHOICE_FREE: "Безкоштовний на Вибір",
};

export const TYPE_ICONS: Record<BundleType, string> = {
  DISCOUNT: "📉",
  FIXED_FREE: "🎁",
  CHOICE_FREE: "🎲",
};

export const TYPE_DESC: Record<BundleType, string> = {
  DISCOUNT: "Знижка на всі курси в пакеті",
  FIXED_FREE: "N платних + M фіксованих безкоштовних",
  CHOICE_FREE: "N платних + пул, клієнт обирає",
};

// Кольорова палітра для курсів (детерміновано за slug)
function courseHue(slug: string) {
  const palette = [
    { from: "from-violet-400", to: "to-violet-500", text: "text-violet-600", bg: "bg-violet-50", ring: "ring-violet-200" },
    { from: "from-sky-400", to: "to-sky-500", text: "text-sky-600", bg: "bg-sky-50", ring: "ring-sky-200" },
    { from: "from-amber-400", to: "to-amber-500", text: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
    { from: "from-emerald-400", to: "to-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
    { from: "from-rose-400", to: "to-rose-500", text: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-200" },
    { from: "from-indigo-400", to: "to-indigo-500", text: "text-indigo-600", bg: "bg-indigo-50", ring: "ring-indigo-200" },
    { from: "from-teal-400", to: "to-teal-500", text: "text-teal-600", bg: "bg-teal-50", ring: "ring-teal-200" },
  ];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "щойно";
  if (s < 60) return `${s} с тому`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  return `${Math.floor(h / 24)} дн тому`;
}

function joinTitles(titles: string[]) {
  const clean = titles.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} та ${clean[1]}`;
  return clean.slice(0, -1).join(", ") + " та " + clean[clean.length - 1];
}

function initials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function BundleForm({
  mode,
  initial,
  availableCourses,
  coursesLoading,
  type,
  onTypeChange,
  onSubmit,
  saving,
  extraActions,
  submitLabel,
  draftKey,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  // Якщо користувач сам задав назву — автозаповнення з платних курсів не перезаписує.
  // Очищення поля повертає авто-режим.
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(Boolean(initial?.title));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  // Кількість курсів, які клієнт обирає з пулу (тільки для CHOICE_FREE).
  const [choicePickN, setChoicePickN] = useState(
    initial?.freeCount && initial?.type === "CHOICE_FREE" ? initial.freeCount : 1,
  );
  const [selectedPaid, setSelectedPaid] = useState<string[]>(
    () => (initial?.courses ?? []).filter((c) => !c.isFree).map((c) => c.courseSlug),
  );
  const [selectedFree, setSelectedFree] = useState<string[]>(
    () => (initial?.courses ?? []).filter((c) => c.isFree).map((c) => c.courseSlug),
  );
  const [message, setMessage] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [toastSlot, setToastSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setToastSlot(document.getElementById("bundle-toast-slot"));
  }, []);
  const [coursesTab, setCoursesTab] = useState<"paid" | "free">("paid");
  const [discount, setDiscount] = useState(0);
  const [rounding, setRounding] = useState(false);
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const discountRef = useRef<HTMLDivElement>(null);
  const discountBtnRef = useRef<HTMLButtonElement>(null);
  const [discountAbove, setDiscountAbove] = useState(false);
  const prevTypeRef = useRef(type);
  const draftLoadedRef = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Авто-розширення textarea назви пакету (максимум 2 рядки).
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "21");
    const paddingY = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    const maxHeight = lineHeight * 2 + paddingY;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [title]);

  // Автоприховання тосту «відновлено чернетку» через 5 сек.
  useEffect(() => {
    if (!draftRestored) return;
    const t = setTimeout(() => setDraftRestored(false), 5000);
    return () => clearTimeout(t);
  }, [draftRestored]);

  // ─── Відновлення чернетки з localStorage (один раз на mount) ───
  useEffect(() => {
    if (!draftKey || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        title?: string; slug?: string; price?: string; published?: boolean;
        type?: BundleType; selectedPaid?: string[]; selectedFree?: string[];
        choicePickN?: number; discount?: number; rounding?: boolean;
        titleManuallyEdited?: boolean; savedAt?: number;
      };
      if (typeof d.title === "string") setTitle(d.title);
      if (typeof d.slug === "string") setSlug(d.slug);
      if (typeof d.price === "string") setPrice(d.price);
      if (typeof d.published === "boolean") setPublished(d.published);
      if (d.type && (d.type === "DISCOUNT" || d.type === "FIXED_FREE" || d.type === "CHOICE_FREE")) {
        onTypeChange(d.type);
      }
      if (Array.isArray(d.selectedPaid)) setSelectedPaid(d.selectedPaid);
      if (Array.isArray(d.selectedFree)) setSelectedFree(d.selectedFree);
      if (typeof d.choicePickN === "number") setChoicePickN(d.choicePickN);
      if (typeof d.discount === "number") setDiscount(d.discount);
      if (typeof d.rounding === "boolean") setRounding(d.rounding);
      if (typeof d.titleManuallyEdited === "boolean") setTitleManuallyEdited(d.titleManuallyEdited);
      setDraftRestored(true);
      if (typeof d.savedAt === "number") setDraftSavedAt(d.savedAt);
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // ─── Автозбереження чернетки (debounce 400мс) ───
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        const now = Date.now();
        window.localStorage.setItem(draftKey, JSON.stringify({
          title, slug, price, published, type,
          selectedPaid, selectedFree, choicePickN,
          discount, rounding, titleManuallyEdited,
          savedAt: now,
        }));
        setDraftSavedAt(now);
      } catch {
        // quota or disabled storage — ignore
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draftKey, title, slug, price, published, type,
      selectedPaid, selectedFree, choicePickN,
      discount, rounding, titleManuallyEdited]);

  const closeDiscountPicker = useCallback(() => setShowDiscountPicker(false), []);

  useEffect(() => {
    if (!showDiscountPicker) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDiscountPicker();
    };
    const handleClick = (e: MouseEvent) => {
      if (
        discountRef.current && !discountRef.current.contains(e.target as Node) &&
        discountBtnRef.current && !discountBtnRef.current.contains(e.target as Node)
      ) {
        closeDiscountPicker();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showDiscountPicker, closeDiscountPicker]);

  useEffect(() => {
    if (prevTypeRef.current === type) return;
    prevTypeRef.current = type;
    setDiscount(0);
    if (type === "DISCOUNT") {
      // DISCOUNT не має поділу на платні/безкоштовні — переносимо все в selectedPaid.
      setSelectedPaid((prev) => [
        ...prev,
        ...selectedFree.filter((s) => !prev.includes(s)),
      ]);
      setSelectedFree([]);
    }
    if (type === "CHOICE_FREE") {
      setChoicePickN((v) => (v < 1 ? 1 : v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const slugify = (val: string) =>
    val
      .toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ\s-]/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setTitleManuallyEdited(val.trim().length > 0);
    if (mode === "create") setSlug(slugify(val));
  };

  // Автозаповнення назви пакету: платні + безкоштовні, "Курс А, Курс Б та Курс В"
  // Зберігаємо попередній авто-заголовок, щоб продовжувати оновлення навіть коли
  // titleManuallyEdited=true (edit mode), якщо поточна назва збігається з авто.
  const seenAutoTitlesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const totalSelected = selectedPaid.length + selectedFree.length;
    const paidTitles = selectedPaid
      .map((s) => availableCourses.find((c) => c.slug === s)?.title)
      .filter((t): t is string => !!t);
    const freeTitles = selectedFree
      .map((s) => availableCourses.find((c) => c.slug === s)?.title)
      .filter((t): t is string => !!t);
    // Якщо курси ще не завантажились — не чіпаємо назву.
    if (totalSelected > 0 && paidTitles.length + freeTitles.length !== totalSelected) return;
    let next: string;
    if (type === "CHOICE_FREE" && freeTitles.length > 0) {
      if (choicePickN >= 2) {
        const paidJoined = paidTitles.join(", ");
        const freeJoined =
          freeTitles.length <= 1
            ? freeTitles.join("")
            : freeTitles.slice(0, -1).join(", ") + " чи " + freeTitles[freeTitles.length - 1];
        const phrase = `${choicePickN} Безкоштовних на вибір - ${freeJoined}`;
        next = paidTitles.length === 0 ? phrase : `${paidJoined} та ${phrase}`;
      } else {
        const poolJoined = freeTitles.join(" або ");
        if (paidTitles.length === 0) {
          next = poolJoined;
        } else {
          const paidJoined = paidTitles.join(", ");
          next = `${paidJoined} та на вибір ${poolJoined}`;
        }
      }
    } else if (type === "FIXED_FREE" && freeTitles.length > 0) {
      const paidJoined = paidTitles.join(", ");
      const freeJoined = joinTitles(freeTitles);
      next = paidTitles.length === 0
        ? `у Подарунок - ${freeJoined}`
        : `${paidJoined} та у Подарунок - ${freeJoined}`;
    } else {
      next = joinTitles([...paidTitles, ...freeTitles]);
    }
    // Усі можливі авто-формати для поточного набору (для зворотної сумісності).
    const flatJoined = joinTitles([...paidTitles, ...freeTitles]);
    seenAutoTitlesRef.current.add(next);
    seenAutoTitlesRef.current.add(flatJoined);
    // Також вважаємо «авто», якщо назва складається лише з назв доступних курсів,
    // розділених стандартними конекторами — так ловимо старі авто-формати (3+1, 2+2, тощо).
    const courseTitleSet = new Set(availableCourses.map((c) => c.title));
    const titleForTokens = title
      .replace(/^у\s+Подарунок\s+-\s+/i, "")
      .replace(/\s+у\s+Подарунок\s*$/i, "");
    const tokens = titleForTokens
      .split(/(?:,\s*|\s+та\s+у\s+Подарунок\s+-\s+|\s+та\s+\d+\s+Безкоштовних\s+на\s+вибір\s+-\s+|\s+та\s+на\s+вибір\s+|\s+та\s+|\s+або\s+|\s+чи\s+|\s+-\s+)/)
      .map((t) => t.trim())
      .filter(Boolean);
    const looksAuto = tokens.length > 0 && tokens.every((t) => courseTitleSet.has(t));
    const matchesAuto = seenAutoTitlesRef.current.has(title) || looksAuto;
    if (!titleManuallyEdited || matchesAuto) {
      if (title !== next) setTitle(next);
      if (titleManuallyEdited) setTitleManuallyEdited(false);
      if (mode === "create") setSlug(slugify(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPaid, selectedFree, availableCourses, type, choicePickN]);

  const togglePaid = (courseSlug: string) => {
    if (selectedFree.includes(courseSlug)) return;
    setSelectedPaid((prev) =>
      prev.includes(courseSlug) ? prev.filter((s) => s !== courseSlug) : [...prev, courseSlug],
    );
  };

  const toggleFree = (courseSlug: string) => {
    if (selectedPaid.includes(courseSlug)) return;
    setSelectedFree((prev) =>
      prev.includes(courseSlug) ? prev.filter((s) => s !== courseSlug) : [...prev, courseSlug],
    );
  };

  const totalPaidPrice = selectedPaid.reduce((sum, slug) => {
    const c = availableCourses.find((a) => a.slug === slug);
    return sum + (c?.price ?? 0);
  }, 0);
  const totalFreeValue = (() => {
    const prices = selectedFree
      .map((slug) => availableCourses.find((a) => a.slug === slug)?.price ?? 0)
      .sort((a, b) => b - a);
    // Для CHOICE_FREE клієнт отримає лише N курсів із пулу — рахуємо топ-N найдорожчих.
    const take = type === "CHOICE_FREE" ? Math.min(choicePickN, prices.length) : prices.length;
    return prices.slice(0, take).reduce((sum, p) => sum + p, 0);
  })();

  const submit = async () => {
    if (!title.trim()) return setMessage("Вкажи назву пакету");
    if (!slug.trim()) return setMessage("Вкажи slug");

    if (type === "DISCOUNT") {
      if (selectedPaid.length < 2) return setMessage("DISCOUNT: обери мінімум 2 платні курси");
      const priceNum = parseInt(price);
      if (!priceNum || priceNum <= 0) return setMessage("Вкажи ціну пакету");
    } else if (type === "FIXED_FREE") {
      if (selectedPaid.length < 1) return setMessage("Обери хоча б 1 платний курс");
      if (selectedFree.length < 1) return setMessage("Обери хоча б 1 безкоштовний курс");
    } else if (type === "CHOICE_FREE") {
      if (selectedPaid.length < 1) return setMessage("Обери хоча б 1 платний курс");
      if (choicePickN < 1) return setMessage("Вкажи, скільки курсів клієнт обирає");
      if (selectedFree.length < choicePickN) {
        return setMessage(`Пул має містити мінімум ${choicePickN} безкоштовних`);
      }
    }

    setMessage("");

    const courses: BundleCourseData[] = [
      ...selectedPaid.map((courseSlug) => ({ courseSlug, isFree: false })),
      ...selectedFree.map((courseSlug) => ({ courseSlug, isFree: true })),
    ];
    const priceToSend = type === "DISCOUNT" ? parseInt(price) : totalPaidPrice;

    try {
      await onSubmit({
        title: title.trim(),
        slug: slug.trim(),
        price: priceToSend,
        published,
        type,
        paidCount: selectedPaid.length,
        freeCount: type === "CHOICE_FREE" ? choicePickN : selectedFree.length,
        courses,
      });
      // Успіх → чернетку видаляємо, щоб не відновлювалась при наступному заході.
      if (draftKey && typeof window !== "undefined") {
        try { window.localStorage.removeItem(draftKey); } catch {}
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Помилка збереження");
    }
  };

  const clearDraft = () => {
    if (!draftKey || typeof window === "undefined") return;
    try { window.localStorage.removeItem(draftKey); } catch {}
    setDraftRestored(false);
    setDraftSavedAt(null);
  };

  // Порядок курсів — як у lib/coursesCatalog.ts (канонічний, однаковий для форми та модалки).
  const orderedCourses = useMemo(() => {
    const idx = new Map(COURSES_CATALOG.map((c, i) => [c.slug, i]));
    return [...availableCourses].sort(
      (a, b) => (idx.get(a.slug) ?? 9999) - (idx.get(b.slug) ?? 9999),
    );
  }, [availableCourses]);

  return (
    <div className="space-y-8">
      {message && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50/70 border border-rose-200/60 rounded-xl">
          <HiOutlineInformationCircle className="text-rose-500 text-lg flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-800">{message}</p>
        </div>
      )}

      {toastSlot && draftRestored && createPortal(
        <div
          role="status"
          aria-live="polite"
          className="w-[240px] mb-3 bg-white rounded-xl shadow-md ring-1 ring-amber-200/70 overflow-hidden animate-fadeIn"
        >
          <div className="flex items-center gap-2.5 pl-3 pr-1.5 py-2.5">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <HiOutlineSparkles className="text-sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-800 leading-tight">Чернетка відновлена</p>
              <p className="text-[10.5px] text-slate-500 truncate leading-tight mt-0.5">
                {draftSavedAt ? formatRelative(draftSavedAt) : "щойно"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { clearDraft(); setDraftRestored(false); }}
              className="flex-shrink-0 text-[10.5px] font-semibold text-slate-500 hover:text-rose-600 px-1.5 py-1 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Очистити
            </button>
          </div>
          <span aria-hidden className="block h-[2px] bg-amber-200/70 origin-left animate-[shrinkX_5s_linear]" />
        </div>,
        toastSlot,
      )}

      {/* ═══════ Basic info (без заголовка секції) ═══════ */}
      <div className="space-y-4">
        <div>
          <Label>Назва пакету <Req /></Label>
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="Психологія + Психіатрія"
            rows={1}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-colors resize-none leading-[1.5] overflow-hidden"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">URL автоматично згенерується з назви</p>
        </div>

        <div>
          <Label>Slug</Label>
          <div className="flex items-center gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-300 transition-colors">
            <span className="pl-4 pr-2 py-2.5 text-xs text-slate-400 font-mono whitespace-nowrap select-none">
              /bundle/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="psychology-psychiatry-bundle"
              className="flex-1 py-2.5 pr-4 text-sm bg-transparent focus:outline-none font-mono text-slate-700 placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>

      {/* ═══════ Section: Courses (tabs paid/free) ═══════ */}
      <section>
        {/* Таби + пікер кількості в один рядок */}
        {type !== "DISCOUNT" && (
        <div className="flex flex-wrap items-stretch gap-3 mb-4">
          {/* Платні */}
          <button
            type="button"
            onClick={() => setCoursesTab("paid")}
            className={`group relative overflow-hidden text-left px-3 py-2.5 rounded-xl transition-all flex-1 min-w-[150px] ${
              coursesTab === "paid"
                ? "bg-gradient-to-br from-violet-600 via-violet-600 to-violet-700 text-white shadow-md shadow-violet-500/30 ring-1 ring-violet-700/50"
                : "bg-white ring-1 ring-slate-200 hover:ring-violet-300 hover:bg-violet-50/40"
            }`}
          >
            <div className="relative flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                coursesTab === "paid"
                  ? "bg-white/15 text-white"
                  : "bg-violet-100 text-violet-600"
              }`}>
                <HiOutlineBookOpen className="text-sm" />
              </span>
              <span className={`text-[12px] font-bold uppercase tracking-[0.12em] ${
                coursesTab === "paid" ? "text-white/95" : "text-violet-700"
              }`}>
                Платні курси
              </span>
            </div>
            {coursesTab === "paid" && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-violet-300 via-white/90 to-violet-300"
              />
            )}
          </button>

          {/* Безкоштовні */}
          <button
            type="button"
            onClick={() => setCoursesTab("free")}
            className={`group relative overflow-hidden text-left px-3 py-2.5 rounded-xl transition-all flex-1 min-w-[150px] ${
              coursesTab === "free"
                ? "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-700/50"
                : "bg-white ring-1 ring-slate-200 hover:ring-emerald-300 hover:bg-emerald-50/40"
            }`}
          >
            <div className="relative flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                coursesTab === "free"
                  ? "bg-white/15 text-white"
                  : "bg-emerald-100 text-emerald-600"
              }`}>
                <HiOutlineGift className="text-sm" />
              </span>
              <span className={`text-[12px] font-bold uppercase tracking-[0.12em] ${
                coursesTab === "free" ? "text-white/95" : "text-emerald-700"
              }`}>
                Безкоштовні курси
              </span>
            </div>
            {coursesTab === "free" && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-emerald-300 via-white/90 to-emerald-300"
              />
            )}
          </button>

          {/* Пікер кількості — тільки для CHOICE_FREE */}
          {type === "CHOICE_FREE" && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ring-1 ring-emerald-200 bg-emerald-50/60"
              title="Скільки курсів клієнт обере з пулу безкоштовних"
            >
              <button
                type="button"
                onClick={() => setChoicePickN((v) => Math.max(1, v - 1))}
                disabled={choicePickN <= 1}
                className="w-8 h-8 rounded-lg ring-1 ring-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-base"
                aria-label="Зменшити кількість"
              >−</button>
              <span className="min-w-[1.75rem] text-center text-base font-bold text-emerald-900 tabular-nums">{choicePickN}</span>
              <button
                type="button"
                onClick={() => setChoicePickN((v) => v + 1)}
                className="w-8 h-8 rounded-lg ring-1 ring-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors font-semibold text-base"
                aria-label="Збільшити кількість"
              >+</button>
            </div>
          )}
        </div>
        )}

        {type === "DISCOUNT" || coursesTab === "paid" ? (
          <div className={`rounded-xl ring-1 p-3 sm:p-4 ${
            type === "DISCOUNT"
              ? "ring-slate-200 bg-white"
              : "ring-violet-200/60 bg-violet-50/30"
          }`}>
            <div className="space-y-2">
              {coursesLoading ? (
                <p className="text-sm text-slate-400 italic px-2">Завантаження…</p>
              ) : orderedCourses.length === 0 ? (
                <p className="text-sm text-slate-400 italic px-2">Курси в БД відсутні.</p>
              ) : (
                orderedCourses.map((course) => {
                  const isSel = selectedPaid.includes(course.slug);
                  const isInFree = selectedFree.includes(course.slug);
                  const disabled = isInFree;
                  const order = isSel ? selectedPaid.indexOf(course.slug) + 1 : null;
                  return (
                    <CourseRow
                      key={`paid-${course.slug}`}
                      course={course}
                      selected={isSel}
                      disabled={disabled}
                      onToggle={() => togglePaid(course.slug)}
                      order={order}
                      pill={
                        isInFree ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-400 tabular-nums">
                              {course.price.toLocaleString()} ₴
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); setCoursesTab("free"); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCoursesTab("free");
                                }
                              }}
                              className="inline-block cursor-pointer text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                              title="Цей курс у вкладці «Безкоштовні». Натисніть, щоб перейти."
                            >
                              В безкоштовних →
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">
                            {course.price.toLocaleString()} ₴
                          </span>
                        )
                      }
                      accent="violet"
                    />
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl ring-1 ring-emerald-200/60 bg-emerald-50/30 p-3 sm:p-4">
            <p className="text-[11px] text-emerald-900/70 mb-3 px-1">
              {type === "CHOICE_FREE"
                ? `Сформуйте пул (мінімум ${choicePickN}) — клієнт обере з нього при покупці.`
                : "Ці курси клієнт отримає безкоштовно разом із пакетом."}
            </p>
            <div className="space-y-2">
              {orderedCourses.map((course) => {
                const isSel = selectedFree.includes(course.slug);
                const isInPaid = selectedPaid.includes(course.slug);
                const order = isSel ? selectedFree.indexOf(course.slug) + 1 : null;
                return (
                  <CourseRow
                    key={`free-${course.slug}`}
                    course={course}
                    selected={isSel}
                    disabled={isInPaid}
                    onToggle={() => toggleFree(course.slug)}
                    order={order}
                    pill={
                      isInPaid ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-400 tabular-nums">
                            {course.price.toLocaleString()} ₴
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setCoursesTab("paid"); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setCoursesTab("paid");
                              }
                            }}
                            className="inline-block cursor-pointer text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 ring-1 ring-violet-200 px-2 py-0.5 rounded-full hover:bg-violet-100 transition-colors"
                            title="Цей курс у вкладці «Платні». Натисніть, щоб перейти."
                          >
                            ← В платних
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-700 tabular-nums">
                          {course.price.toLocaleString()} ₴
                        </span>
                      )
                    }
                    accent="emerald"
                    strikeThrough
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ═══════ Pricing — premium-картка ═══════ */}
      <div className="-mt-6">
        {type === "DISCOUNT" ? (
          <div className="relative rounded-2xl ring-1 ring-slate-200/80 bg-gradient-to-br from-white via-slate-50/40 to-violet-50/30 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            {/* Decor clipper — не обрізає popup */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <span aria-hidden className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-violet-500/[0.04] blur-3xl" />
            </div>
            <span aria-hidden className="absolute top-4 bottom-4 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-violet-500 via-violet-600 to-violet-700" />

            <div className="relative p-5">
              {/* Контекст: Вартість курсів + Знижка */}
              {totalPaidPrice > 0 && (
                <div className="space-y-2 pb-4 border-b border-dashed border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-500">Вартість курсів</span>
                    <span className={`text-[13px] font-semibold tabular-nums ${
                      price && parseInt(price) > 0 && parseInt(price) < totalPaidPrice
                        ? "text-slate-400 line-through"
                        : "text-slate-700"
                    }`}>
                      {totalPaidPrice.toLocaleString()} ₴
                    </span>
                  </div>
                  {price && parseInt(price) > 0 && parseInt(price) < totalPaidPrice && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 text-emerald-600">
                          <HiOutlineSparkles className="text-[10px]" />
                        </span>
                        <span className="text-[12px] font-semibold text-emerald-700">Знижка</span>
                        <span className="text-[10px] font-bold tabular-nums text-emerald-700 bg-emerald-100/80 ring-1 ring-emerald-200/80 px-1.5 py-[2px] rounded-full">
                          −{Math.round((1 - parseInt(price) / totalPaidPrice) * 100)}%
                        </span>
                      </div>
                      <span className="text-[13px] font-bold text-emerald-700 tabular-nums">
                        −{(totalPaidPrice - parseInt(price)).toLocaleString()} ₴
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* HERO — інпут ціни з лейблом та контролами */}
              <div className={`flex items-center justify-between gap-3 flex-wrap ${totalPaidPrice > 0 ? "pt-4" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-sm shadow-violet-500/25 flex-shrink-0">
                    <HiOutlineReceiptPercent className="text-base" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700/80">
                    Ціна пакету
                    <span className="text-rose-500 ml-1">*</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                {/* 1. Інпут ціни — великий, виразний */}
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setDiscount(0); }}
                    placeholder="5500"
                    className="w-32 h-10 border border-slate-200 rounded-lg pl-3 pr-9 text-[17px] font-black tabular-nums tracking-tight bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 hover:border-slate-300 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-violet-500 pointer-events-none">₴</span>
                </div>
                {/* 2. Кнопка знижки */}
                <div className="relative">
                  <button
                    ref={discountBtnRef}
                    type="button"
                    onClick={() => {
                      if (!showDiscountPicker && discountBtnRef.current) {
                        const rect = discountBtnRef.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        setDiscountAbove(spaceBelow < 320);
                      }
                      setShowDiscountPicker(!showDiscountPicker);
                    }}
                    className={`h-9 inline-flex items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
                      discount > 0
                        ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-500/20"
                        : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <HiOutlineReceiptPercent className={`text-[14px] ${discount > 0 ? "text-white/90" : "text-slate-400"}`} />
                    <span className="tabular-nums">{discount > 0 ? `−${discount}%` : "Знижка"}</span>
                  </button>
                  {showDiscountPicker && (
                    <div
                      ref={discountRef}
                      className={`absolute right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex overflow-hidden ${
                        discountAbove ? "bottom-full mb-1" : "top-full mt-1"
                      }`}
                      style={{ width: 140 }}
                    >
                      <div className="flex-1 py-1">
                        {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setDiscount(pct);
                              let calculated = Math.round(totalPaidPrice * (1 - pct / 100));
                              if (rounding) calculated = Math.round(calculated / 100) * 100;
                              setPrice(String(calculated));
                              setShowDiscountPicker(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm font-medium tabular-nums hover:bg-violet-50 transition-colors ${
                              discount === pct ? "bg-violet-50 text-violet-700" : "text-slate-700"
                            }`}
                          >
                            −{pct}%
                          </button>
                        ))}
                      </div>
                      <div className="w-10 border-l border-slate-100 flex flex-col items-center justify-center py-3">
                        <input
                          type="range"
                          min={1}
                          max={60}
                          value={discount || 0}
                          onChange={(e) => {
                            const pct = parseInt(e.target.value);
                            setDiscount(pct);
                            if (totalPaidPrice > 0) {
                              let calculated = Math.round(totalPaidPrice * (1 - pct / 100));
                              if (rounding) calculated = Math.round(calculated / 100) * 100;
                              setPrice(String(calculated));
                            }
                          }}
                          className="h-[200px] accent-violet-600 cursor-pointer"
                          style={{ writingMode: "vertical-lr", direction: "rtl" }}
                        />
                        <span className="text-[10px] text-slate-500 mt-1 tabular-nums">{discount || 0}%</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* 3. Округлення */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={rounding}
                  onClick={() => {
                    const next = !rounding;
                    setRounding(next);
                    if (next && price) {
                      setPrice(String(Math.round(parseInt(price) / 100) * 100));
                    }
                  }}
                  className={`h-9 inline-flex items-center gap-2 px-3 rounded-lg text-[13px] font-semibold border transition-colors select-none ${
                    rounding
                      ? "bg-violet-50/70 border-violet-200 text-violet-800"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>Округлити</span>
                  <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
                    rounding ? "bg-violet-600" : "bg-slate-300"
                  }`}>
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                        rounding ? "translate-x-[12px] ml-0.5" : "translate-x-0 ml-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl ring-1 ring-slate-200/80 bg-gradient-to-br from-white via-slate-50/40 to-violet-50/30 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <span aria-hidden className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-violet-500/[0.04] blur-3xl" />
            </div>
            <span aria-hidden className="absolute top-4 bottom-4 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-violet-500 via-violet-600 to-violet-700" />

            <div className="relative p-5">
              {/* Subtotal + знижка — компактний контекст */}
              <div className="space-y-2 pb-4 border-b border-dashed border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-slate-500">Вартість курсів</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${
                    totalFreeValue > 0 ? "text-slate-400 line-through" : "text-slate-700"
                  }`}>
                    {(totalPaidPrice + totalFreeValue).toLocaleString()} ₴
                  </span>
                </div>
                {totalFreeValue > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 text-emerald-600">
                        <HiOutlineSparkles className="text-[10px]" />
                      </span>
                      <span className="text-[12px] font-semibold text-emerald-700">Знижка</span>
                      <span className="text-[10px] font-bold tabular-nums text-emerald-700 bg-emerald-100/80 ring-1 ring-emerald-200/80 px-1.5 py-[2px] rounded-full">
                        −{Math.round((totalFreeValue / (totalPaidPrice + totalFreeValue)) * 100)}%
                      </span>
                    </div>
                    <span className="text-[13px] font-bold text-emerald-700 tabular-nums">
                      −{totalFreeValue.toLocaleString()} ₴
                    </span>
                  </div>
                )}
              </div>

              {/* HERO — Вартість пакету */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-sm shadow-violet-500/25">
                    <HiOutlineReceiptPercent className="text-base" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700/80">
                    Вартість пакету
                  </span>
                </div>
                <div className="flex items-baseline gap-1 tabular-nums">
                  <span className="text-[30px] font-black text-slate-900 leading-none tracking-tight">
                    {totalPaidPrice.toLocaleString()}
                  </span>
                  <span className="text-base font-bold text-violet-500">₴</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ Publish — inline в одну строчку ═══════ */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/60 border border-slate-200/80 rounded-xl">
        <div className="flex items-center gap-2 min-w-0">
          <HiOutlineEye className="text-slate-500 text-base flex-shrink-0" />
          <p className="text-sm font-medium text-slate-800 truncate">Показувати на сайті</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={published}
          onClick={() => setPublished(!published)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
            published ? "bg-violet-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
              published ? "translate-x-5 ml-0.5" : "translate-x-0 ml-0.5"
            }`}
          />
        </button>
      </div>

      {extraActions}

      {/* Submit */}
      <div className="space-y-2">
        <button
          onClick={submit}
          disabled={saving}
          className="group relative w-full bg-gradient-to-br from-violet-600 to-violet-700 text-white font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none overflow-hidden"
        >
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <span className="relative inline-flex items-center justify-center gap-2">
            {saving ? (
              <>Збереження…</>
            ) : (
              <>
                <HiOutlineCheckCircle className="text-lg" />
                {submitLabel ?? (mode === "create" ? "Створити пакет" : "Зберегти зміни")}
              </>
            )}
          </span>
        </button>
        {draftKey && draftSavedAt && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Чернетка збережена локально {formatRelative(draftSavedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{children}</label>;
}

function Req() {
  return <span className="text-rose-500 font-bold ml-1">*</span>;
}

function Section({
  icon,
  title,
  subtitle,
  hint,
  required,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        {icon && (
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200 flex items-center justify-center text-slate-600 text-sm flex-shrink-0">
            {icon}
          </span>
        )}
        <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">
          {title}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </h3>
        {subtitle && (
          <span className="text-[11px] text-slate-400 font-medium ml-auto">
            {subtitle}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-500 mb-3 pl-9">{hint}</p>}
      <div className={icon ? "pl-0" : ""}>{children}</div>
    </section>
  );
}


function CourseRow({
  course,
  selected,
  disabled,
  onToggle,
  pill,
  accent,
  strikeThrough,
  order,
}: {
  course: AvailableCourse;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  pill: React.ReactNode;
  accent: "violet" | "emerald";
  strikeThrough?: boolean;
  /** Порядковий номер (1-based) у списку вибраного; показується замість ✓ */
  order?: number | null;
}) {
  const hue = courseHue(course.slug);
  const selectedRing = accent === "violet" ? "ring-violet-400" : "ring-emerald-400";
  const selectedBg = accent === "violet" ? "bg-violet-50/80" : "bg-emerald-50/80";
  const selectedBorder = accent === "violet" ? "border-violet-300" : "border-emerald-300";
  const checkColor = accent === "violet" ? "bg-violet-600 text-white" : "bg-emerald-600 text-white";

  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
        selected
          ? `${selectedBorder} ${selectedBg} shadow-sm ring-1 ${selectedRing}/30`
          : disabled
          ? "border-slate-100 bg-slate-50/50 opacity-50 cursor-not-allowed"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm cursor-pointer"
      }`}
    >
      {/* Colored avatar */}
      <div className={`relative w-9 h-9 rounded-lg bg-gradient-to-br ${hue.from} ${hue.to} flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0 shadow-sm`}>
        {initials(course.title)}
        {selected && (
          <span className={`absolute -top-1 -right-1 ${order ? "min-w-[18px] h-[18px] px-1" : "w-4 h-4"} rounded-full ${checkColor} flex items-center justify-center text-[10px] font-bold tabular-nums shadow ring-2 ring-white`}>
            {order ?? "✓"}
          </span>
        )}
      </div>

      {/* Title */}
      <span className="text-sm font-medium text-slate-800 flex-1 truncate">
        {course.title}
      </span>

      {/* Price or badge */}
      <span className={`shrink-0 ${strikeThrough && selected ? "line-through opacity-60" : ""}`}>
        {pill}
      </span>
    </button>
  );
}

/**
 * Ліва рейка вибору типу пакету — розрахована на життя ВСЕРЕДИНІ спільної картки
 * поруч із BundleForm. Не має власного card-chrome (border/shadow/radius) —
 * лише свій фон та правий роздільник.
 */
export function BundleTypeRail({
  type,
  onChange,
}: {
  type: BundleType;
  onChange: (t: BundleType) => void;
}) {
  return (
    <div className="md:sticky md:top-4 md:self-start bg-slate-50/70 rounded-t-2xl md:rounded-t-none md:rounded-l-2xl md:border-b-0 border-b border-slate-200/70 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white">
          <HiOutlineSparkles className="text-xs" />
        </span>
        <h2 className="text-[11px] font-bold text-slate-700 tracking-[0.1em] uppercase">Тип пакету</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        {(Object.keys(TYPE_LABELS) as BundleType[]).map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className={`group relative w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                active
                  ? "bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-sm shadow-violet-500/25 z-10"
                  : "bg-white/70 text-slate-700 ring-1 ring-slate-200/70 hover:bg-white hover:ring-slate-300"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-base leading-none flex-shrink-0 ${
                  active ? "bg-white/15" : "bg-slate-50 ring-1 ring-slate-100"
                }`}>
                  {TYPE_ICONS[t]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold leading-tight">{TYPE_LABELS[t]}</div>
                  <p className={`text-[10.5px] mt-0.5 leading-snug ${active ? "text-white/80" : "text-slate-500"}`}>
                    {TYPE_DESC[t]}
                  </p>
                </div>
              </div>
              {/* Коннектор-стрілка справа — «впаяна» у форму, перетинає межу rail/form */}
              {active && (
                <span
                  aria-hidden
                  className="hidden md:block absolute top-1/2 -right-[26px] -translate-y-1/2 w-0 h-0 border-y-[8px] border-y-transparent border-l-[10px] border-l-violet-700"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

