'use client';

import { useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

interface WayForPayButtonProps {
  courseName: string;
  price: number;
  courseId: string;
}

export default function WayForPayButton({ courseName, price, courseId }: WayForPayButtonProps) {
  const t = useTranslations('PurchaseModal');
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!session?.user?.email) {
      alert(t('alertLogin'));
      return;
    }

    setLoading(true);
    try {
      const orderReference = `${courseId}_${Date.now()}`;

      const response = await fetch('/api/wayforpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
          amount: price,
          productName: courseName,
          productPrice: price,
          productCount: 1,
          clientEmail: session.user.email,
          courseId,
        }),
      });

      if (!response.ok) {
        throw new Error(t('errorPayment'));
      }

      const paymentData = await response.json();

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://secure.wayforpay.com/pay';
      form.style.display = 'none';

      Object.entries(paymentData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => {
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

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="group inline-flex items-center gap-3 bg-[#D4A017] text-white font-bold py-5 px-12 rounded-xl hover:bg-[#b88913] transition-all text-lg w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <FaWallet className="text-xl" />
      {loading ? t('loading') : t('btnBuy')}
    </button>
  );
}