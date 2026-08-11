// app/api/nova-poshta/warehouses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { isSameOrigin } from '@/lib/apiGuards';

export async function POST(request: NextRequest) {
  try {
    // Endpoint публічний (без session), але палить наш NP API key і квоту —
    // тому лише same-origin + rate limit.
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rl = await checkRateLimit(request, 'novaPoshta');
    if (!rl.ok) return rl.response!;

    const { cityName, searchString } = await request.json();

    if (typeof cityName !== 'string' || !cityName.trim()) {
      return NextResponse.json({ warehouses: [] });
    }

    // Отримуємо відділення за назвою міста
    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'Address',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityName: cityName.slice(0, 100),
          FindByString: typeof searchString === 'string' ? searchString.slice(0, 100) : '',
          Page: '1',
          Limit: '50',
          Language: 'UA'
        }
      })
    });

    const data = await response.json();
    return NextResponse.json({
      warehouses: data.data || []
    });

  } catch (error) {
    console.error('❌ Помилка:', error);
    return NextResponse.json({ warehouses: [] });
  }
}
