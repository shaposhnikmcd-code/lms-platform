'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { FaWallet, FaTimes, FaCheck, FaSpinner } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import CoursePhoneInput, { PHONE_CONFIG } from './CoursePhoneInput';

interface CoursePurchaseModalProps {
  courseName: string;
  price: number;
  courseId: string;
  currency?: string;
  buttonLabel?: string;
}

export default function CoursePurchaseModal({
  courseName,
  price,
  courseId,
  currency = 'грн',
  buttonLabel,
}: CoursePurchaseModalProps) {
  const t = useTranslations('PurchaseModal');
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('UA');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [finalPrice, setFinalPrice] = useState(price);

  const closeModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeModal]);

  const openModal = () => {
    setEmail(session?.user?.email || '');
    setFirstName(session?.user?.name?.split(' ')[0] || '');
    setLastName(session?.user?.name?.split(' ').slice(1).join(' ') || '');
    setFinalPrice(price);
    setPromoApplied(false);
    setPromoError('');
    setPromoCode('');
    setIsOpen(true);
  };

  const handlePromoCheck = async () => {
    if (!promoCode.trim()) return;
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
    if (!email.trim()) return alert(t('alertEmail'));
    if (!firstName.trim()) return alert(t('alertFirstName'));
    if (!lastName.trim()) return alert(t('alertLastName'));
    if (!phone.trim()) return alert(t('alertPhone'));
    const fullPhone = `${(PHONE_CONFIG[phoneCountry] ?? PHONE_CONFIG['UA']).prefix}${phone}`;

    setLoading(true);
    try {
      const orderReference = `${courseId}_${Date.now()}`;
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
      alert(t('errorPaymentRetry'));
      setLoading(false);
    }
  };

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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="username@gmail.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A017] focus:border-transparent outline-none text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="purchase-firstname" className="block text-sm font-medium text-gray-700 mb-1">
                {t('firstName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-firstname"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('firstNamePlaceholder')}
                autoComplete="given-name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A017] focus:border-transparent outline-none text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="purchase-lastname" className="block text-sm font-medium text-gray-700 mb-1">
                {t('lastName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase-lastname"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('lastNamePlaceholder')}
                autoComplete="family-name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A017] focus:border-transparent outline-none text-gray-900"
              />
            </div>

            <CoursePhoneInput
              phoneCountry={phoneCountry}
              phone={phone}
              onPhoneCountryChange={setPhoneCountry}
              onPhoneChange={setPhone}
            />

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
                  {promoApplied && finalPrice !== price && (
                    <span className="text-base text-gray-400 line-through">
                      {price} {currency}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-gray-900">
                    {finalPrice} {currency}
                  </span>
                </div>
              </div>
            </div>

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

  return (
    <>
      <button
        onClick={openModal}
        className="group relative inline-flex items-center gap-3 bg-[#D4A017] text-white font-bold py-4 px-16 rounded-xl text-base mx-auto justify-center overflow-hidden shadow-md shadow-[#D4A017]/20 transition-all duration-300 hover:bg-[#c69414] hover:shadow-lg hover:shadow-[#D4A017]/30"
      >
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <FaWallet className="relative text-xl" />
        <span className="relative">{buttonLabel ?? t('btnBuy')}</span>
      </button>

      {isOpen && mounted && createPortal(modal, document.body)}
    </>
  );
}
