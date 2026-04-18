import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';

const LVIV_REF = '8d5a980d-391c-11dd-90d9-001a92567626';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SERVICE_TYPES = new Set(['WarehouseWarehouse', 'WarehouseDoors', 'DoorsWarehouse', 'DoorsDoors']);

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('host');
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Захист від сторонніх викликів — лише same-origin.
    // Це рідкісний випадок: endpoint публічний (без session), але витрачає наш NP API quota.
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rl = await checkRateLimit(request, 'novaPoshta');
    if (!rl.ok) return rl.response!;

    const { cityRef, serviceType } = await request.json();

    // Валідація вхідних даних — відкидаємо зловмисні payloads швидко.
    if (typeof cityRef !== 'string' || !UUID_RE.test(cityRef)) {
      return NextResponse.json({ error: 'Invalid cityRef' }, { status: 400 });
    }
    if (typeof serviceType !== 'string' || !ALLOWED_SERVICE_TYPES.has(serviceType)) {
      return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 });
    }

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'InternetDocument',
        calledMethod: 'getDocumentPrice',
        methodProperties: {
          CitySender: LVIV_REF,
          CityRecipient: cityRef,
          ServiceType: serviceType,
          Weight: '0.5',
          Cost: '1099',
          CargoType: 'Parcel',
          SeatsAmount: '1',
        },
      }),
    });

    const data = await response.json();
    const cost = data.data?.[0]?.Cost || null;

    return NextResponse.json({ cost });
  } catch (error) {
    console.error('❌ Delivery cost error:', error);
    return NextResponse.json({ cost: null });
  }
}