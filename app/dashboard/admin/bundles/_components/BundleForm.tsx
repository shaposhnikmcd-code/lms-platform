"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
}

const TYPE_LABELS: Record<BundleType, string> = {
  DISCOUNT: "Знижка на пакет",
  FIXED_FREE: "3-й безкоштовний сталий",
  CHOICE_FREE: "3-й безкоштовний на вибір",
};

const TYPE_DESC: Record<BundleType, string> = {
  DISCOUNT: "Пакет зі знижкою на всі курси. Ціна < суми цін.",
  FIXED_FREE: "N платних курсів + M безкоштовних. Адмін обирає які саме безкоштовні.",
  CHOICE_FREE: "N платних + пул безкоштовних. Клієнт сам обирає freeCount з пулу.",
};

export default function BundleForm({
  mode,
  initial,
  availableCourses,
  coursesLoading,
  onSubmit,
  saving,
  extraActions,
  submitLabel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [type, setType] = useState<BundleType>(initial?.type ?? "DISCOUNT");
  const [paidCount, setPaidCount] = useState(initial?.paidCount ?? 2);
  const [freeCount, setFreeCount] = useState(initial?.freeCount ?? (initial?.type === "DISCOUNT" ? 0 : 1));
  const [selectedPaid, setSelectedPaid] = useState<string[]>(
    () => (initial?.courses ?? []).filter((c) => !c.isFree).map((c) => c.courseSlug),
  );
  const [selectedFree, setSelectedFree] = useState<string[]>(
    () => (initial?.courses ?? []).filter((c) => c.isFree).map((c) => c.courseSlug),
  );
  const [message, setMessage] = useState("");
  const [discount, setDiscount] = useState(0);
  const [rounding, setRounding] = useState(false);
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const discountRef = useRef<HTMLDivElement>(null);
  const discountBtnRef = useRef<HTMLButtonElement>(null);
  const [discountAbove, setDiscountAbove] = useState(false);

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

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (mode === "create") {
      const s = val
        .toLowerCase()
        .replace(/[^a-z0-9а-яіїєґ\s-]/gi, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setSlug(s);
    }
  };

  const togglePaid = (courseSlug: string) => {
    if (selectedFree.includes(courseSlug)) return; // не можна в обох
    setSelectedPaid((prev) => {
      if (prev.includes(courseSlug)) return prev.filter((s) => s !== courseSlug);
      if (prev.length >= paidCount) return prev; // блокер
      return [...prev, courseSlug];
    });
  };

  const toggleFree = (courseSlug: string) => {
    if (selectedPaid.includes(courseSlug)) return;
    setSelectedFree((prev) => {
      if (prev.includes(courseSlug)) return prev.filter((s) => s !== courseSlug);
      if (type === "FIXED_FREE" && prev.length >= freeCount) return prev; // блокер
      // CHOICE_FREE — без верхнього блокера (пул відкритий)
      return [...prev, courseSlug];
    });
  };

  const totalPaidPrice = selectedPaid.reduce((sum, slug) => {
    const c = availableCourses.find((a) => a.slug === slug);
    return sum + (c?.price ?? 0);
  }, 0);

  const handleTypeChange = (newType: BundleType) => {
    setType(newType);
    setDiscount(0);
    if (newType === "DISCOUNT") {
      // Переносимо все у платні
      setSelectedPaid([...selectedPaid, ...selectedFree]);
      setSelectedFree([]);
      setFreeCount(0);
    } else {
      if (freeCount === 0) setFreeCount(1);
      // Для FIXED_FREE / CHOICE_FREE ціну не редагуємо вручну — розрахунок з платних
    }
  };

  const submit = async () => {
    if (!title.trim()) return setMessage("Вкажи назву пакету");
    if (!slug.trim()) return setMessage("Вкажи slug");

    if (type === "DISCOUNT") {
      if (selectedPaid.length < 2) return setMessage("DISCOUNT: обери мінімум 2 платні курси");
      if (selectedFree.length > 0) return setMessage("DISCOUNT: безкоштовних не має бути");
      const priceNum = parseInt(price);
      if (!priceNum || priceNum <= 0) return setMessage("Вкажи ціну пакету");
    } else if (type === "FIXED_FREE") {
      if (selectedPaid.length !== paidCount)
        return setMessage(`Обери рівно ${paidCount} платних`);
      if (selectedFree.length !== freeCount)
        return setMessage(`Обери рівно ${freeCount} безкоштовних`);
    } else if (type === "CHOICE_FREE") {
      if (selectedPaid.length !== paidCount)
        return setMessage(`Обери рівно ${paidCount} платних`);
      if (selectedFree.length < freeCount)
        return setMessage(`Пул має містити мінімум ${freeCount} безкоштовних`);
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
        paidCount,
        freeCount,
        courses,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Помилка збереження");
    }
  };

  return (
    <div className="space-y-5">
      {message && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {message}
        </div>
      )}

      {/* Type switcher */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Тип пакету
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_LABELS) as BundleType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                type === t
                  ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">{TYPE_DESC[type]}</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Назва пакету <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          maxLength={60}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Психологія + Психіатрія"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
        <p className={`text-xs font-semibold mt-1 text-right tabular-nums ${
          title.length >= 60 ? "text-rose-600" : title.length >= 50 ? "text-amber-600" : "text-slate-600"
        }`}>{title.length}/60</p>
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="psychology-psychiatry-bundle"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Платних курсів
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paidCount <= 1}
              onClick={() => setPaidCount((v) => Math.max(1, v - 1))}
              className="w-8 h-8 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              −
            </button>
            <div className="flex-1 text-center text-sm font-semibold tabular-nums py-2 border border-slate-200 rounded-lg">
              {paidCount}
            </div>
            <button
              type="button"
              onClick={() => setPaidCount((v) => v + 1)}
              className="w-8 h-8 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Безкоштовних {type === "CHOICE_FREE" && <span className="text-xs text-slate-400">(клієнт обирає)</span>}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={freeCount <= 0 || type === "DISCOUNT"}
              onClick={() => setFreeCount((v) => Math.max(0, v - 1))}
              className="w-8 h-8 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              −
            </button>
            <div className="flex-1 text-center text-sm font-semibold tabular-nums py-2 border border-slate-200 rounded-lg">
              {freeCount}
            </div>
            <button
              type="button"
              disabled={type === "DISCOUNT"}
              onClick={() => setFreeCount((v) => v + 1)}
              className="w-8 h-8 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Paid courses list */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Платні курси <span className="text-red-400">*</span>
          <span className="text-xs text-slate-400 ml-2">
            ({selectedPaid.length}/{type === "DISCOUNT" ? "∞" : paidCount})
          </span>
        </label>
        <div className="space-y-2">
          {coursesLoading ? (
            <p className="text-sm text-slate-400">Завантаження курсів…</p>
          ) : availableCourses.length === 0 ? (
            <p className="text-sm text-slate-400">Курси в БД відсутні.</p>
          ) : (
            availableCourses.map((course) => {
              const isSel = selectedPaid.includes(course.slug);
              const isInFree = selectedFree.includes(course.slug);
              const disabled = isInFree || (!isSel && type !== "DISCOUNT" && selectedPaid.length >= paidCount);
              return (
                <label
                  key={`paid-${course.slug}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isSel
                      ? "border-violet-300 bg-violet-50"
                      : isInFree
                      ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                      : disabled
                      ? "border-slate-100 opacity-40 cursor-not-allowed"
                      : "border-slate-200 hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    disabled={disabled}
                    onChange={() => togglePaid(course.slug)}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-700 flex-1">{course.title}</span>
                  <span className="text-sm text-slate-500 tabular-nums">
                    {course.price.toLocaleString()} ₴
                  </span>
                </label>
              );
            })
          )}
        </div>
        {selectedPaid.length > 0 && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
            Сума платних: <span className="font-semibold">{totalPaidPrice.toLocaleString()} ₴</span>
          </div>
        )}
      </div>

      {/* Free courses list (hidden for DISCOUNT) */}
      {type !== "DISCOUNT" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {type === "FIXED_FREE" ? "Безкоштовні курси" : "Пул безкоштовних (клієнт обере)"}
            <span className="text-xs text-slate-400 ml-2">
              ({selectedFree.length}
              {type === "FIXED_FREE" ? `/${freeCount}` : ` ≥ ${freeCount}`})
            </span>
          </label>
          <div className="space-y-2">
            {availableCourses.map((course) => {
              const isSel = selectedFree.includes(course.slug);
              const isInPaid = selectedPaid.includes(course.slug);
              const disabled = isInPaid || (!isSel && type === "FIXED_FREE" && selectedFree.length >= freeCount);
              return (
                <label
                  key={`free-${course.slug}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isSel
                      ? "border-emerald-300 bg-emerald-50"
                      : isInPaid
                      ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                      : disabled
                      ? "border-slate-100 opacity-40 cursor-not-allowed"
                      : "border-slate-200 hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    disabled={disabled}
                    onChange={() => toggleFree(course.slug)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span className="text-sm font-medium text-slate-700 flex-1">{course.title}</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Безкоштовно
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Price block — visible only for DISCOUNT */}
      {type === "DISCOUNT" ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ціна пакету (UAH) <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setDiscount(0); }}
              placeholder="5500"
              className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <div className="relative w-28">
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
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                {discount > 0 ? `−${discount}%` : "Знижка %"}
              </button>
              {showDiscountPicker && (
                <div
                  ref={discountRef}
                  className={`absolute left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 flex ${
                    discountAbove ? "bottom-full mb-1" : "top-full mt-1"
                  }`}
                  style={{ width: 125 }}
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
                        className={`w-full text-left px-3 py-1 text-sm hover:bg-violet-50 transition-colors ${
                          discount === pct ? "bg-violet-50 text-violet-700 font-medium" : "text-slate-700"
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
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
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
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  rounding ? "bg-violet-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
                    rounding ? "translate-x-4 ml-0.5" : "translate-x-0 ml-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-slate-500 whitespace-nowrap">Округлення</span>
            </label>
          </div>
          {price && totalPaidPrice > 0 && parseInt(price) < totalPaidPrice && (
            <p className="text-xs text-emerald-600 mt-1">
              Знижка: {Math.round((1 - parseInt(price) / totalPaidPrice) * 100)}% (економія {(totalPaidPrice - parseInt(price)).toLocaleString()} ₴)
            </p>
          )}
        </div>
      ) : (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          Ціна пакету = <span className="font-semibold">{totalPaidPrice.toLocaleString()} ₴</span> (сума платних). Безкоштовні курси додаються як 0 ₴.
        </div>
      )}

      {/* Published */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50/50">
        <div>
          <p className="text-sm font-medium text-slate-700">Показувати на сайті</p>
          <p className="text-xs text-slate-400 mt-0.5">Пакет буде видимий для покупців на сторінці курсів</p>
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

      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-violet-600 text-white font-medium py-3 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
      >
        {saving ? "Збереження..." : submitLabel ?? (mode === "create" ? "Створити пакет" : "Зберегти зміни")}
      </button>
    </div>
  );
}
