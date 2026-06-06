'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { FaTimes, FaCheck, FaSpinner, FaTelegramPlane, FaApplePay, FaGooglePay } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import CoursePhoneInput, { PHONE_CONFIG } from './CoursePhoneInput';
import CountryPicker from './CountryPicker';
import { parseTelegramUsername } from '@/lib/telegramUsername';
import { inferEcommerceCategory, trackBeginCheckout } from '@/lib/analytics/ecommerce';

const capitalizeFirst = (s: string) =>
  s.length > 0 ? s.charAt(0).toLocaleUpperCase('uk-UA') + s.slice(1) : s;

export interface CoursePurchaseDialogProps {
  courseName: string;
  price: number;
  courseId: string;
  currency?: string;
  compact?: boolean;
  /// Для CHOICE_FREE пакетів — передається вибір клієнта на сервер
  selectedFreeSlugs?: string[];
  /// Якщо true — показати toggle "Разова / Циклічна 9 міс." (для yearly-program-monthly).
  allowRecurringChoice?: boolean;
  /// Invite-flow: signed token від менеджера. Прив'язує оплату до конкретного cohort-у
  /// й маркує підписку як manually-added у callback-у.
  inviteToken?: string;
  invitePrefill?: {
    email: string;
    name?: string | null;
    plan?: 'YEARLY' | 'MONTHLY';
    autoRenew?: boolean;
  };
  /// Закриття діалогу (викликається на Esc, backdrop-клік, кнопці "×").
  onClose: () => void;
}

