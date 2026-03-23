import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { streetRef, search } = await req.json();

    if (!streetRef) {
      return NextResponse.json({ buildings: [] });
    }

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'Address',
        calledMethod: 'getBuildings',
        methodProperties: {
          StreetRef: streetRef,
          FindByString: search || '',
          Limit: 20,
        },
      }),
    });

    const data = await response.json();
    const buildings = data.data || [];

    return NextResponse.json({ buildings });
  } catch (error) {
    console.error('Buildings API error:', error);
    return NextResponse.json({ buildings: [] }, { status: 500 });
  }
}