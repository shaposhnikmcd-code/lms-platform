'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

interface Props {
  type?: string;
  orderRef?: string;
  delayMs?: number;
}

export default function AutoRedirect({ type, orderRef, delayMs = 3000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (orderRef) params.set('orderRef', orderRef);
      const qs = params.toString();
      router.push(`/payment/thank-you${qs ? `?${qs}` : ''}`);
    }, delayMs);
    return () => clearTimeout(t);
  }, [router, type, orderRef, delayMs]);

  return null;
}
