/// Client-side GA4 Enhanced Ecommerce helpers. Push `view_item`, `add_to_cart`,
/// `begin_checkout` into `window.dataLayer`. `purchase` живе окремо в
/// [PurchaseTracker](app/[locale]/payment/success/_components/PurchaseTracker.tsx)
/// бо там потрібен server-side lookup orderReference → items.

export interface EcommerceItem {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity?: number;
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/// Категорія, яку GA4 побачить у звіті, з префікса courseId.
/// Дзеркалить логіку [buildPurchaseEvent.ts](lib/analytics/buildPurchaseEvent.ts).
export function inferEcommerceCategory(courseId: string): string {
  if (courseId.startsWith('bundle_')) return 'Пакет';
  if (courseId === 'yearly-program' || courseId === 'yearly-program-monthly') return 'Річна програма';
  if (courseId === 'connector' || courseId.startsWith('connector_')) return 'Гра';
  return 'Курс';
}

function pushEvent(eventName: 'view_item' | 'add_to_cart' | 'begin_checkout', item: EcommerceItem, currency: string) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  // GA4 best practice: clear `ecommerce` first, then push event.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: eventName,
    ecommerce: {
      currency,
      value: item.price * (item.quantity ?? 1),
      items: [{ ...item, quantity: item.quantity ?? 1 }],
    },
  });
}

/// Fires once per `item_id` per browser session (sessionStorage flag).
/// Захищає від спаму, коли на одній сторінці кілька CoursePurchaseModal
/// (наприклад, кнопка в hero і в pricing-секції).
export function trackViewItem(item: EcommerceItem, currency: string = 'UAH') {
  if (typeof window === 'undefined') return;
  const flag = `ga4_view_item:${item.item_id}`;
  try {
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, '1');
  } catch {
    // sessionStorage недоступний — просто шлемо без dedup.
  }
  pushEvent('view_item', item, currency);
}

export function trackAddToCart(item: EcommerceItem, currency: string = 'UAH') {
  pushEvent('add_to_cart', item, currency);
}

export function trackBeginCheckout(item: EcommerceItem, currency: string = 'UAH') {
  pushEvent('begin_checkout', item, currency);
}
