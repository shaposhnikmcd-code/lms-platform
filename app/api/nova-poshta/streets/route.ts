import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { isSameOrigin } from '@/lib/apiGuards';

export async function POST(req: NextRequest) {
  try {
    // Endpoint публічний (без session), але палить наш NP API key і квоту —
    // тому лише same-origin + rate limit.
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rl = await checkRateLimit(req, 'novaPoshta');
    if (!rl.ok) return rl.response!;

    const { cityRef, search } = await req.json();

    if (typeof cityRef !== 'string' || !cityRef || typeof search !== 'string' || !search) {
      return NextResponse.json({ streets: [] });
    }

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'Address',
        calledMethod: 'getStreet',
        methodProperties: {
          CityRef: cityRef.slice(0, 100),
          FindByString: search.slice(0, 100),
          Limit: 20,
        },
      }),
    });

    const data = await response.json();
    const streets = data.data || [];

    return NextResponse.json({ streets });
  } catch (error) {
    console.error('Streets API error:', error);
    return NextResponse.json({ streets: [] }, { status: 500 });
  }
}
