// app/api/nova-poshta/cities/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { cityName } = await request.json();

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'Address',
        calledMethod: 'getCities',
        methodProperties: {
          FindByString: cityName,
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