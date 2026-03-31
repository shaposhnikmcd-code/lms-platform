import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { cityRef, search } = await req.json();

    if (!cityRef || !search) {
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
          CityRef: cityRef,
          FindByString: search,
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