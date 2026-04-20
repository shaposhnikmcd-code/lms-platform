'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { FaTimes, FaCheck, FaSpinner } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import CoursePhoneInput, { PHONE_CONFIG } from './CoursePhoneInput';

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
  onClose,
}: CoursePurchaseDialogProps) {
  const t = useTranslations('PurchaseModal');
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';
  /// Адмін тестує за символічну ціну — щоб легко розрізняти плани в логах/callback:
  /// `yearly-program` (річна) = 2 ₴, решта (місячна, курси, пакети) = 1 ₴.
  const adminTestPrice = courseId === 'yearly-program' ? 2 : 1;
  const effectivePrice = isAdmin ? adminTestPrice : price;

  const [loading, setLoading] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  /// Синхронний inflight-гард: блокує подвійний клік у вікно між onClick і setLoading(true).
  const inFlightRef = useRef(false);

  const [email, setEmail] = useState(() => session?.user?.email || '');
  const [firstName, setFirstName] = useState(() => session?.user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(() => session?.user?.name?.split(' ').slice(1).join(' ') || '');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('UA');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [finalPrice, setFinalPrice] = useState(effectivePrice);
  /// Циклічна (true) vs разова (false). null = не обрано (блокує оплату при allowRecurringChoice).
  const [isRecurring, setIsRecurring] = useState<boolean | null>(null);
  type FieldErrors = Partial<Record<'email' | 'firstName' | 'lastName' | 'phone' | 'payType' | 'general', string>>;
  const [errors, setErrors] = useState<FieldErrors>({});
  const clearError = (k: keyof FieldErrors) =>
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const closeModal = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Коли зовні зміниться price (Bug #12) — синхронізуємо finalPrice, щоб не надсилати
  // в оплату застарілу ціну. Не чіпаємо, якщо юзер вже застосував промокод.
  useEffect(() => {
    if (!promoApplied) setFinalPrice(effectivePrice);
  }, [effectivePrice, promoApplied]);

  // Dialog рендериться лише коли isOpen=true у батька, тому гарантовано відкритий.
  // Esc + scroll lock активуються відразу на mount і знімаються на unmount.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal]);

  const handlePromoCheck = async () => {
    if (!promoCode.trim()) return;
    if (isAdmin) {
      // У адмін-тесті промокод не потрібен — ціна вже 1 ₴.
      setPromoError(`У адмін-тесті промо не застосовується — ціна вже ${adminTestPrice} ₴.`);
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
        if (data.discountType === 'PERCENTAGE') {
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
    if (!email.trim()) next.email = t('alertEmail');
    if (!firstName.trim()) next.firstName = t('alertFirstName');
    if (!lastName.trim()) next.lastName = t('alertLastName');
    if (!phone.trim()) next.phone = t('alertPhone');
    if (allowRecurringChoice && isRecurring === null) next.payType = 'Оберіть тип оплати';
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
        }),
      });
      if (!response.ok) throw new Error(t('errorPayment'));
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
      setErrors((prev) => ({ ...prev, general: t('errorPaymentRetry') }));
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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={closeModal} />

      {/* Centering wrapper */}
      <div className="relative min-h-full flex items-center justify-center p-4 sm:p-6" onClick={closeModal}>
        {/* Modal card */}
        <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Close button */}
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={t('closeAria')}
          >
            <FaTimes />
          </button>

          {/* Header */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 pr-10">{courseName}</h2>
            {isAdmin && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-300/50">
                🔧 Тестовий режим адміна: {adminTestPrice} ₴
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="px-6 sm:px-8 py-4 space-y-4">
            <div>
              <label htmlFor="purchase-email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                placeholder="username@gmail.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className={`w-full px-4 py-3 border rounded-lg outline-none text-gray-900 transition-colors ${
                  errors.email
                    ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
                }`}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="purchase-firstname" className="block text-sm font-medium text-gray-700 mb-1">
                {t('firstName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-firstname"
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); clearError('firstName'); }}
                placeholder={t('firstNamePlaceholder')}
                autoComplete="given-name"
                aria-invalid={!!errors.firstName}
                className={`w-full px-4 py-3 border rounded-lg outline-none text-gray-900 transition-colors ${
                  errors.firstName
                    ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
                }`}
              />
              {errors.firstName && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.firstName}</p>}
            </div>

            <div>
              <label htmlFor="purchase-lastname" className="block text-sm font-medium text-gray-700 mb-1">
                {t('lastName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-lastname"
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); clearError('lastName'); }}
                placeholder={t('lastNamePlaceholder')}
                autoComplete="family-name"
                aria-invalid={!!errors.lastName}
                className={`w-full px-4 py-3 border rounded-lg outline-none text-gray-900 transition-colors ${
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
              />
              {errors.phone && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.phone}</p>}
            </div>

            {allowRecurringChoice && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип оплати <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    {
                      value: false as const,
                      kicker: 'РАЗОВА',
                      unit: 'одноразово',
                      hint: '30 днів доступу · без автосписань',
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
                      kicker: 'АВТОПЛАТІЖ · 9 МІС.',
                      unit: '/міс · 9 разів',
                      hint: `Автосписання з картки · разом ${(price * 9).toLocaleString('uk-UA')} ₴`,
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
                        className={`group relative overflow-hidden rounded-xl px-3 py-2 text-left transition-all duration-300 ${
                          selected
                            ? 'bg-gradient-to-b from-[#FDF6E0] via-white to-white border-2 border-[#D4A017] shadow-[0_8px_22px_-8px_rgba(212,160,23,0.45)] -translate-y-[1px]'
                            : errored
                            ? 'bg-white border-2 border-red-300'
                            : 'bg-gradient-to-br from-[#FDFBF4] to-white border-2 border-[#D4A017]/35 hover:border-[#D4A017] hover:shadow-[0_4px_14px_-4px_rgba(212,160,23,0.25)] hover:-translate-y-[1px]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
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
                            className={`text-[19px] font-black tabular-nums ${
                              selected ? 'text-[#1C3A2E]' : 'text-[#1C3A2E]'
                            }`}
                          >
                            {price.toLocaleString('uk-UA')}
                          </span>
                          <span className="text-[11px] font-bold text-[#1C3A2E]">₴</span>
                          <span
                            className={`text-[10px] font-medium ${
                              selected ? 'text-[#1C3A2E]/70' : 'text-[#1C3A2E]/60'
                            }`}
                          >
                            {opt.unit}
                          </span>
                        </div>

                        <div
                          className={`mt-1 text-[10px] leading-tight ${
                            selected ? 'text-[#1C3A2E]/80' : 'text-[#1C3A2E]/55'
                          }`}
                        >
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.payType && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span aria-hidden>•</span>{errors.payType}</p>}
                {isRecurring === true && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-[#FDFBF4] border border-[#D4A017]/25 text-[11px] leading-relaxed text-[#1C3A2E]/80 flex gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#D4A017] shrink-0 mt-0.5" aria-hidden>
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    </svg>
                    <span>
                      Картка списуватиметься автоматично <b>{price.toLocaleString('uk-UA')} ₴ щомісяця, 9 разів</b>. Після 9-го платежу списання припиняється. Скасувати можна будь-коли написавши нам в Тех. підтримку. Контакти можна знайти на сторінці Про нас
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="purchase-promo" className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A017] focus:border-transparent outline-none text-gray-900"
                />
                <button
                  onClick={handlePromoCheck}
                  disabled={promoLoading || !promoCode.trim()}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0"
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
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-2">
            <div className="border-t border-gray-200 pt-4 mb-4">
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

            {errors.general && (
              <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <span className="mt-0.5" aria-hidden>⚠</span>
                <span>{errors.general}</span>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-4 bg-[#1C3A2E] text-white font-bold rounded-xl hover:bg-[#2a4f3f] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('loading') : t('btnPay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
