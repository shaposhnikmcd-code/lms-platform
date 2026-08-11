// app/api/nova-poshta/cities/route.ts
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

    const { cityName } = await request.json();

    if (typeof cityName !== 'string' || cityName.trim().length < 2) {
      return NextResponse.json({ cities: [] });
    }

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'Address',
        calledMethod: 'getCities',
        methodProperties: {
          FindByString: cityName.slice(0, 100),
          Page: '1',
          Limit: '20'
        }
      })
    });

    const data = await response.json();
    return NextResponse.json({
      cities: data.data || []
    });

  } catch (error) {
    console.error('❌ Помилка:', error);
    return NextResponse.json({ cities: [] });
  }
}
