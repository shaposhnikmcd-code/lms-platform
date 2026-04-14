'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

interface Props {
  type?: string;
  delayMs?: number;
}

export default function AutoRedirect({ type, delayMs = 3000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push(`/payment/thank-you${type ? `?type=${type}` : ''}`);
    }, delayMs);
    return () => clearTimeout(t);
  }, [router, type, delayMs]);

  return null;
}