export default function CoursePurchaseDialog({
  courseName,
  price,
  courseId,
  currency = 'грн',
  selectedFreeSlugs,
  allowRecurringChoice = false,
  inviteToken,
  invitePrefill,
  onClose,
}: CoursePurchaseDialogProps) {
  const t = useTranslations('PurchaseModal');
  const { data: session } = useSession();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'MANAGER';
  /// Адмін/менеджер тестує за символічну ціну — щоб легко розрізняти плани в логах/callback:
  /// `yearly-program` (річна) = 2 ₴, решта (місячна, курси, пакети) = 1 ₴.
  const adminTestPrice = courseId === 'yearly-program' ? 2 : 1;
  const effectivePrice = isAdmin ? adminTestPrice : price;

  /// Поля "Країна проживання" і "Telegram username" обов'язкові тільки для покупок
  /// Річної програми (yearly + monthly). На звичайні курси/пакети — не показуємо.
  const isYearlyProgram = courseId === 'yearly-program' || courseId === 'yearly-program-monthly';
  /// Pre-submit enrollment check ганяємо для звичайних курсів і для пакетів. Пакет
  /// повертає список курсів, які вже є у юзера (soft-warning, не блокуємо оплату).
  /// Yearly/конектор мають власні політики ownership.
  const isBundlePurchase = courseId.startsWith('bundle_');
  const isRegularCoursePurchase = !isYearlyProgram
    && !isBundlePurchase
    && courseId !== 'connector'
    && !courseId.startsWith('connector_');
  /// Висота полів зменшена в обох yearly-формах, щоб компенсувати додаткові секції
  /// (Тип оплати в monthly, нижній блок ціни в yearly) і вирівняти загальну висоту:
  ///   - yearly (одноразова): ~8% менше padding
  ///   - monthly (з вибором Разова/Автоплатіж): ~15% менше padding
  let inputPadY = 'py-2.5';
  let tallPadY = 'py-3';
  if (courseId === 'yearly-program') {
    inputPadY = 'py-[7px]';
    tallPadY = 'py-[9px]';
  } else if (courseId === 'yearly-program-monthly') {
    inputPadY = 'py-[4px]';
    tallPadY = 'py-[6px]';
  }

  const [loading, setLoading] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  /// Синхронний inflight-гард: блокує подвійний клік у вікно між onClick і setLoading(true).
  const inFlightRef = useRef(false);

  // Invite-flow: prefill email + ім'я з token-у (від менеджера). Email lock-нутий, name теж prefill,
  // але редагований (якщо менеджер не вказав, або помилився).
  const inviteName = invitePrefill?.name?.trim() ?? '';
  const inviteFirstName = inviteName ? inviteName.split(' ')[0] : '';
  const inviteLastName = inviteName ? inviteName.split(' ').slice(1).join(' ') : '';
  const inviteAutoRenew = invitePrefill?.autoRenew ?? null;

  const [email, setEmail] = useState(() => invitePrefill?.email || session?.user?.email || '');
  const [firstName, setFirstName] = useState(() => inviteFirstName || session?.user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(() => inviteLastName || session?.user?.name?.split(' ').slice(1).join(' ') || '');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('UA');
  const [residenceCountry, setResidenceCountry] = useState('UA');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [finalPrice, setFinalPrice] = useState(effectivePrice);
  /// Циклічна (true) vs разова (false). null = не обрано (блокує оплату при allowRecurringChoice).
  /// Invite-flow з autoRenew у token — перепризначаємо одразу і не даємо змінити.
  const [isRecurring, setIsRecurring] = useState<boolean | null>(inviteAutoRenew);
  type FieldErrors = Partial<Record<'email' | 'firstName' | 'lastName' | 'phone' | 'country' | 'telegram' | 'payType' | 'general', string>>;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  /// Soft-warning для пакетів: курси з пакету, які юзер уже має. Оплату не блокує.
  const [bundleOverlap, setBundleOverlap] = useState<{ slug: string; title: string }[]>([]);
  /// Confirm-попап перед оплатою пакету з overlap-ом. Захист від випадкового кліку.
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const clearError = (k: keyof FieldErrors) =>
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const closeModal = useCallback(() => onClose(), [onClose]);

  // Чи почалося натискання миші САМЕ на оверлеї (а не зсередини форми). Захист від
  // закриття при виділенні тексту в полі з відпусканням миші за межами картки —
  // тоді mousedown стартує всередині, і форма НЕ має закриватись.
  const overlayPressRef = useRef(false);
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    overlayPressRef.current = e.target === e.currentTarget;
  };
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && overlayPressRef.current) closeModal();
    overlayPressRef.current = false;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Коли зовні зміниться price (Bug #12) — синхронізуємо finalPrice, щоб не надсилати
  // в оплату застарілу ціну. Не чіпаємо, якщо юзер вже застосував промокод.
  useEffect(() => {
    if (!promoApplied) setFinalPrice(effectivePrice);
  }, [effectivePrice, promoApplied]);

  // Pre-submit enrollment check: коли email заповнений — питаємо сервер, чи цей email
  // вже має enrollment на цей курс. Якщо так — показуємо amber-банер одразу, ще до того,
  // як юзер ввів промокод і клацнув "Купити". Server-side guard на /api/wayforpay
  // лишається — це лише UX-сигнал. Скоуп — звичайні курси.
  useEffect(() => {
    if (!isRegularCoursePurchase && !isBundlePurchase) return;
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    const ctrl = new AbortController();
    const tid = setTimeout(() => {
      fetch('/api/courses/check-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, courseId }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.enrolled === true) setAlreadyPurchased(true);
          if (Array.isArray(data?.overlap)) {
            setBundleOverlap(data.overlap.filter((c: unknown): c is { slug: string; title: string } =>
              !!c && typeof c === 'object' && typeof (c as { slug?: unknown }).slug === 'string'
                && typeof (c as { title?: unknown }).title === 'string'));
          }
        })
        .catch(() => { /* ignore — server-side check на /api/wayforpay лишається authoritative */ });
    }, 500);
    return () => { clearTimeout(tid); ctrl.abort(); };
  }, [email, courseId, isRegularCoursePurchase, isBundlePurchase]);

  // Dialog рендериться лише коли isOpen=true у батька, тому гарантовано відкритий.
  // Esc + scroll lock активуються відразу на mount і знімаються на unmount.
  useEffect(() => {
    // Блокуємо скрол body, але компенсуємо ширину скролбара padding-ом — інакше при
    // зникненні вертикального скролбара сторінка «стрибає» ширше (layout shift).
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal]);

  const handlePromoCheck = async () => {
    if (!promoCode.trim()) return;
    if (isAdmin) {
      // У тестовому режимі промокод не потрібен — ціна вже 1 ₴.
      setPromoError(t('testModePromo', { price: adminTestPrice }));
      return;
    }
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), courseId }),
      });
      const data = await res.json();
      if (data.valid) {
        let newPrice = price;
        if (data.discountType === 'FIXED_PRICE') {
          // Per-course override-промо: фіксована ціна, задана адміном для цього курсу
          newPrice = Math.max(1, Number(data.fixedPrice));
        } else if (data.discountType === 'PERCENTAGE') {
          newPrice = Math.max(1, Math.round(price * (1 - data.discountValue / 100)));
        } else {
          newPrice = Math.max(1, price - data.discountValue);
        }
        setFinalPrice(newPrice);
        setPromoApplied(true);
        setPromoError('');
      } else {
        setPromoError(data.message);
        setPromoApplied(false);
        setFinalPrice(price);
      }
    } catch {
      setPromoError(t('promoError'));
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePay = async () => {
    if (inFlightRef.current) return;
    const next: FieldErrors = {};
    /// Email: формат `local@domain.tld`. До цього перевіряли лише `!email.trim()` —
    /// «римо», «123», та ін. проходили. Той самий regex живе на сервері в
    /// `/api/wayforpay` як defense-in-depth.
    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      next.email = t('alertEmail');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      next.email = 'Введіть коректну адресу: наприклад name@gmail.com';
    }
    if (!firstName.trim()) next.firstName = t('alertFirstName');
    if (!lastName.trim()) next.lastName = t('alertLastName');
    /// Phone: вимагаємо рівно `maxDigits` цифр для обраної країни. Поле вже
    /// очищає не-цифри і обмежує довжину при вводі, але користувач міг ввести
    /// менше і натиснути «Оплатити».
    const phoneTrimmed = phone.trim();
    const expectedDigits = (PHONE_CONFIG[phoneCountry] ?? PHONE_CONFIG['UA']).maxDigits;
    if (!phoneTrimmed) {
      next.phone = t('alertPhone');
    } else if (phoneTrimmed.length !== expectedDigits) {
      next.phone = `Введіть повний номер: ${expectedDigits} цифр`;
    }
    let normalizedTelegram: string | null = null;
    if (isYearlyProgram) {
      if (!residenceCountry) next.country = 'Оберіть країну проживання';
      const tg = parseTelegramUsername(telegramUsername);
      if (!tg.ok) next.telegram = tg.error ?? 'Вкажіть Telegram username';
      else normalizedTelegram = tg.normalized;
    }
    if (allowRecurringChoice && isRecurring === null) next.payType = t('alertPayType');
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    const fullPhone = `${(PHONE_CONFIG[phoneCountry] ?? PHONE_CONFIG['UA']).prefix}${phone}`;

    inFlightRef.current = true;
    setLoading(true);
    try {
      // Унікальний orderReference з crypto.randomUUID щоб уникнути колізій при швидких кліках
      // або двох вкладках (Bug M9).
      const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
      const orderReference = `${courseId}_${Date.now()}_${uuid}`;

      // GA4 begin_checkout — фінальна ціна (з промокодом / адмін-тарифом) перед редіректом у WFP.
      trackBeginCheckout({
        item_id: courseId,
        item_name: courseName,
        item_category: inferEcommerceCategory(courseId),
        price: finalPrice,
      });
      const response = await fetch('/api/wayforpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
          amount: finalPrice,
          productName: courseName,
          productPrice: finalPrice,
          productCount: 1,
          clientEmail: email.trim(),
          clientName: `${firstName.trim()} ${lastName.trim()}`,
          clientPhone: fullPhone,
          courseId,
          promoCode: promoApplied ? promoCode.trim() : undefined,
          selectedFreeSlugs: selectedFreeSlugs && selectedFreeSlugs.length > 0 ? selectedFreeSlugs : undefined,
          recurring: allowRecurringChoice ? isRecurring === true : undefined,
          invite: inviteToken,
          country: isYearlyProgram ? residenceCountry : undefined,
          telegramUsername: isYearlyProgram ? normalizedTelegram : undefined,
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({})) as { error?: string; code?: string };
        // Спеціальний кейс: курс вже куплено цим email. Показуємо amber-banner
        // (не червоний — це не помилка платежу, а інформативне повідомлення).
        if (errBody.code === 'course_already_purchased') {
          setAlreadyPurchased(true);
          setLoading(false);
          inFlightRef.current = false;
          return;
        }
        throw new Error(errBody.error || t('errorPayment'));
      }
      const paymentData = await response.json();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://secure.wayforpay.com/pay';
      form.style.display = 'none';
      Object.entries(paymentData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          (value as (string | number)[]).forEach((v) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = String(v);
            form.appendChild(input);
          });
        } else {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        }
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error('Payment error:', error);
      const msg = error instanceof Error && error.message && error.message !== t('errorPayment')
        ? error.message
        : t('errorPaymentRetry');
      setErrors((prev) => ({ ...prev, general: msg }));
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`${t('buyAria')} ${courseName}`}
    >
      {/* Backdrop — лише візуальний; закриття обробляє wrapper з guard-ом нижче */}
      <div className="fixed inset-0 bg-black/60" />

      {/* Centering wrapper — закриваємо лише якщо і натискання, і клік сталися на оверлеї */}
      <div
        className="relative min-h-full flex items-center justify-center p-3 sm:p-4"
        onMouseDown={handleOverlayMouseDown}
        onClick={handleOverlayClick}
      >
        {/* Modal card */}
        <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Overlap confirm — повний overlay поверх форми */}
          {showOverlapConfirm && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-white flex flex-col overflow-hidden">
              {/* Top accent strip */}
              <div className="h-1 bg-gradient-to-r from-[#F2C76D] via-[#D4A843] to-[#F2C76D]" />

              <div className="flex-1 flex flex-col items-center justify-center px-7 sm:px-10 py-8 text-center">
                {/* Icon badge */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 shadow-[0_4px_14px_-4px_rgba(212,168,67,0.35)] flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>

                <h3 className="text-[18px] sm:text-[19px] font-bold text-stone-900 tracking-tight mb-1.5">
                  Підтвердіть покупку
                </h3>
                <p className="text-[13px] text-stone-500 leading-relaxed mb-5 max-w-xs">
                  {bundleOverlap.length === 1
                    ? 'У вас уже є цей курс із пакету:'
                    : `У вас уже є ${bundleOverlap.length} курси з пакету:`}
                </p>

                {/* Course chips */}
                <div className="w-full space-y-1.5 mb-5">
                  {bundleOverlap.map((c) => (
                    <div
                      key={c.slug}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70"
                    >
                      <div className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <FaCheck className="text-amber-600 text-[10px]" aria-hidden />
                      </div>
                      <span className="text-[13px] font-medium text-stone-800 text-left truncate">
                        {c.title}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[12px] text-stone-500 leading-relaxed mb-6 max-w-xs">
                  Доступ до вже наявних курсів збережеться. Ви заплатите за весь пакет.
                </p>

                {/* Buttons */}
                <div className="w-full flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowOverlapConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowOverlapConfirm(false); handlePay(); }}
                    className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-[#1C3A2E] hover:bg-[#2a4f3f] shadow-[0_6px_16px_-6px_rgba(28,58,46,0.5)] transition-colors"
                  >
                    Так, купити пакет
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={t('closeAria')}
          >
            <FaTimes />
          </button>

          {/* Header */}
          <div className="px-6 sm:px-8 pt-4 sm:pt-5 pb-1">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 pr-10">{courseName}</h2>
            {isAdmin && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-300/50">
                {t('testModeBadge', { price: adminTestPrice })}
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="px-6 sm:px-8 py-2.5 space-y-2.5">
            <div>
              <label htmlFor="purchase-firstname" className="block text-sm font-medium text-gray-700 mb-0.5">
                {t('firstName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-firstname"
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(capitalizeFirst(e.target.value)); clearError('firstName'); }}
                placeholder={t('firstNamePlaceholder')}
                autoComplete="given-name"
                aria-invalid={!!errors.firstName}
                className={`w-full px-4 ${inputPadY} border rounded-lg outline-none text-gray-900 transition-colors ${
                  errors.firstName
                    ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
                }`}
              />
              {errors.firstName && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.firstName}</p>}
            </div>

            <div>
              <label htmlFor="purchase-lastname" className="block text-sm font-medium text-gray-700 mb-0.5">
                {t('lastName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-lastname"
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(capitalizeFirst(e.target.value)); clearError('lastName'); }}
                placeholder={t('lastNamePlaceholder')}
                autoComplete="family-name"
                aria-invalid={!!errors.lastName}
                className={`w-full px-4 ${inputPadY} border rounded-lg outline-none text-gray-900 transition-colors ${
                  errors.lastName
                    ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
                }`}
              />
              {errors.lastName && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.lastName}</p>}
            </div>

            <div>
              <CoursePhoneInput
                phoneCountry={phoneCountry}
                phone={phone}
                onPhoneCountryChange={setPhoneCountry}
                onPhoneChange={(v) => { setPhone(v); clearError('phone'); }}
                paddingY={tallPadY}
              />
              {errors.phone && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.phone}</p>}
            </div>

            <div>
              <label htmlFor="purchase-email" className="block text-sm font-medium text-gray-700 mb-0.5">
                {t('email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email'); setAlreadyPurchased(false); setBundleOverlap([]); }}
                placeholder="username@gmail.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                readOnly={!!inviteToken}
                disabled={!!inviteToken}
                className={`w-full px-4 ${inputPadY} border rounded-lg outline-none text-gray-900 transition-colors ${
                  errors.email
                    ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300 focus:border-red-400'
                    : inviteToken
                      ? 'border-amber-300 bg-amber-50/40 cursor-not-allowed'
                      : 'border-gray-300 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
                }`}
              />
              {inviteToken && (
                <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                  <span aria-hidden>📨</span>
                  Запрошення від менеджера UIMP — email зафіксований
                </p>
              )}
              {!inviteToken && !errors.email && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-start gap-1">
                  <span aria-hidden>⚠️</span>
                  <span>Перевірте email перед оплатою — на нього прийде доступ до курсу. Помилка в одній букві створить новий акаунт.</span>
                </p>
              )}
              {errors.email && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.email}</p>}
            </div>

            {isYearlyProgram && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">
                    Країна проживання <span className="text-red-500">*</span>
                  </label>
                  <CountryPicker
                    value={residenceCountry}
                    onChange={(c) => { setResidenceCountry(c); clearError('country'); }}
                    invalid={!!errors.country}
                    paddingY={tallPadY}
                  />
                  {errors.country ? (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <span aria-hidden>•</span>
                      {errors.country}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-gray-500 leading-snug">
                      Потрібно, щоб розуміти, в якій ви тайм-зоні — для кращого поділу на групи.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="purchase-telegram" className="block text-sm font-medium text-gray-700 mb-0.5">
                    Telegram username <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <FaTelegramPlane className="text-[#229ED9] text-sm" aria-hidden />
                    </span>
                    <input
                      id="purchase-telegram"
                      type="text"
                      value={telegramUsername}
                      onChange={(e) => { setTelegramUsername(e.target.value); clearError('telegram'); }}
                      placeholder="@your_username"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-invalid={!!errors.telegram}
                      aria-describedby="purchase-telegram-hint"
                      className={`w-full pl-10 pr-4 ${inputPadY} border rounded-lg outline-none text-gray-900 transition-colors ${
                        errors.telegram
                          ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300 focus:border-red-400'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
                      }`}
                    />
                  </div>
                  {errors.telegram ? (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <span aria-hidden>•</span>
                      {errors.telegram}
                    </p>
                  ) : (
                    <p id="purchase-telegram-hint" className="mt-1 text-[11px] text-gray-500 leading-snug">
                      Додамо вас до закритого Telegram-каналу з організаційними оголошеннями.
                    </p>
                  )}
                </div>
              </>
            )}

            {allowRecurringChoice && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('payTypeLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {
                      value: false as const,
                      kicker: t('payOneTimeKicker'),
                      unit: t('payOneTimeUnit'),
                      hint: t('payOneTimeHint'),
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <rect x="3" y="6" width="18" height="13" rx="2" />
                          <path d="M3 10h18" />
                          <path d="M7 15h3" />
                        </svg>
                      ),
                    },
                    {
                      value: true as const,
                      kicker: t('payRecurringKicker'),
                      unit: t('payRecurringUnit'),
                      hint: t('payRecurringHint', { total: (price * 9).toLocaleString('uk-UA') }),
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                          <polyline points="21 3 21 8 16 8" />
                          <polyline points="3 21 3 16 8 16" />
                        </svg>
                      ),
                    },
                  ]).map((opt) => {
                    const selected = isRecurring === opt.value;
                    const errored = !!errors.payType && !selected;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => { setIsRecurring(opt.value); clearError('payType'); }}
                        aria-pressed={selected}
                        className={`group relative overflow-hidden rounded-xl px-2.5 py-1.5 text-left transition-all duration-300 ${
                          selected
                            ? 'bg-gradient-to-b from-[#FDF6E0] via-white to-white border-2 border-[#D4A017] shadow-[0_8px_22px_-8px_rgba(212,160,23,0.45)] -translate-y-[1px]'
                            : errored
                            ? 'bg-white border-2 border-red-300'
                            : 'bg-gradient-to-br from-[#FDFBF4] to-white border-2 border-[#D4A017]/35 hover:border-[#D4A017] hover:shadow-[0_4px_14px_-4px_rgba(212,160,23,0.25)] hover:-translate-y-[1px]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                              selected
                                ? 'bg-[#1C3A2E] text-[#D4A017]'
                                : 'bg-[#1C3A2E] text-[#D4A017]/90 group-hover:text-[#D4A017]'
                            }`}
                            aria-hidden
                          >
                            {opt.icon}
                          </div>
                          <div
                            className={`text-[9px] font-bold tracking-[0.14em] flex-1 ${
                              selected ? 'text-[#B8860B]' : 'text-[#1C3A2E]/70'
                            }`}
                          >
                            {opt.kicker}
                          </div>
                          <div
                            className={`w-[16px] h-[16px] rounded-full flex items-center justify-center shrink-0 transition-all ${
                              selected
                                ? 'bg-[#D4A017] shadow-[0_0_0_3px_rgba(212,160,23,0.25)]'
                                : 'border-2 border-[#D4A017]/50 group-hover:border-[#D4A017]'
                            }`}
                            aria-hidden
                          >
                            {selected && <FaCheck className="text-white text-[7px]" />}
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1 leading-none flex-wrap">
                          <span
                            className={`text-[16px] font-black tabular-nums ${
                              selected ? 'text-[#1C3A2E]' : 'text-[#1C3A2E]'
                            }`}
                          >
                            {price.toLocaleString('uk-UA')}
                          </span>
                          <span className="text-[10px] font-bold text-[#1C3A2E]">{t('payCurrency')}</span>
                          <span
                            className={`text-[10px] font-medium ${
                              selected ? 'text-[#1C3A2E]/70' : 'text-[#1C3A2E]/60'
                            }`}
                          >
                            {opt.unit}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.payType && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.payType}</p>}
                {isRecurring === true && (
                  <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#FDFBF4] border border-[#D4A017]/25 text-[11px] leading-snug text-[#1C3A2E]/80 flex gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#D4A017] shrink-0 mt-0.5" aria-hidden>
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    </svg>
                    <span>
                      {t('recurringNotice', { price: price.toLocaleString('uk-UA') })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="purchase-promo" className="block text-sm font-medium text-gray-700 mb-0.5">
                {t('promoLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="purchase-promo"
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromoApplied(false);
                    setPromoError('');
                    setFinalPrice(price);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePromoCheck();
                    }
                  }}
                  placeholder={t('promoPlaceholder')}
                  className={`flex-1 min-w-0 px-4 ${inputPadY} border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A017] focus:border-transparent outline-none text-gray-900`}
                />
                <button
                  onClick={handlePromoCheck}
                  disabled={promoLoading || !promoCode.trim() || alreadyPurchased}
                  className={`px-4 ${inputPadY} bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0`}
                >
                  {promoLoading ? (
                    <FaSpinner className="animate-spin" />
                  ) : promoApplied ? (
                    <FaCheck className="text-green-500" />
                  ) : (
                    t('promoApply')
                  )}
                </button>
              </div>
              {promoError && <p className="text-red-500 text-sm mt-1">{promoError}</p>}
              {promoApplied && <p className="text-green-600 text-sm mt-1">{t('promoSuccess')}</p>}
            </div>
          </div>

          {/* Footer: price + pay button */}
          <div className="px-6 sm:px-8 pb-4 sm:pb-5 pt-1">
            {!allowRecurringChoice && (
              <div className="border-t border-gray-200 pt-2.5 mb-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-gray-600">{courseName}</span>
                  <div className="flex items-baseline gap-2">
                    {(promoApplied || isAdmin) && finalPrice !== price && (
                      <span className="text-base text-gray-400 line-through">
                        {price} {currency}
                      </span>
                    )}
                    <span className={`text-2xl font-bold ${isAdmin ? 'text-amber-700' : 'text-gray-900'}`}>
                      {finalPrice} {currency}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {allowRecurringChoice && <div className="border-t border-gray-200 mb-3" />}

            {errors.general && (
              <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <span className="mt-0.5" aria-hidden>⚠</span>
                <span>{errors.general}</span>
              </div>
            )}

            {alreadyPurchased && (
              <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm flex items-start gap-2.5">
                <span className="text-lg mt-0.5" aria-hidden>✅</span>
                <div>
                  <p className="font-semibold mb-1">Цей курс уже придбано</p>
                  <p className="leading-relaxed">
                    На пошту <strong>{email}</strong> ви вже маєте доступ до курсу <strong>«{courseName}»</strong>. Перевірте свої листи (та папку «Спам») або зайдіть на платформу SendPulse — курс вже у вашому кабінеті.
                  </p>
                  <p className="mt-2 text-[12px] text-amber-800">
                    Помилка? Напишіть на <a href="mailto:edu@uimp.com.ua" className="underline">edu@uimp.com.ua</a>.
                  </p>
                </div>
              </div>
            )}

            {isBundlePurchase && bundleOverlap.length > 0 && !alreadyPurchased && (
              <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm flex items-start gap-2.5">
                <span className="text-lg mt-0.5" aria-hidden>⚠️</span>
                <div>
                  <p className="font-semibold mb-1">
                    {bundleOverlap.length === 1
                      ? 'У вас вже є курс із цього пакету'
                      : `У вас вже є ${bundleOverlap.length} курси з цього пакету`}
                  </p>
                  <ul className="leading-relaxed list-disc pl-5 space-y-0.5">
                    {bundleOverlap.map((c) => (
                      <li key={c.slug}><strong>«{c.title}»</strong></li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-amber-800">
                    Ви можете все одно купити пакет, щоб отримати решту курсів — доступ до вже наявних не зникне.
                  </p>
                </div>
              </div>
            )}

            {!alreadyPurchased && (
              <div className="mb-3 rounded-xl bg-[#1C3A2E]/[0.06] border border-[#1C3A2E]/15 text-[#1C3A2E] overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2.5 border-b border-[#1C3A2E]/10">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black text-white text-[12px] font-semibold">
                    <FaApplePay className="text-lg" /> Pay
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black text-white text-[12px] font-semibold">
                    <FaGooglePay className="text-lg" /> Pay
                  </span>
                  <span className="text-[12.5px] font-bold">— оплата в один дотик</span>
                </div>
                <p className="px-4 py-2 text-[12px] leading-relaxed">
                  <strong>Радимо Apple&nbsp;Pay або Google&nbsp;Pay</strong> — без SMS і зайвих кроків (кнопки внизу сторінки оплати). Якщо платите карткою вручну — банк попросить код із SMS, введіть його, щоб завершити.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                if (isBundlePurchase && bundleOverlap.length > 0) {
                  setShowOverlapConfirm(true);
                } else {
                  handlePay();
                }
              }}
              disabled={loading || alreadyPurchased}
              className="w-full py-2.5 bg-[#1C3A2E] text-white font-bold rounded-xl hover:bg-[#2a4f3f] transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? t('loading')
                : alreadyPurchased
                ? 'Курс уже у вас'
                : isBundlePurchase && bundleOverlap.length > 0
                ? 'Все одно купити пакет'
                : t('btnPay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
