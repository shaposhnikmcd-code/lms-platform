'use client';

import { useEffect } from 'react';
import type { GA4PurchaseEvent } from '@/lib/analytics/buildPurchaseEvent';

interface Props {
  event: GA4PurchaseEvent;
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export default function PurchaseTracker({ event }: Props) {
  useEffect(() => {
    const txId = event.ecommerce.transaction_id;
    const flagKey = `ga4_purchase_tracked:${txId}`;
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(flagKey)) return;
      sessionStorage.setItem(flagKey, '1');
    } catch {
      // sessionStorage недоступний (private mode тощо) — просто шлемо без dedup
    }
    window.dataLayer = window.dataLayer || [];
    // GA4 best practice: clear `ecommerce` first, then push event.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push(event as unknown as Record<string, unknown>);
  }, [event]);

  return null;
}
